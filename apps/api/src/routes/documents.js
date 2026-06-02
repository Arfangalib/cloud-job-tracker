import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { JobPost } from "../models/JobPost.js";
import { Resume } from "../models/Resume.js";
import { GeneratedDocument } from "../models/GeneratedDocument.js";
import { ensureJobScored } from "../services/scoring.js";
import { buildTailoredDraft } from "../services/tailor.js";
import {
  DOCUMENT_FORMATS,
  DOCUMENT_KINDS,
  MIME_TYPES,
  renderDocument
} from "../services/documentRenderer.js";
import { getObjectStream, putObject } from "../services/fileStorage.js";

export const documentRouter = express.Router();

documentRouter.use(requireAuth);

const generateSchema = z.object({
  jobId: z.string().min(1),
  kind: z.enum(DOCUMENT_KINDS),
  format: z.enum(DOCUMENT_FORMATS)
});

documentRouter.post("/generate", async (req, res, next) => {
  try {
    const { jobId, kind, format } = generateSchema.parse(req.body);

    const job = await JobPost.findOne({ _id: jobId, userId: req.user._id });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const resume = await Resume.findOne({ userId: req.user._id, isPrimary: true }).sort({ createdAt: -1 });
    if (!resume) return res.status(400).json({ error: "Upload a resume before generating documents" });

    // Reuse the existing score + tailor pipeline (scores once, cached via scoredAt).
    await ensureJobScored(job, resume);
    const draft = await buildTailoredDraft({ job, resume });

    const buffer = await renderDocument({
      kind,
      format,
      draft,
      resume,
      job,
      user: req.user
    });

    const fileName = buildFileName({ kind, format, job });
    const key = `generated/${req.user._id}/${Date.now()}-${fileName}`;
    const stored = await putObject({ key, buffer, contentType: MIME_TYPES[format] });

    const document = await GeneratedDocument.create({
      userId: req.user._id,
      jobId: job._id,
      resumeId: resume._id,
      kind,
      format,
      storageKey: stored.storageKey,
      storageDriver: stored.storageDriver,
      mimetype: MIME_TYPES[format],
      size: buffer.length,
      fileName,
      draftSnapshot: draft
    });

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
});

documentRouter.get("/", async (req, res) => {
  const documents = await GeneratedDocument.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate("jobId", "title company");
  res.json({ documents });
});

documentRouter.get("/:id/download", async (req, res, next) => {
  try {
    const document = await GeneratedDocument.findOne({ _id: req.params.id, userId: req.user._id });
    if (!document) return res.status(404).json({ error: "Document not found" });

    const stream = await getObjectStream({
      storageKey: document.storageKey,
      storageDriver: document.storageDriver
    });

    res.setHeader("Content-Type", document.mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${document.fileName || "document"}"`);

    // Once headers are flushed we can't change the status, so tear the socket
    // down on a mid-transfer read error instead of calling next().
    stream.on("error", (error) => {
      if (res.headersSent) res.destroy(error);
      else next(error);
    });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

function buildFileName({ kind, format, job }) {
  const company = (job.company || "company").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const label = kind === "coverLetter" ? "cover-letter" : "resume";
  return `${label}-${company}.${format}`;
}

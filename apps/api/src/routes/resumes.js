import express from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Resume } from "../models/Resume.js";
import { parseResume } from "../services/resumeParser.js";
import { resumeUpload } from "../middleware/upload.js";
import { extractTextFromFile } from "../services/fileExtractor.js";
import { putObject } from "../services/fileStorage.js";

export const resumeRouter = express.Router();

resumeRouter.use(requireAuth);

/** Create a resume from raw text or an uploaded buffer, reusing parse + primary reset. */
async function createResume({ userId, title, rawText, isPrimary = true, sourceFile }) {
  if (isPrimary) {
    await Resume.updateMany({ userId }, { isPrimary: false });
  }
  return Resume.create({
    userId,
    title,
    rawText,
    isPrimary,
    parsed: parseResume(rawText),
    ...(sourceFile ? { sourceFile } : {})
  });
}

resumeRouter.post("/", async (req, res, next) => {
  try {
    const input = z
      .object({ title: z.string().min(2), rawText: z.string().min(20), isPrimary: z.boolean().optional() })
      .parse(req.body);
    const resume = await createResume({
      userId: req.user._id,
      title: input.title,
      rawText: input.rawText,
      isPrimary: input.isPrimary ?? true
    });
    res.status(201).json({ resume });
  } catch (error) {
    next(error);
  }
});

// Map multer errors (e.g. oversize files) to 400 instead of a generic 500.
function handleUpload(req, res, next) {
  resumeUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE" ? "Resume file is too large (max 5 MB)." : error.message;
      return res.status(400).json({ error: message });
    }
    if (error) return res.status(error.status || 400).json({ error: error.message });
    next();
  });
}

resumeRouter.post("/upload", handleUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    const title = z.string().min(2).parse(req.body.title || req.file.originalname || "Uploaded resume");

    const rawText = await extractTextFromFile({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalName: req.file.originalname
    });

    const key = `resumes/${req.user._id}/${Date.now()}-${sanitizeName(req.file.originalname)}`;
    const stored = await putObject({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype
    });

    const resume = await createResume({
      userId: req.user._id,
      title,
      rawText,
      isPrimary: true,
      sourceFile: {
        storageKey: stored.storageKey,
        storageDriver: stored.storageDriver,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });

    res.status(201).json({ resume });
  } catch (error) {
    next(error);
  }
});

function sanitizeName(name = "resume") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "resume";
}

resumeRouter.get("/", async (req, res) => {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ resumes });
});

resumeRouter.post("/:id/parse", async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) return res.status(404).json({ error: "Resume not found" });
  resume.parsed = parseResume(resume.rawText);
  await resume.save();
  res.json({ resume });
});

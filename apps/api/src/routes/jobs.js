import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { IngestionRun } from "../models/IngestionRun.js";
import { JobPost } from "../models/JobPost.js";
import { Resume } from "../models/Resume.js";
import { Application } from "../models/Application.js";
import { startApifyJobImport, startLinkedInJobSearchImport } from "../services/apify.js";
import { detectSource, needsApify } from "../services/jobNormalizer.js";
import { enqueue } from "../services/queue.js";
import { ensureJobScored, scoreJobAgainstResume } from "../services/scoring.js";
import { buildTailoredDraft } from "../services/tailor.js";

export const jobRouter = express.Router();

jobRouter.use(requireAuth);

const recencySchema = {
  recentDays: z.coerce.number().int().min(1).max(365).optional(),
  recentHours: z.coerce.number().int().min(1).max(8760).optional()
};

jobRouter.get("/", async (req, res, next) => {
  try {
    const input = z.object({ ...recencySchema }).parse(req.query);
    const query = { userId: req.user._id };

    const cutoff = recencyCutoff(input);
    if (cutoff) Object.assign(query, recencyFilter(cutoff));

    const jobs = await JobPost.find(query).sort({ postedAt: -1, createdAt: -1 });
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
});

// Convert a recentHours/recentDays window into an absolute cutoff Date.
function recencyCutoff({ recentHours, recentDays }) {
  const hours = recentHours || (recentDays ? recentDays * 24 : 0);
  if (!hours) return null;
  return new Date(Date.now() - hours * 3600 * 1000);
}

// Match on the real posting date, falling back to import time when absent.
function recencyFilter(cutoff) {
  return {
    $or: [{ postedAt: { $gte: cutoff } }, { postedAt: null, createdAt: { $gte: cutoff } }]
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

jobRouter.get("/:id", async (req, res) => {
  const job = await JobPost.findOne({ _id: req.params.id, userId: req.user._id });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ job });
});

// Search the user's already-imported, scored jobs. This is a read-only query
// over persisted JobPosts — distinct from importing new jobs via Apify.
jobRouter.post("/search", async (req, res, next) => {
  try {
    const input = z
      .object({
        query: z.string().trim().optional().default(""),
        location: z.string().trim().optional(),
        source: z.string().trim().optional(),
        minScore: z.coerce.number().int().min(0).max(100).optional(),
        ...recencySchema
      })
      .parse(req.body);

    const filters = [{ userId: req.user._id }];
    if (input.query) filters.push({ $text: { $search: input.query } });
    if (input.location) {
      filters.push({ location: { $regex: escapeRegex(input.location), $options: "i" } });
    }
    if (input.source) filters.push({ source: input.source });
    if (input.minScore != null) filters.push({ "match.score": { $gte: input.minScore } });
    const cutoff = recencyCutoff(input);
    if (cutoff) filters.push(recencyFilter(cutoff));

    const where = filters.length > 1 ? { $and: filters } : filters[0];
    const jobs = await JobPost.find(where)
      .sort({ "match.score": -1, postedAt: -1, createdAt: -1 })
      .limit(100);

    res.json({ jobs });
  } catch (error) {
    next(error);
  }
});

jobRouter.post("/import-linkedin-search", async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().min(2),
      location: z.string().min(2),
      rows: z.coerce.number().int().min(1).max(1000).default(25)
    }).parse(req.body);
    const sourceUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      input.title
    )}&location=${encodeURIComponent(input.location)}`;
    const run = await IngestionRun.create({
      userId: req.user._id,
      source: "linkedin",
      sourceUrl,
      mode: "apify",
      status: "pending"
    });

    try {
      const apifyRun = await startLinkedInJobSearchImport({
        title: input.title,
        location: input.location,
        rows: input.rows,
        ingestionRunId: run._id.toString()
      });
      Object.assign(run, {
        status: apifyRun.configured ? "running" : "pending",
        apifyRunId: apifyRun.apifyRunId,
        actorId: apifyRun.actorId,
        datasetId: apifyRun.datasetId,
        error: apifyRun.configured ? undefined : apifyRun.message
      });
      await run.save();
    } catch (error) {
      run.status = "failed";
      run.error = getErrorMessage(error);
      logApifyImportError("linkedin-search", run, error);
      await run.save();
    }

    res.status(202).json({ ingestionRun: run });
  } catch (error) {
    next(error);
  }
});

jobRouter.post("/import-url", async (req, res, next) => {
  try {
    const { url } = z.object({ url: z.string().url() }).parse(req.body);
    const source = detectSource(url);
    const mode = needsApify(url) ? "apify" : "direct";
    const run = await IngestionRun.create({ userId: req.user._id, source, sourceUrl: url, mode, status: "pending" });

    if (mode === "apify") {
      try {
        const apifyRun = await startApifyJobImport({ sourceUrl: url, ingestionRunId: run._id.toString() });
        Object.assign(run, {
          status: apifyRun.configured ? "running" : "pending",
          apifyRunId: apifyRun.apifyRunId,
          actorId: apifyRun.actorId,
          datasetId: apifyRun.datasetId,
          error: apifyRun.configured ? undefined : apifyRun.message
        });
        await run.save();
      } catch (error) {
        run.status = "failed";
        run.error = getErrorMessage(error);
        logApifyImportError("url-import", run, error);
        await run.save();
      }
      return res.status(202).json({ ingestionRun: run });
    }

    await enqueue("direct-import", { ingestionRunId: run._id.toString(), userId: req.user._id.toString(), url });
    res.status(202).json({ ingestionRun: run });
  } catch (error) {
    next(error);
  }
});

jobRouter.post("/:id/score", async (req, res) => {
  const job = await JobPost.findOne({ _id: req.params.id, userId: req.user._id });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const resume = await Resume.findOne({ userId: req.user._id, isPrimary: true }).sort({ createdAt: -1 });
  if (!resume) return res.status(400).json({ error: "Upload a resume before scoring jobs" });
  // Explicit user-initiated scoring always recomputes.
  job.match = await scoreJobAgainstResume(job, resume);
  job.scoredAt = new Date();
  await job.save();
  res.json({ job });
});

jobRouter.post("/:id/tailor", async (req, res) => {
  const job = await JobPost.findOne({ _id: req.params.id, userId: req.user._id });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const resume = await Resume.findOne({ userId: req.user._id, isPrimary: true }).sort({ createdAt: -1 });
  if (!resume) return res.status(400).json({ error: "Upload a resume before tailoring" });
  await ensureJobScored(job, resume);
  res.json({ draft: await buildTailoredDraft({ job, resume }) });
});

export async function upsertJobs(userId, jobs) {
  const created = [];
  for (const job of jobs) {
    // Keep the real posting date current even for already-imported jobs, while
    // $setOnInsert preserves everything else (e.g. score, status) on re-import.
    const { postedAt, ...rest } = job;
    const update = { $setOnInsert: { ...rest, userId } };
    if (postedAt) update.$set = { postedAt };
    const saved = await JobPost.findOneAndUpdate(
      { userId, sourceUrl: job.sourceUrl },
      update,
      { upsert: true, new: true }
    );
    await Application.findOneAndUpdate(
      { userId, jobId: saved._id },
      { $setOnInsert: { userId, jobId: saved._id, status: "saved" } },
      { upsert: true }
    );
    created.push(saved);
  }
  return created;
}

function logApifyImportError(importType, run, error) {
  console.error("APIFY IMPORT ERROR", {
    importType,
    ingestionRunId: run._id.toString(),
    actorId: run.actorId,
    message: getErrorMessage(error)
  });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

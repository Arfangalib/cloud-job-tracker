import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { IngestionRun } from "../models/IngestionRun.js";
import { JobPost } from "../models/JobPost.js";
import { Resume } from "../models/Resume.js";
import { Application } from "../models/Application.js";
import { startApifyJobImport, startLinkedInJobSearchImport } from "../services/apify.js";
import { detectSource, needsApify, normalizeJob } from "../services/jobNormalizer.js";
import { enqueue } from "../services/queue.js";
import { scoreJobAgainstResume } from "../services/scoring.js";
import { buildTailoredDraft } from "../services/tailor.js";

export const jobRouter = express.Router();

jobRouter.use(requireAuth);

jobRouter.get("/", async (req, res) => {
  const jobs = await JobPost.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ jobs });
});

jobRouter.get("/:id", async (req, res) => {
  const job = await JobPost.findOne({ _id: req.params.id, userId: req.user._id });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ job });
});

jobRouter.post("/search", async (req, res, next) => {
  try {
    const input = z.object({ query: z.string().min(2), location: z.string().optional() }).parse(req.body);
    const demoJobs = [
      normalizeJob(
        {
          title: `${input.query} Intern`,
          company: "Northstar Cloud Labs",
          location: input.location || "Canada / Remote",
          description:
            "Internship using React, Node, AWS, Docker, REST APIs, CI/CD, testing, and cloud monitoring.",
          url: `https://example.com/jobs/${encodeURIComponent(input.query.toLowerCase())}-intern`
        },
        { source: "demo" }
      )
    ];
    const created = await upsertJobs(req.user._id, demoJobs);
    res.json({ jobs: created, source: "demo-search" });
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
      run.error = error.message;
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
        run.error = error.message;
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
  job.match = scoreJobAgainstResume(job, resume);
  await job.save();
  res.json({ job });
});

jobRouter.post("/:id/tailor", async (req, res) => {
  const job = await JobPost.findOne({ _id: req.params.id, userId: req.user._id });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const resume = await Resume.findOne({ userId: req.user._id, isPrimary: true }).sort({ createdAt: -1 });
  if (!resume) return res.status(400).json({ error: "Upload a resume before tailoring" });
  if (!job.match?.score) {
    job.match = scoreJobAgainstResume(job, resume);
    await job.save();
  }
  res.json({ draft: buildTailoredDraft({ job, resume }) });
});

export async function upsertJobs(userId, jobs) {
  const created = [];
  for (const job of jobs) {
    const saved = await JobPost.findOneAndUpdate(
      { userId, sourceUrl: job.sourceUrl },
      { $setOnInsert: { ...job, userId } },
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

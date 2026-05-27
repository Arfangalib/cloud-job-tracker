import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Application } from "../models/Application.js";
import { JobPost } from "../models/JobPost.js";

export const applicationRouter = express.Router();

applicationRouter.use(requireAuth);

applicationRouter.get("/", async (req, res) => {
  const applications = await Application.find({ userId: req.user._id })
    .populate("jobId")
    .sort({ updatedAt: -1 });
  res.json({ applications });
});

applicationRouter.post("/", async (req, res, next) => {
  try {
    const input = z.object({ jobId: z.string(), notes: z.string().optional() }).parse(req.body);
    const job = await JobPost.findOne({ _id: input.jobId, userId: req.user._id });
    if (!job) return res.status(404).json({ error: "Job not found" });
    const application = await Application.create({ userId: req.user._id, jobId: job._id, notes: input.notes });
    res.status(201).json({ application });
  } catch (error) {
    next(error);
  }
});

applicationRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const input = z
      .object({
        status: z.enum(["saved", "tailoring", "applied", "interview", "rejected", "offer"]),
        notes: z.string().optional()
      })
      .parse(req.body);
    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        status: input.status,
        notes: input.notes,
        appliedAt: input.status === "applied" ? new Date() : undefined
      },
      { new: true }
    );
    if (!application) return res.status(404).json({ error: "Application not found" });
    await JobPost.updateOne({ _id: application.jobId, userId: req.user._id }, { status: input.status });
    res.json({ application });
  } catch (error) {
    next(error);
  }
});

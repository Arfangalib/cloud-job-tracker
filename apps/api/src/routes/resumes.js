import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Resume } from "../models/Resume.js";
import { parseResume } from "../services/resumeParser.js";

export const resumeRouter = express.Router();

resumeRouter.use(requireAuth);

resumeRouter.post("/", async (req, res, next) => {
  try {
    const input = z
      .object({ title: z.string().min(2), rawText: z.string().min(20), isPrimary: z.boolean().optional() })
      .parse(req.body);
    if (input.isPrimary) {
      await Resume.updateMany({ userId: req.user._id }, { isPrimary: false });
    }
    const resume = await Resume.create({
      userId: req.user._id,
      title: input.title,
      rawText: input.rawText,
      isPrimary: input.isPrimary ?? true,
      parsed: parseResume(input.rawText)
    });
    res.status(201).json({ resume });
  } catch (error) {
    next(error);
  }
});

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

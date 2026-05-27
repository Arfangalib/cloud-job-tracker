import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { Reminder } from "../models/Reminder.js";

export const reminderRouter = express.Router();

reminderRouter.use(requireAuth);

reminderRouter.get("/", async (req, res) => {
  const reminders = await Reminder.find({ userId: req.user._id }).sort({ dueAt: 1 });
  res.json({ reminders });
});

reminderRouter.post("/", async (req, res, next) => {
  try {
    const input = z
      .object({
        title: z.string().min(2),
        dueAt: z.coerce.date(),
        jobId: z.string().optional(),
        applicationId: z.string().optional(),
        channel: z.enum(["email", "in-app"]).optional()
      })
      .parse(req.body);
    const reminder = await Reminder.create({ ...input, userId: req.user._id });
    res.status(201).json({ reminder });
  } catch (error) {
    next(error);
  }
});

reminderRouter.patch("/:id", async (req, res, next) => {
  try {
    const input = z
      .object({
        title: z.string().min(2).optional(),
        dueAt: z.coerce.date().optional(),
        status: z.enum(["scheduled", "sent", "cancelled"]).optional()
      })
      .parse(req.body);
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      input,
      { new: true }
    );
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });
    res.json({ reminder });
  } catch (error) {
    next(error);
  }
});

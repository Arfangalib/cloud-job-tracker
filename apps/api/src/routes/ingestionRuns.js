import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { IngestionRun } from "../models/IngestionRun.js";

export const ingestionRouter = express.Router();

ingestionRouter.use(requireAuth);

ingestionRouter.get("/:id", async (req, res) => {
  const ingestionRun = await IngestionRun.findOne({ _id: req.params.id, userId: req.user._id });
  if (!ingestionRun) return res.status(404).json({ error: "Ingestion run not found" });
  res.json({ ingestionRun });
});

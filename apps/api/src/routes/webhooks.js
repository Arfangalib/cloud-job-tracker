import express from "express";
import { env } from "../config/env.js";
import { IngestionRun } from "../models/IngestionRun.js";
import { completeApifyIngestionRun } from "../services/ingestion.js";

export const webhookRouter = express.Router();

webhookRouter.post("/apify/job-parsed", async (req, res, next) => {
  try {
    const secret = req.get("x-apify-webhook-secret") || getBearerToken(req) || req.query.secret;
    if (secret !== env.apifyWebhookSecret) return res.status(401).json({ error: "Invalid webhook secret" });

    const ingestionRunId = req.query.ingestionRunId || req.body.ingestionRunId || req.body.resource?.defaultKeyValueStoreId;
    const run = await IngestionRun.findById(ingestionRunId);
    if (!run) return res.status(404).json({ error: "Unknown ingestion run" });

    const apifyData = req.body.resource || req.body;
    const datasetId = req.body.datasetId || apifyData.defaultDatasetId || run.datasetId;
    const inlineItems = Array.isArray(req.body.items) ? req.body.items : [];

    // Shared with the worker poller; the atomic claim keeps webhook + poll idempotent.
    const result = await completeApifyIngestionRun({ run, datasetId, inlineItems });

    res.json({ ok: true, queued: result.queued, alreadyCompleted: result.alreadyCompleted });
  } catch (error) {
    next(error);
  }
});

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

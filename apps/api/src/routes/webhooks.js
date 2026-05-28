import express from "express";
import { env } from "../config/env.js";
import { IngestionRun } from "../models/IngestionRun.js";
import { fetchApifyDatasetItems } from "../services/apify.js";
import { normalizeJob } from "../services/jobNormalizer.js";
import { enqueue } from "../services/queue.js";

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
    const fetchedItems = inlineItems.length ? inlineItems : await fetchApifyDatasetItems(datasetId);
    const jobs = fetchedItems.map((item) =>
      normalizeJob(item, { source: run.source, sourceUrl: run.sourceUrl, location: "Canada / Remote" })
    );

    run.status = "completed";
    run.datasetId = datasetId;
    run.itemsImported = jobs.length;
    await run.save();

    await enqueue("apify-results", {
      ingestionRunId: run._id.toString(),
      userId: run.userId.toString(),
      jobs
    });

    res.json({ ok: true, queued: jobs.length });
  } catch (error) {
    next(error);
  }
});

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

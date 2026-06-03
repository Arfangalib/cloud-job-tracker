import { env } from "../config/env.js";
import { IngestionRun } from "../models/IngestionRun.js";
import { fetchApifyDatasetItems, fetchApifyRun } from "./apify.js";
import { normalizeJob } from "./jobNormalizer.js";
import { enqueue } from "./queue.js";

/**
 * Maps an Apify run status to a coarse outcome the poller acts on.
 * Pure (no DB/network) so the decision is unit-testable in isolation.
 */
export function classifyApifyStatus(status) {
  switch (status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
    case "ABORTED":
    case "ABORTING":
    case "TIMED-OUT":
    case "TIMING-OUT":
      return "failed";
    // READY / RUNNING / unknown / null → keep polling
    default:
      return "pending";
  }
}

/**
 * Normalizes the run's dataset into jobs, atomically claims the ingestion run, and
 * enqueues scoring. The atomic status claim makes this safe to call from BOTH the
 * Apify webhook and the worker poller without double-importing or double-scoring.
 */
export async function completeApifyIngestionRun({ run, datasetId, inlineItems }) {
  const items = Array.isArray(inlineItems) && inlineItems.length
    ? inlineItems
    : await fetchApifyDatasetItems(datasetId);
  const jobs = items.map((item) =>
    normalizeJob(item, { source: run.source, sourceUrl: run.sourceUrl, location: "Canada / Remote" })
  );

  // Only the first path to win the claim enqueues results; the other becomes a no-op.
  const claimed = await IngestionRun.findOneAndUpdate(
    { _id: run._id, status: { $nin: ["completed", "failed"] } },
    { $set: { status: "completed", datasetId, itemsImported: jobs.length } },
    { new: true }
  );
  if (!claimed) return { alreadyCompleted: true, queued: 0 };

  await enqueue("apify-results", {
    ingestionRunId: claimed._id.toString(),
    userId: claimed.userId.toString(),
    jobs
  });
  return { alreadyCompleted: false, queued: jobs.length };
}

/**
 * One poll step for an Apify-backed ingestion run. Durable fallback for when the
 * inbound webhook never arrives (e.g. no public tunnel in local dev). Re-enqueues
 * its own next attempt while the run is still going, up to the poll budget.
 */
export async function pollApifyIngestionRun({ ingestionRunId, attempt = 0, maxAttempts = env.apifyPollMaxAttempts }) {
  const run = await IngestionRun.findById(ingestionRunId);
  if (!run) return { done: true, reason: "missing-run" };
  if (run.status === "completed" || run.status === "failed") {
    return { done: true, reason: "already-terminal" };
  }
  if (!run.apifyRunId) {
    await markFailed(run, "Apify run id is missing; cannot poll for results.");
    return { done: true, reason: "misconfigured" };
  }

  const apifyRun = await fetchApifyRun(run.apifyRunId);
  const outcome = classifyApifyStatus(apifyRun?.status);

  if (outcome === "succeeded") {
    await completeApifyIngestionRun({
      run,
      datasetId: apifyRun.defaultDatasetId || run.datasetId
    });
    return { done: true, reason: "succeeded" };
  }

  if (outcome === "failed") {
    await markFailed(run, `Apify run ended with status ${apifyRun.status}.`);
    return { done: true, reason: "failed" };
  }

  // Still pending (RUNNING/READY) or status unavailable: keep polling until budget runs out.
  if (attempt + 1 < maxAttempts) {
    await enqueue(
      "apify-poll",
      { ingestionRunId: run._id.toString(), attempt: attempt + 1, maxAttempts },
      { runAfter: new Date(Date.now() + env.apifyPollIntervalMs), maxAttempts: env.apifyPollMaxAttempts }
    );
    return { done: false, reason: "pending" };
  }

  await markFailed(run, "Apify run did not finish within the poll window.");
  return { done: true, reason: "timed-out" };
}

async function markFailed(run, error) {
  run.status = "failed";
  run.error = error;
  await run.save();
}

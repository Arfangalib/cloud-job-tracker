import { env } from "../config/env.js";

export async function startApifyJobImport({ sourceUrl, ingestionRunId }) {
  if (!env.apifyToken || !env.apifyJobActorId) {
    return {
      configured: false,
      message: "Apify credentials are not configured; ingestion run is pending manual webhook/demo completion."
    };
  }

  const webhookUrl = buildWebhookUrl(ingestionRunId);
  const url = buildRunUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: sourceUrl }],
      webhookUrl,
      maxItems: 25
    })
  });

  if (!response.ok) {
    throw new Error(`Apify run failed to start: ${response.status}`);
  }

  const body = await response.json();
  const run = body.data || body;
  return {
    configured: true,
    apifyRunId: run.id,
    actorId: run.actId || env.apifyJobActorId,
    datasetId: run.defaultDatasetId
  };
}

export async function startLinkedInJobSearchImport({ title, location, rows = 25, ingestionRunId }) {
  if (!env.apifyToken || !env.apifyJobActorId) {
    return {
      configured: false,
      message: "Apify credentials are not configured; ingestion run is pending manual webhook/demo completion."
    };
  }

  const webhookUrl = buildWebhookUrl(ingestionRunId);
  const url = buildRunUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      location,
      rows,
      webhookUrl
    })
  });

  if (!response.ok) {
    throw new Error(`Apify run failed to start: ${response.status}`);
  }

  const body = await response.json();
  const run = body.data || body;
  return {
    configured: true,
    apifyRunId: run.id,
    actorId: run.actId || env.apifyJobActorId,
    datasetId: run.defaultDatasetId
  };
}

export async function fetchApifyDatasetItems(datasetId) {
  if (!env.apifyToken || !datasetId) return [];
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&token=${encodeURIComponent(
      env.apifyToken
    )}`
  );
  if (!response.ok) throw new Error(`Failed to fetch Apify dataset: ${response.status}`);
  return response.json();
}

function buildWebhookUrl(ingestionRunId) {
  return `${env.publicApiUrl}/webhooks/apify/job-parsed?secret=${encodeURIComponent(
    env.apifyWebhookSecret
  )}&ingestionRunId=${ingestionRunId}`;
}

function buildRunUrl() {
  return `https://api.apify.com/v2/acts/${encodeURIComponent(
    env.apifyJobActorId
  )}/runs?token=${encodeURIComponent(env.apifyToken)}&waitForFinish=0`;
}

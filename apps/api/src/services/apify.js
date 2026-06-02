import { env } from "../config/env.js";

export async function startApifyJobImport({ sourceUrl, ingestionRunId }) {
  if (!env.apifyToken || !env.apifyJobActorId) {
    return {
      configured: false,
      message: "Apify credentials are not configured; ingestion run is pending manual webhook/demo completion."
    };
  }

  const webhookUrl = buildWebhookUrl(ingestionRunId);
  const url = buildRunUrl({ actorId: normalizeActorId(env.apifyJobActorId) });

  const response = await fetch(url, {
    method: "POST",
    headers: getApifyHeaders(),
    body: JSON.stringify({
      startUrls: [{ url: sourceUrl }],
      webhookUrl,
      maxItems: 25
    })
  });

  if (!response.ok) {
    throw new Error(await getApifyErrorMessage(response, "Apify run failed to start"));
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

  const actorId = normalizeActorId(env.apifyJobActorId);
  const url = buildRunUrl({
    actorId,
    maxItems: rows,
    webhooks: buildRunWebhooks(ingestionRunId)
  });

  const response = await fetch(url, {
    method: "POST",
    headers: getApifyHeaders(),
    body: JSON.stringify({
      job_title: title,
      location,
      jobs_entries: rows,
      start_jobs: 0
    })
  });

  if (!response.ok) {
    throw new Error(await getApifyErrorMessage(response, "Apify run failed to start"));
  }

  const body = await response.json();
  const run = body.data || body;
  return {
    configured: true,
    apifyRunId: run.id,
    actorId: run.actId || actorId,
    datasetId: run.defaultDatasetId
  };
}

export async function fetchApifyRun(runId) {
  if (!env.apifyToken || !runId) return null;
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(env.apifyToken)}`
  );
  if (!response.ok) throw new Error(await getApifyErrorMessage(response, "Failed to fetch Apify run"));
  const body = await response.json();
  const run = body.data || body;
  return { status: run.status, defaultDatasetId: run.defaultDatasetId };
}

export async function fetchApifyDatasetItems(datasetId) {
  if (!env.apifyToken || !datasetId) return [];
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&token=${encodeURIComponent(
      env.apifyToken
    )}`
  );
  if (!response.ok) throw new Error(await getApifyErrorMessage(response, "Failed to fetch Apify dataset"));
  return response.json();
}

async function getApifyErrorMessage(response, prefix) {
  const body = await readApifyErrorBody(response);
  const detail = extractApifyErrorDetail(body) || response.statusText || "Request failed";
  return sanitizeSensitive(`${prefix}: ${response.status} ${detail}`);
}

async function readApifyErrorBody(response) {
  const jsonResponse = typeof response.clone === "function" ? response.clone() : response;

  try {
    return await jsonResponse.json();
  } catch (_jsonError) {
    // Fall through to raw text; clone() keeps the original response body readable in real fetch responses.
  }

  try {
    return await response.text();
  } catch (_textError) {
    return null;
  }
}

function extractApifyErrorDetail(body) {
  if (!body) return "";

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return "";

    try {
      return extractApifyErrorDetail(JSON.parse(trimmed)) || trimmed;
    } catch (_error) {
      return trimmed;
    }
  }

  if (typeof body.error === "object" && body.error !== null) {
    return body.error.message || body.error.type || JSON.stringify(body.error);
  }

  if (typeof body.error === "string") return body.error;
  if (typeof body.message === "string") return body.message;

  return "";
}

function sanitizeSensitive(message) {
  return [env.apifyToken, env.apifyWebhookSecret]
    .filter(Boolean)
    .flatMap((secret) => [secret, encodeURIComponent(secret)])
    .reduce((safeMessage, secret) => safeMessage.split(secret).join("[redacted]"), message);
}

function getApifyHeaders() {
  return {
    authorization: `Bearer ${env.apifyToken}`,
    "content-type": "application/json"
  };
}

function buildRunWebhooks(ingestionRunId) {
  return [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED"],
      requestUrl: buildWebhookUrl(ingestionRunId, { includeSecret: false }),
      headersTemplate: JSON.stringify({
        authorization: `Bearer ${env.apifyWebhookSecret}`
      })
    }
  ];
}

function buildWebhookUrl(ingestionRunId, { includeSecret = true } = {}) {
  const params = new URLSearchParams({ ingestionRunId });
  if (includeSecret) params.set("secret", env.apifyWebhookSecret);
  return `${env.publicApiUrl}/webhooks/apify/job-parsed?${params}`;
}

function buildRunUrl({ actorId, maxItems, webhooks } = {}) {
  const params = new URLSearchParams({ waitForFinish: "0" });
  if (maxItems) params.set("maxItems", String(maxItems));
  if (webhooks) params.set("webhooks", Buffer.from(JSON.stringify(webhooks)).toString("base64"));
  return `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?${params}`;
}

function normalizeActorId(actorId) {
  return actorId.replaceAll("/", "~");
}

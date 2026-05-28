import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { connectDb, disconnectDb } from "../src/db.js";
import { createApp } from "../src/server.js";
import { env } from "../src/config/env.js";
import { IngestionRun } from "../src/models/IngestionRun.js";
import { WorkItem } from "../src/models/WorkItem.js";

let mongo;
let app;
let userCount = 0;

const originalEnv = {
  apifyToken: env.apifyToken,
  apifyJobActorId: env.apifyJobActorId,
  apifyWebhookSecret: env.apifyWebhookSecret,
  publicApiUrl: env.publicApiUrl
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  app = createApp();
}, 60000);

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(env, originalEnv);
});

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

describe("Apify LinkedIn imports", () => {
  it("validates LinkedIn search input", async () => {
    const token = await registerAndToken();

    const response = await request(app)
      .post("/jobs/import-linkedin-search")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "C", location: "Canada", rows: 25 });

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.error)).toBe(true);
  });

  it("starts a LinkedIn Apify run with the actor search payload", async () => {
    configureApifyEnv();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "run-123",
          actId: "worldunboxer~rapid-linkedin-scraper",
          defaultDatasetId: "dataset-123"
        }
      })
    });
    const token = await registerAndToken();

    const response = await request(app)
      .post("/jobs/import-linkedin-search")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Cloud SWE intern", location: "Canada / Remote", rows: 5 });

    expect(response.status).toBe(202);
    expect(response.body.ingestionRun.status).toBe("running");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("worldunboxer~rapid-linkedin-scraper");
    expect(url).toContain("waitForFinish=0");
    expect(url).toContain("maxItems=5");
    expect(url).not.toContain("test-apify-token");
    expect(options.headers).toMatchObject({
      authorization: "Bearer test-apify-token"
    });
    const payload = JSON.parse(options.body);
    expect(payload).toMatchObject({
      job_title: "Cloud SWE intern",
      location: "Canada / Remote",
      jobs_entries: 5,
      start_jobs: 0
    });
    expect(payload.webhookUrl).toBeUndefined();
    expect(payload.startUrls).toBeUndefined();

    const runUrl = new URL(url);
    const webhooks = JSON.parse(Buffer.from(runUrl.searchParams.get("webhooks"), "base64").toString("utf8"));
    expect(webhooks[0]).toMatchObject({
      eventTypes: ["ACTOR.RUN.SUCCEEDED"],
      requestUrl: expect.stringContaining("/webhooks/apify/job-parsed"),
      headersTemplate: expect.stringContaining("Bearer test-webhook-secret")
    });
    expect(webhooks[0].requestUrl).toContain("ingestionRunId=");
    expect(webhooks[0].requestUrl).not.toContain("secret=");
  });

  it("marks LinkedIn Apify start failures and logs the parsed error", async () => {
    configureApifyEnv();
    const consoleMock = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        error: {
          type: "unauthorized",
          message: "Token is invalid."
        }
      })
    });
    const token = await registerAndToken();

    const response = await request(app)
      .post("/jobs/import-linkedin-search")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Cloud SWE intern", location: "Canada / Remote", rows: 5 });

    expect(response.status).toBe(202);
    expect(response.body.ingestionRun.status).toBe("failed");
    expect(response.body.ingestionRun.error).toContain("401");
    expect(response.body.ingestionRun.error).toContain("Token is invalid.");
    expect(consoleMock).toHaveBeenCalledTimes(1);

    const [logMessage, logDetails] = consoleMock.mock.calls[0];
    expect(logMessage).toBe("APIFY IMPORT ERROR");
    expect(logDetails).toMatchObject({
      importType: "linkedin-search",
      message: expect.stringContaining("Token is invalid.")
    });
    expect(JSON.stringify(consoleMock.mock.calls)).not.toContain(env.apifyToken);
  });

  it("falls back to sanitized raw Apify error text", async () => {
    configureApifyEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      clone: () => ({
        json: async () => {
          throw new Error("Not JSON");
        }
      }),
      text: async () => `Actor temporarily unavailable for ${env.apifyToken}`
    });
    const token = await registerAndToken();

    const response = await request(app)
      .post("/jobs/import-linkedin-search")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Cloud SWE intern", location: "Canada / Remote", rows: 5 });

    expect(response.status).toBe(202);
    expect(response.body.ingestionRun.status).toBe("failed");
    expect(response.body.ingestionRun.error).toContain("503");
    expect(response.body.ingestionRun.error).toContain("Actor temporarily unavailable");
    expect(response.body.ingestionRun.error).toContain("[redacted]");
    expect(response.body.ingestionRun.error).not.toContain(env.apifyToken);
  });

  it("queues normalized jobs from Apify webhook inline items", async () => {
    configureApifyEnv();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "run-456",
          actId: "worldunboxer~rapid-linkedin-scraper",
          defaultDatasetId: "dataset-456"
        }
      })
    });
    const token = await registerAndToken();
    const importResponse = await request(app)
      .post("/jobs/import-linkedin-search")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Cloud SWE intern", location: "Canada / Remote", rows: 5 });
    const runId = importResponse.body.ingestionRun._id;

    const webhookResponse = await request(app)
      .post(`/webhooks/apify/job-parsed?ingestionRunId=${runId}`)
      .set("Authorization", `Bearer ${env.apifyWebhookSecret}`)
      .send({
        datasetId: "dataset-456",
        items: [
          {
            job_title: "Cloud SWE Intern",
            company_name: "Northstar Cloud Labs",
            job_location: "Remote Canada",
            job_description_plain: "React, Node, AWS, Docker, Terraform",
            job_url: "https://www.linkedin.com/jobs/view/123",
            job_id: "123"
          }
        ]
      });

    expect(webhookResponse.status).toBe(200);
    expect(webhookResponse.body).toMatchObject({ ok: true, queued: 1 });

    const run = await IngestionRun.findById(runId);
    expect(run.status).toBe("completed");
    expect(run.itemsImported).toBe(1);

    const item = await WorkItem.findOne({ type: "apify-results" });
    expect(item.payload.jobs[0]).toMatchObject({
      title: "Cloud SWE Intern",
      company: "Northstar Cloud Labs",
      source: "linkedin",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
      externalId: "123"
    });
  });
});

async function registerAndToken() {
  userCount += 1;
  const response = await request(app).post("/auth/register").send({
    name: "Cloud Student",
    email: `apify-${userCount}@example.com`,
    password: "verysecurepassword"
  });
  return response.body.accessToken;
}

function configureApifyEnv() {
  env.apifyToken = "test-apify-token";
  env.apifyJobActorId = "worldunboxer/rapid-linkedin-scraper";
  env.apifyWebhookSecret = "test-webhook-secret";
  env.publicApiUrl = "https://example-tunnel.test";
}

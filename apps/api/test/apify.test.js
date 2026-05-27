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
          actId: "bebity~linkedin-jobs-scraper",
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
    expect(url).toContain("bebity~linkedin-jobs-scraper");
    expect(url).toContain("waitForFinish=0");
    const payload = JSON.parse(options.body);
    expect(payload).toMatchObject({
      title: "Cloud SWE intern",
      location: "Canada / Remote",
      rows: 5
    });
    expect(payload.webhookUrl).toContain("/webhooks/apify/job-parsed");
    expect(payload.webhookUrl).toContain("ingestionRunId=");
    expect(payload.startUrls).toBeUndefined();
  });

  it("queues normalized jobs from Apify webhook inline items", async () => {
    configureApifyEnv();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "run-456",
          actId: "bebity~linkedin-jobs-scraper",
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
      .post(`/webhooks/apify/job-parsed?secret=${encodeURIComponent(env.apifyWebhookSecret)}&ingestionRunId=${runId}`)
      .send({
        datasetId: "dataset-456",
        items: [
          {
            title: "Cloud SWE Intern",
            companyName: "Northstar Cloud Labs",
            location: "Remote Canada",
            description: "React, Node, AWS, Docker, Terraform",
            link: "https://www.linkedin.com/jobs/view/123"
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
      source: "linkedin"
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
  env.apifyJobActorId = "bebity~linkedin-jobs-scraper";
  env.apifyWebhookSecret = "test-webhook-secret";
  env.publicApiUrl = "https://example-tunnel.test";
}

import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { connectDb, disconnectDb } from "../src/db.js";
import { JobPost } from "../src/models/JobPost.js";
import { createApp } from "../src/server.js";
import { setOpenAiClientForTests } from "../src/services/openaiClient.js";

let mongo;
let app;
let userCount = 0;

const originalEnv = {
  aiProvider: env.aiProvider,
  openaiApiKey: env.openaiApiKey,
  openaiScoringModel: env.openaiScoringModel,
  openaiTailorModel: env.openaiTailorModel
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  app = createApp();
}, 60000);

beforeEach(() => {
  env.aiProvider = "mock";
  env.openaiApiKey = "";
  env.openaiScoringModel = "gpt-5.4-mini";
  env.openaiTailorModel = "gpt-5.4";
  setOpenAiClientForTests(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(env, originalEnv);
  setOpenAiClientForTests(undefined);
});

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

describe("AI job routes", () => {
  it("saves an OpenAI-backed match from the score route", async () => {
    const { token, userId } = await registerAndToken();
    await createPrimaryResume(token);
    const job = await createJob(userId);
    configureOpenAi({
      score: 91,
      strongMatches: ["React", "AWS"],
      missingKeywords: ["Terraform"],
      summary: "Excellent internship fit."
    });

    const response = await request(app).post(`/jobs/${job._id}/score`).set("Authorization", `Bearer ${token}`).send({});

    expect(response.status).toBe(200);
    expect(response.body.job.match).toMatchObject({
      score: 91,
      strongMatches: ["React", "AWS"],
      missingKeywords: ["Terraform"],
      summary: "Excellent internship fit."
    });

    const saved = await JobPost.findById(job._id);
    expect(saved.match.score).toBe(91);
  });

  it("returns an OpenAI-backed tailored draft shape", async () => {
    const { token, userId } = await registerAndToken();
    await createPrimaryResume(token);
    const job = await createJob(userId, {
      match: {
        score: 82,
        strongMatches: ["React", "AWS"],
        missingKeywords: ["Terraform"],
        summary: "Strong fit."
      }
    });
    configureOpenAi({
      resumeHeadline: "Cloud SWE candidate with React and AWS projects",
      bulletSuggestions: ["Lead with React project impact", "Mention AWS deployment truthfully"],
      coverLetterDraft: "I am excited to apply with React and AWS project experience.",
      guardrails: {
        doNotInvent: ["certifications", "employment dates"],
        onlyAddIfTrue: ["Terraform"]
      }
    });

    const response = await request(app).post(`/jobs/${job._id}/tailor`).set("Authorization", `Bearer ${token}`).send({});

    expect(response.status).toBe(200);
    expect(response.body.draft).toMatchObject({
      resumeHeadline: "Cloud SWE candidate with React and AWS projects",
      guardrails: {
        onlyAddIfTrue: ["Terraform"]
      }
    });
    expect(response.body.draft.bulletSuggestions[0]).toContain("React");
  });

  it("returns helpful errors before AI work when no primary resume exists", async () => {
    const { token, userId } = await registerAndToken();
    const job = await createJob(userId);

    const scoreResponse = await request(app).post(`/jobs/${job._id}/score`).set("Authorization", `Bearer ${token}`).send({});
    const tailorResponse = await request(app)
      .post(`/jobs/${job._id}/tailor`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(scoreResponse.status).toBe(400);
    expect(scoreResponse.body.error).toBe("Upload a resume before scoring jobs");
    expect(tailorResponse.status).toBe(400);
    expect(tailorResponse.body.error).toBe("Upload a resume before tailoring");
  });

  it("filters recent jobs without changing the default all-jobs response", async () => {
    const { token, userId } = await registerAndToken();
    const recent = await createJob(userId, {
      title: "Recent Cloud SWE Intern",
      sourceUrl: `https://example.com/recent-${userCount}`
    });
    const old = await createJob(userId, {
      title: "Old Cloud SWE Intern",
      sourceUrl: `https://example.com/old-${userCount}`
    });
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    await JobPost.collection.updateOne({ _id: old._id }, { $set: { createdAt: oldDate, updatedAt: oldDate } });

    const allResponse = await request(app).get("/jobs").set("Authorization", `Bearer ${token}`);
    const recentResponse = await request(app).get("/jobs?recentDays=7").set("Authorization", `Bearer ${token}`);

    expect(allResponse.body.jobs.map((job) => job._id)).toEqual(expect.arrayContaining([recent.id, old.id]));
    expect(recentResponse.body.jobs.map((job) => job._id)).toContain(recent.id);
    expect(recentResponse.body.jobs.map((job) => job._id)).not.toContain(old.id);
  });
});

async function registerAndToken() {
  userCount += 1;
  const response = await request(app).post("/auth/register").send({
    name: "Cloud Student",
    email: `ai-${userCount}@example.com`,
    password: "verysecurepassword"
  });
  return { token: response.body.accessToken, userId: response.body.user.id };
}

async function createPrimaryResume(token) {
  return request(app).post("/resumes").set("Authorization", `Bearer ${token}`).send({
    title: "Primary SWE/cloud resume",
    rawText: "Built a React and Node project on AWS using Docker, S3, REST APIs, and testing.",
    isPrimary: true
  });
}

function createJob(userId, overrides = {}) {
  return JobPost.create({
    userId,
    source: "linkedin",
    sourceUrl: `https://example.com/job-${userCount}-${Date.now()}-${Math.random()}`,
    title: "Cloud SWE Intern",
    company: "Acme",
    location: "Vancouver, British Columbia, Canada",
    description: "React, Node, AWS, Docker, Terraform, Kubernetes, testing",
    keywords: ["react", "node", "aws", "docker", "terraform"],
    ...overrides
  });
}

function configureOpenAi(output) {
  env.aiProvider = "openai";
  env.openaiApiKey = "test-openai-key";
  setOpenAiClientForTests({
    responses: {
      create: async () => ({ output_text: JSON.stringify(output) })
    }
  });
}

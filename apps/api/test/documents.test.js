import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import mammoth from "mammoth";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb } from "../src/db.js";
import { createApp } from "../src/server.js";
import { env } from "../src/config/env.js";
import { JobPost } from "../src/models/JobPost.js";
import { User } from "../src/models/User.js";

let mongo;
let app;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  env.storageDriver = "local";
  env.uploadDir = mkdtempSync(path.join(os.tmpdir(), "cjt-docs-"));
  env.aiProvider = "mock";
  app = createApp();
}, 60000);

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

// Buffer binary responses (DOCX) into a real Buffer for mammoth/jszip.
function binaryParser(res, callback) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

let setupCount = 0;

async function setup() {
  setupCount += 1;
  const email = `docs-${setupCount}@example.com`;
  const register = await request(app)
    .post("/auth/register")
    .send({ name: "Ada Lovelace", email, password: "verysecurepassword" });
  const token = register.body.accessToken;

  await request(app)
    .post("/resumes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Primary",
      rawText:
        "Built a React and Node project on AWS using Docker, S3, and REST APIs. BSc Computer Science.",
      isPrimary: true
    });

  const user = await User.findOne({ email });
  const job = await JobPost.create({
    userId: user._id,
    source: "manual",
    sourceUrl: `https://example.com/docs-job-${setupCount}`,
    title: "Cloud SWE Intern",
    company: "Acme Cloud",
    location: "Remote",
    description: "React, Node, AWS, Docker, Terraform",
    keywords: ["react", "node", "aws", "docker", "terraform"]
  });

  return { token, jobId: job._id.toString() };
}

describe("document generation", () => {
  it("generates, lists, and downloads an ATS resume PDF", async () => {
    const { token, jobId } = await setup();

    const generate = await request(app)
      .post("/documents/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobId, kind: "resume", format: "pdf" });

    expect(generate.status).toBe(201);
    expect(generate.body.document.fileName).toMatch(/\.pdf$/);
    expect(generate.body.document.size).toBeGreaterThan(0);

    const list = await request(app).get("/documents").set("Authorization", `Bearer ${token}`);
    expect(list.body.documents).toHaveLength(1);

    const download = await request(app)
      .get(`/documents/${generate.body.document._id}/download`)
      .set("Authorization", `Bearer ${token}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain("attachment");
    expect(download.body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("generates a resume DOCX with ATS sections and tailored content", async () => {
    const { token, jobId } = await setup();

    const generate = await request(app)
      .post("/documents/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobId, kind: "resume", format: "docx" });
    expect(generate.status).toBe(201);

    const download = await request(app)
      .get(`/documents/${generate.body.document._id}/download`)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(binaryParser);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("wordprocessingml");

    const { value: text } = await mammoth.extractRawText({ buffer: download.body });
    // Real ATS layout sections (from the structured/fallback tailoring draft).
    expect(text).toContain("Summary");
    expect(text).toContain("Technical Skills");
    expect(text).toContain("Experience");
    // Job-specific tailored content grounded in the resume.
    expect(text.toLowerCase()).toContain("react");
  });

  it("rejects generation without a resume", async () => {
    const register = await request(app)
      .post("/auth/register")
      .send({ name: "No Resume", email: "noresume@example.com", password: "verysecurepassword" });
    const token = register.body.accessToken;
    const user = await User.findOne({ email: "noresume@example.com" });
    const job = await JobPost.create({
      userId: user._id,
      source: "manual",
      sourceUrl: "https://example.com/job-2",
      title: "Intern",
      company: "Acme"
    });

    const response = await request(app)
      .post("/documents/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobId: job._id.toString(), kind: "resume", format: "pdf" });

    expect(response.status).toBe(400);
  });
});

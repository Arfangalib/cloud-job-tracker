import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb } from "../src/db.js";
import { createApp } from "../src/server.js";
import { env } from "../src/config/env.js";

let mongo;
let app;
let tmpDir;

const RESUME_TEXT =
  "Senior cloud engineer. Built a React and Node project on AWS using Docker, " +
  "Kubernetes, Terraform, S3, and REST APIs. BSc Computer Science, University of Test.";

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "cjt-uploads-"));
  env.storageDriver = "local";
  env.uploadDir = tmpDir;
  app = createApp();
}, 60000);

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

async function authedAgent(email) {
  const register = await request(app)
    .post("/auth/register")
    .send({ name: "Cloud Student", email, password: "verysecurepassword" });
  return register.body.accessToken;
}

describe("POST /resumes/upload", () => {
  it("uploads a resume file, stores it, parses skills, and marks it primary", async () => {
    const token = await authedAgent("upload-ok@example.com");
    const response = await request(app)
      .post("/resumes/upload")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Primary resume")
      .attach("file", Buffer.from(RESUME_TEXT, "utf8"), "resume.txt");

    expect(response.status).toBe(201);
    expect(response.body.resume.isPrimary).toBe(true);
    expect(response.body.resume.parsed.skills).toContain("aws");
    expect(response.body.resume.sourceFile.storageDriver).toBe("local");

    // The original binary should be retrievable from local storage.
    const stored = await readFile(path.join(tmpDir, response.body.resume.sourceFile.storageKey));
    expect(stored.toString("utf8")).toContain("React and Node");
  });

  it("rejects an unsupported file type with 400", async () => {
    const token = await authedAgent("upload-bad@example.com");
    const response = await request(app)
      .post("/resumes/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("\x89PNG fake"), "photo.png");

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .post("/resumes/upload")
      .attach("file", Buffer.from(RESUME_TEXT), "resume.txt");
    expect(response.status).toBe(401);
  });
});

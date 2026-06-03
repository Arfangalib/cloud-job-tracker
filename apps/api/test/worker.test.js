import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb } from "../src/db.js";
import { processItem, startWorker } from "../src/workerLoop.js";
import { JobPost } from "../src/models/JobPost.js";
import { Resume } from "../src/models/Resume.js";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
}, 60000);

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

describe("worker loop", () => {
  it("exports startWorker without starting a loop on import", () => {
    expect(typeof startWorker).toBe("function");
  });

  it("processes a score-job work item against the primary resume", async () => {
    const userId = new mongoose.Types.ObjectId();
    await Resume.create({
      userId,
      title: "Resume",
      rawText: "React Node AWS Docker",
      parsed: { skills: ["react", "node", "aws", "docker"] },
      isPrimary: true
    });
    const job = await JobPost.create({
      userId,
      source: "greenhouse",
      sourceUrl: "https://example.com/score-1",
      title: "Cloud Engineer Intern",
      company: "Nimbus",
      description: "React Node AWS",
      keywords: ["react", "node", "aws"]
    });

    await processItem({ type: "score-job", payload: { userId: userId.toString(), jobId: job._id.toString() } });

    const scored = await JobPost.findById(job._id);
    expect(scored.scoredAt).toBeInstanceOf(Date);
    expect(scored.match.score).toBeGreaterThan(0);
  });
});

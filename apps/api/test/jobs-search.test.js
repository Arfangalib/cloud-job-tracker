import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb } from "../src/db.js";
import { createApp } from "../src/server.js";
import { JobPost } from "../src/models/JobPost.js";
import { User } from "../src/models/User.js";

let mongo;
let app;
let token;
let userId;

const HOUR = 3600 * 1000;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  app = createApp();

  const register = await request(app)
    .post("/auth/register")
    .send({ name: "Search User", email: "search@example.com", password: "verysecurepassword" });
  token = register.body.accessToken;
  userId = (await User.findOne({ email: "search@example.com" }))._id;

  await JobPost.create([
    {
      userId,
      source: "linkedin",
      sourceUrl: "https://example.com/a",
      title: "Cloud SWE Intern",
      company: "Acme Cloud",
      description: "React Node AWS Docker",
      keywords: ["react", "aws"],
      match: { score: 90 },
      postedAt: new Date(Date.now() - 2 * HOUR)
    },
    {
      userId,
      source: "greenhouse",
      sourceUrl: "https://example.com/b",
      title: "Frontend Engineer",
      company: "Pixel Inc",
      description: "React TypeScript",
      keywords: ["react"],
      match: { score: 50 },
      postedAt: new Date(Date.now() - 5 * 24 * HOUR)
    },
    {
      userId,
      source: "manual",
      sourceUrl: "https://example.com/c",
      title: "Data Engineer",
      company: "Streamly",
      description: "Python Spark",
      keywords: ["python"],
      match: { score: 30 }
      // no postedAt -> falls back to createdAt (now)
    }
  ]);
}, 60000);

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

describe("GET /jobs recency filter", () => {
  it("filters by recentHours on postedAt (24h window)", async () => {
    const response = await request(app)
      .get("/jobs?recentHours=24")
      .set("Authorization", `Bearer ${token}`);
    const titles = response.body.jobs.map((job) => job.title);
    expect(titles).toContain("Cloud SWE Intern"); // posted 2h ago
    expect(titles).toContain("Data Engineer"); // no postedAt, createdAt now
    expect(titles).not.toContain("Frontend Engineer"); // posted 5d ago
  });

  it("returns all jobs without a recency window", async () => {
    const response = await request(app).get("/jobs").set("Authorization", `Bearer ${token}`);
    expect(response.body.jobs).toHaveLength(3);
  });
});

describe("POST /jobs/search", () => {
  it("text-searches persisted jobs and sorts by score", async () => {
    const response = await request(app)
      .post("/jobs/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "react" });
    const titles = response.body.jobs.map((job) => job.title);
    expect(titles).toContain("Cloud SWE Intern");
    expect(titles).toContain("Frontend Engineer");
    expect(titles).not.toContain("Data Engineer");
    // Highest score first.
    expect(response.body.jobs[0].title).toBe("Cloud SWE Intern");
  });

  it("applies a minScore filter", async () => {
    const response = await request(app)
      .post("/jobs/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "react", minScore: 80 });
    expect(response.body.jobs).toHaveLength(1);
    expect(response.body.jobs[0].title).toBe("Cloud SWE Intern");
  });

  it("does not create demo jobs (read-only)", async () => {
    await request(app)
      .post("/jobs/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "nonexistentrole" });
    expect(await JobPost.countDocuments({ userId })).toBe(3);
  });
});

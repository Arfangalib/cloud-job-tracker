import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { setOpenAiClientForTests } from "../src/services/openaiClient.js";
import { ensureJobScored } from "../src/services/scoring.js";
import { parseResume } from "../src/services/resumeParser.js";

const resume = {
  rawText: "Built React and AWS projects.",
  parsed: parseResume("Built React and AWS projects.")
};

beforeEach(() => {
  env.aiProvider = "mock";
  env.openaiApiKey = "";
  setOpenAiClientForTests(undefined);
});

afterEach(() => {
  setOpenAiClientForTests(undefined);
});

describe("ensureJobScored", () => {
  it("scores and stamps scoredAt on a never-scored job", async () => {
    let saved = 0;
    const job = {
      title: "Cloud SWE Intern",
      keywords: ["react", "aws", "terraform"],
      scoredAt: undefined,
      save: async () => {
        saved += 1;
      }
    };
    await ensureJobScored(job, resume);
    expect(job.scoredAt).toBeInstanceOf(Date);
    expect(job.match.strongMatches).toContain("react");
    expect(saved).toBe(1);
  });

  it("does NOT re-score a job that legitimately scored 0% (scoredAt set)", async () => {
    let saved = 0;
    const job = {
      title: "Unrelated role",
      keywords: ["welding"],
      match: { score: 0, strongMatches: [], missingKeywords: ["welding"] },
      scoredAt: new Date("2026-01-01"),
      save: async () => {
        saved += 1;
      }
    };
    await ensureJobScored(job, resume);
    expect(saved).toBe(0); // no recompute, no save
    expect(job.match.score).toBe(0);
  });
});

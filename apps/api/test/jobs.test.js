import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { setOpenAiClientForTests } from "../src/services/openaiClient.js";
import { normalizeJob } from "../src/services/jobNormalizer.js";
import { parseResume } from "../src/services/resumeParser.js";
import { scoreJobAgainstResume } from "../src/services/scoring.js";
import { buildTailoredDraft } from "../src/services/tailor.js";

const originalEnv = {
  aiProvider: env.aiProvider,
  openaiApiKey: env.openaiApiKey,
  openaiScoringModel: env.openaiScoringModel,
  openaiTailorModel: env.openaiTailorModel
};

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

describe("job matching and tailoring", () => {
  it("normalizes jobs, scores against resume skills, and keeps guardrails", async () => {
    const resume = {
      rawText: "Built a React and Node project on AWS using Docker, S3, REST APIs, and testing.",
      parsed: parseResume("Built a React and Node project on AWS using Docker, S3, REST APIs, and testing.")
    };
    const job = normalizeJob({
      title: "Cloud SWE Intern",
      company: "Acme",
      url: "https://example.com/acme",
      description: "React, Node, AWS, Docker, Terraform, Kubernetes, testing"
    });

    const match = await scoreJobAgainstResume(job, resume);
    expect(match.strongMatches).toContain("react");
    expect(match.missingKeywords).toContain("terraform");

    const draft = await buildTailoredDraft({ job: { ...job, match }, resume });
    expect(draft.guardrails.doNotInvent).toContain("certifications");
    expect(draft.guardrails.onlyAddIfTrue).toContain("terraform");
  });

  it("normalizes worldunboxer LinkedIn scraper fields", () => {
    const job = normalizeJob(
      {
        job_title: "Cloud SWE Intern",
        company_name: "Northstar Cloud Labs",
        job_location: "Remote Canada",
        job_description_plain: "React, Node, AWS, Docker, Terraform",
        job_url: "https://www.linkedin.com/jobs/view/123",
        job_id: "123"
      },
      { source: "linkedin" }
    );

    expect(job).toMatchObject({
      title: "Cloud SWE Intern",
      company: "Northstar Cloud Labs",
      location: "Remote Canada",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
      source: "linkedin",
      externalId: "123",
      remoteType: "remote"
    });
    expect(job.keywords).toContain("react");
  });

  it("uses structured OpenAI scoring when configured", async () => {
    env.aiProvider = "openai";
    env.openaiApiKey = "test-openai-key";
    setOpenAiClientForTests({
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            score: 84,
            strongMatches: ["React", "AWS"],
            missingKeywords: ["Terraform"],
            summary: "Strong internship fit with a small infrastructure gap."
          })
        })
      }
    });

    const match = await scoreJobAgainstResume(
      {
        title: "Cloud SWE Intern",
        company: "Acme",
        location: "Vancouver",
        description: "React, AWS, Terraform",
        keywords: ["react", "aws", "terraform"]
      },
      {
        rawText: "React project deployed to AWS.",
        parsed: parseResume("React project deployed to AWS.")
      }
    );

    expect(match).toMatchObject({
      score: 84,
      strongMatches: ["React", "AWS"],
      missingKeywords: ["Terraform"]
    });
  });

  it("falls back when OpenAI structured scoring is invalid", async () => {
    env.aiProvider = "openai";
    env.openaiApiKey = "test-openai-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    setOpenAiClientForTests({
      responses: {
        create: async () => ({ output_text: "not-json" })
      }
    });

    const match = await scoreJobAgainstResume(
      {
        title: "Cloud SWE Intern",
        company: "Acme",
        description: "React, AWS, Terraform",
        keywords: ["react", "aws", "terraform"]
      },
      {
        rawText: "Built React and AWS projects.",
        parsed: parseResume("Built React and AWS projects.")
      }
    );

    expect(match.strongMatches).toContain("react");
    expect(match.missingKeywords).toContain("terraform");
  });

  it("falls back without calling OpenAI when the API key is missing", async () => {
    env.aiProvider = "openai";
    env.openaiApiKey = "";
    const createSpy = vi.fn(async () => {
      throw new Error("OpenAI should not be called without a key");
    });
    setOpenAiClientForTests({ responses: { create: createSpy } });

    const job = {
      title: "Cloud SWE Intern",
      company: "Acme",
      description: "React, AWS, Terraform",
      keywords: ["react", "aws", "terraform"]
    };
    const resume = {
      rawText: "Built React and AWS projects.",
      parsed: parseResume("Built React and AWS projects.")
    };

    const match = await scoreJobAgainstResume(job, resume);
    const draft = await buildTailoredDraft({ job: { ...job, match }, resume });

    expect(createSpy).not.toHaveBeenCalled();
    expect(match.strongMatches).toContain("react");
    expect(draft.guardrails.onlyAddIfTrue).toContain("terraform");
  });

  it("uses structured OpenAI tailoring when configured", async () => {
    env.aiProvider = "openai";
    env.openaiApiKey = "test-openai-key";
    setOpenAiClientForTests({
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            resumeHeadline: "Cloud SWE intern candidate with React and AWS projects",
            bulletSuggestions: ["Lead with React project impact", "Mention AWS deployment truthfully"],
            coverLetterDraft: "I am excited to apply with React and AWS project experience.",
            guardrails: {
              doNotInvent: ["certifications", "employment dates"],
              onlyAddIfTrue: ["Terraform"]
            }
          })
        })
      }
    });

    const draft = await buildTailoredDraft({
      job: {
        title: "Cloud SWE Intern",
        company: "Acme",
        description: "React, AWS, Terraform",
        match: { strongMatches: ["React", "AWS"], missingKeywords: ["Terraform"] }
      },
      resume: {
        rawText: "Built React and AWS projects.",
        parsed: parseResume("Built React and AWS projects.")
      }
    });

    expect(draft).toMatchObject({
      resumeHeadline: "Cloud SWE intern candidate with React and AWS projects",
      guardrails: {
        onlyAddIfTrue: ["Terraform"]
      }
    });
    expect(draft.bulletSuggestions[0]).toContain("React");
  });

  it("falls back when OpenAI tailoring fails", async () => {
    env.aiProvider = "openai";
    env.openaiApiKey = "test-openai-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    setOpenAiClientForTests({
      responses: {
        create: async () => {
          throw new Error("model unavailable");
        }
      }
    });

    const draft = await buildTailoredDraft({
      job: {
        title: "Cloud SWE Intern",
        company: "Acme",
        description: "React, AWS, Terraform",
        keywords: ["react", "aws", "terraform"],
        match: { strongMatches: ["react", "aws"], missingKeywords: ["terraform"] }
      },
      resume: {
        rawText: "Built React and AWS projects.",
        parsed: parseResume("Built React and AWS projects.")
      }
    });

    expect(draft.resumeHeadline).toContain("Cloud SWE Intern");
    expect(draft.guardrails.doNotInvent).toContain("certifications");
    expect(draft.guardrails.onlyAddIfTrue).toContain("terraform");
  });
});

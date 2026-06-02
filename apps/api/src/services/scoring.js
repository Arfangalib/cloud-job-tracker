import { extractKeywords } from "./resumeParser.js";
import { env } from "../config/env.js";
import { createStructuredJson, logAiError } from "./openaiClient.js";

export async function scoreJobAgainstResume(job, resume) {
  try {
    const aiMatch = await scoreJobWithOpenAi(job, resume);
    if (aiMatch) return aiMatch;
  } catch (error) {
    logAiError("score-job", error);
  }

  return scoreJobWithKeywords(job, resume);
}

/**
 * Score a job once and persist it. Re-uses the existing match when the job has
 * already been scored (tracked by scoredAt) so a genuine 0% score is not
 * re-scored on every tailor/generate call. Returns the (possibly saved) job.
 */
export async function ensureJobScored(job, resume) {
  if (job.scoredAt) return job;
  job.match = await scoreJobAgainstResume(job, resume);
  job.scoredAt = new Date();
  await job.save();
  return job;
}

export function scoreJobWithKeywords(job, resume) {
  const jobKeywords = job.keywords?.length
    ? job.keywords
    : extractKeywords(`${job.title} ${job.description || ""}`);
  const resumeSkills = new Set((resume.parsed?.skills || []).map((skill) => skill.toLowerCase()));
  const strongMatches = jobKeywords.filter((keyword) => resumeSkills.has(keyword.toLowerCase()));
  const missingKeywords = jobKeywords.filter((keyword) => !resumeSkills.has(keyword.toLowerCase()));
  const score = jobKeywords.length ? Math.round((strongMatches.length / jobKeywords.length) * 100) : 0;

  return {
    score,
    strongMatches,
    missingKeywords,
    summary:
      score >= 70
        ? "Strong fit. Tailor bullets around matched skills and relevant projects."
        : "Promising lead. Address missing keywords only where your experience supports them."
  };
}

async function scoreJobWithOpenAi(job, resume) {
  const result = await createStructuredJson({
    model: env.openaiScoringModel,
    schemaName: "job_resume_match",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "integer" },
        strongMatches: {
          type: "array",
          items: { type: "string" }
        },
        missingKeywords: {
          type: "array",
          items: { type: "string" }
        },
        summary: { type: "string" }
      },
      required: ["score", "strongMatches", "missingKeywords", "summary"]
    },
    instructions:
      "You are an ATS-style internship matching assistant. Score only from evidence in the resume and job description. Do not invent experience. Return concise, candidate-useful wording.",
    input: [
      `Job title: ${job.title}`,
      `Company: ${job.company}`,
      `Location: ${job.location || "Unspecified"}`,
      `Job keywords: ${(job.keywords || []).join(", ") || "None extracted"}`,
      `Job description:\n${job.description || "No description provided."}`,
      `Resume parsed skills: ${(resume.parsed?.skills || []).join(", ") || "None extracted"}`,
      `Resume text:\n${resume.rawText || ""}`
    ].join("\n\n"),
    maxOutputTokens: 900
  });

  if (!result) return null;

  return {
    score: clampScore(result.score),
    strongMatches: normalizeStringArray(result.strongMatches),
    missingKeywords: normalizeStringArray(result.missingKeywords),
    summary: String(result.summary || "").trim() || "AI match analysis completed."
  };
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];
}

import { env } from "../config/env.js";
import { createStructuredJson, logAiError } from "./openaiClient.js";

export async function buildTailoredDraft({ job, resume }) {
  try {
    const aiDraft = await buildTailoredDraftWithOpenAi({ job, resume });
    if (aiDraft) return aiDraft;
  } catch (error) {
    logAiError("tailor-job", error);
  }

  return buildFallbackTailoredDraft({ job, resume });
}

export function buildFallbackTailoredDraft({ job, resume }) {
  const matched = job.match?.strongMatches || [];
  const missing = job.match?.missingKeywords || [];
  const projects = resume.parsed?.projects || [];

  return {
    resumeHeadline: `${job.title} candidate focused on ${matched.slice(0, 3).join(", ") || "software engineering"}`,
    bulletSuggestions: [
      ...matched.slice(0, 4).map((skill) => `Emphasize truthful experience using ${skill} in projects, coursework, or prior roles.`),
      ...projects.slice(0, 3).map((project) => `Consider surfacing this relevant project near the top: ${project}`)
    ],
    coverLetterDraft: [
      `I am excited to apply for the ${job.title} role at ${job.company}.`,
      `My background aligns with the role through ${matched.slice(0, 5).join(", ") || "software engineering fundamentals"}.`,
      "I would bring a careful, cloud-aware engineering mindset and a strong interest in building reliable user-facing systems.",
      "I have not added any unsupported claims; any missing skills should only be included if they are already true."
    ].join("\n\n"),
    guardrails: {
      doNotInvent: ["experience", "certifications", "employment dates", "production ownership", "technologies"],
      onlyAddIfTrue: missing
    }
  };
}

async function buildTailoredDraftWithOpenAi({ job, resume }) {
  const matched = job.match?.strongMatches || [];
  const missing = job.match?.missingKeywords || [];
  const result = await createStructuredJson({
    model: env.openaiTailorModel,
    schemaName: "tailored_resume_draft",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        resumeHeadline: { type: "string" },
        bulletSuggestions: {
          type: "array",
          items: { type: "string" }
        },
        coverLetterDraft: { type: "string" },
        guardrails: {
          type: "object",
          additionalProperties: false,
          properties: {
            doNotInvent: {
              type: "array",
              items: { type: "string" }
            },
            onlyAddIfTrue: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["doNotInvent", "onlyAddIfTrue"]
        }
      },
      required: ["resumeHeadline", "bulletSuggestions", "coverLetterDraft", "guardrails"]
    },
    instructions:
      "You are an expert technical recruiter and resume editor. Tailor wording only from the candidate's actual resume. Never add fake employers, dates, credentials, production ownership, or technologies not supported by the resume. Keep output concise and directly usable.",
    input: [
      `Target job: ${job.title} at ${job.company}`,
      `Location: ${job.location || "Unspecified"}`,
      `Job description:\n${job.description || "No description provided."}`,
      `Matched skills: ${matched.join(", ") || "None yet"}`,
      `Potential missing keywords: ${missing.join(", ") || "None"}`,
      `Candidate parsed projects: ${(resume.parsed?.projects || []).join(" | ") || "None extracted"}`,
      `Candidate resume:\n${resume.rawText || ""}`
    ].join("\n\n"),
    maxOutputTokens: 2200
  });

  if (!result) return null;

  return {
    resumeHeadline: String(result.resumeHeadline || "").trim() || `${job.title} candidate`,
    bulletSuggestions: normalizeStringArray(result.bulletSuggestions, 8),
    coverLetterDraft: String(result.coverLetterDraft || "").trim(),
    guardrails: {
      doNotInvent: normalizeStringArray(result.guardrails?.doNotInvent, 8),
      onlyAddIfTrue: normalizeStringArray(result.guardrails?.onlyAddIfTrue, 10)
    }
  };
}

function normalizeStringArray(value, maxItems) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, maxItems)
    : [];
}

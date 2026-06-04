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

/**
 * Deterministic, structured draft used when AI is mocked/unavailable or fails.
 * Produces polished, ATS-shaped content from the resume + match analysis only
 * (no invented facts), so the public demo still looks professional with
 * AI_PROVIDER=mock.
 */
export function buildFallbackTailoredDraft({ job, resume }) {
  const matched = job.match?.strongMatches || [];
  const missing = job.match?.missingKeywords || [];
  const parsed = resume.parsed || {};
  const skills = dedupe([...(parsed.cloudSkills || []), ...(parsed.sweSkills || []), ...(parsed.skills || [])]);
  const projects = parsed.projects || [];
  const focus = matched.slice(0, 3).join(", ") || skills.slice(0, 3).join(", ") || "software engineering";

  const experienceBullets = matched.slice(0, 5).map(
    (skill) => `Apply ${skill} experience drawn from prior projects, coursework, or roles to the ${job.title} responsibilities.`
  );
  const projectBullets = projects.slice(0, 4).map((project) => `${project} — highlight outcomes relevant to ${job.company}.`);

  return {
    resumeHeadline: `${job.title} candidate focused on ${focus}`,
    professionalSummary:
      job.match?.summary ||
      `Software engineering candidate with hands-on experience in ${focus}. Strong fit for the ${job.title} role at ${job.company}, with a focus on truthful, evidence-based qualifications.`,
    skills: skills.slice(0, 24),
    experienceBullets,
    projectBullets,
    education: parsed.education || [],
    coverLetterDraft: [
      `Dear ${job.company} Hiring Team,`,
      `I am excited to apply for the ${job.title} role at ${job.company}. My background aligns with the position through ${matched.slice(0, 5).join(", ") || focus}.`,
      "Across my projects and coursework I have focused on building reliable, well-tested software and learning cloud and backend fundamentals that map directly to this team's work.",
      "I would bring a careful, cloud-aware engineering mindset and a genuine interest in shipping user-facing systems. Every claim here is supported by my resume; I have not added unverified skills.",
      "Thank you for your time and consideration.",
      "Sincerely,",
      resume.title?.split("—")[0]?.trim() || "Candidate"
    ].join("\n\n"),
    guardrails: {
      doNotInvent: ["experience", "certifications", "employment dates", "production ownership", "technologies"],
      onlyAddIfTrue: missing
    },
    // Backward-compat for the inline panel / older consumers.
    bulletSuggestions: [...experienceBullets, ...projectBullets]
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
        professionalSummary: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        experienceBullets: { type: "array", items: { type: "string" } },
        projectBullets: { type: "array", items: { type: "string" } },
        education: { type: "array", items: { type: "string" } },
        coverLetterDraft: { type: "string" },
        guardrails: {
          type: "object",
          additionalProperties: false,
          properties: {
            doNotInvent: { type: "array", items: { type: "string" } },
            onlyAddIfTrue: { type: "array", items: { type: "string" } }
          },
          required: ["doNotInvent", "onlyAddIfTrue"]
        }
      },
      required: [
        "resumeHeadline",
        "professionalSummary",
        "skills",
        "experienceBullets",
        "projectBullets",
        "education",
        "coverLetterDraft",
        "guardrails"
      ]
    },
    instructions: [
      "You are a strict, expert ATS resume editor and technical recruiter.",
      "Rewrite and tailor ONLY from facts present in the candidate's resume. Never invent employers, dates, job titles, credentials, certifications, production ownership, metrics, or technologies the resume does not support.",
      "Prioritize the target job's keywords naturally where the resume genuinely supports them.",
      "Use strong, concise, action-led bullets. Add quantified language ONLY when the resume already provides the numbers.",
      "professionalSummary: 2-4 sentences positioning the candidate for THIS role, truthful.",
      "skills: a deduped, job-prioritized list of the candidate's real technical skills.",
      "experienceBullets: rewritten, impact-focused bullets grounded in the resume's experience/coursework.",
      "projectBullets: bullets for the candidate's real projects, surfacing job-relevant outcomes.",
      "education: the candidate's real education entries.",
      "coverLetterDraft: a polished letter with a greeting, a company-specific opening, an evidence paragraph tied to the resume, and a closing. No invented claims.",
      "guardrails.onlyAddIfTrue: job keywords the resume does NOT support; these must NOT appear in the resume/bullets, only listed here for the candidate to add if genuinely true."
    ].join(" "),
    input: [
      `Target job: ${job.title} at ${job.company}`,
      `Location: ${job.location || "Unspecified"}`,
      `Job description:\n${job.description || "No description provided."}`,
      `Matched skills (resume-supported): ${matched.join(", ") || "None yet"}`,
      `Potential missing keywords (do NOT add to resume unless true): ${missing.join(", ") || "None"}`,
      `Candidate parsed skills: ${dedupe([...(resume.parsed?.cloudSkills || []), ...(resume.parsed?.sweSkills || []), ...(resume.parsed?.skills || [])]).join(", ") || "None extracted"}`,
      `Candidate parsed projects: ${(resume.parsed?.projects || []).join(" | ") || "None extracted"}`,
      `Candidate resume:\n${resume.rawText || ""}`
    ].join("\n\n"),
    maxOutputTokens: 3000
  });

  if (!result) return null;

  const experienceBullets = normalizeStringArray(result.experienceBullets, 10);
  const projectBullets = normalizeStringArray(result.projectBullets, 8);

  return {
    resumeHeadline: String(result.resumeHeadline || "").trim() || `${job.title} candidate`,
    professionalSummary: String(result.professionalSummary || "").trim(),
    skills: normalizeStringArray(result.skills, 30),
    experienceBullets,
    projectBullets,
    education: normalizeStringArray(result.education, 8),
    coverLetterDraft: String(result.coverLetterDraft || "").trim(),
    guardrails: {
      doNotInvent: normalizeStringArray(result.guardrails?.doNotInvent, 8),
      onlyAddIfTrue: normalizeStringArray(result.guardrails?.onlyAddIfTrue, 12)
    },
    // Backward-compat for the inline panel / older consumers.
    bulletSuggestions: [...experienceBullets, ...projectBullets].slice(0, 12)
  };
}

function dedupe(list) {
  return [...new Set((list || []).map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeStringArray(value, maxItems) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, maxItems)
    : [];
}

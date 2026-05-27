export function buildTailoredDraft({ job, resume }) {
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

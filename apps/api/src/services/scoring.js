import { extractKeywords } from "./resumeParser.js";

export function scoreJobAgainstResume(job, resume) {
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

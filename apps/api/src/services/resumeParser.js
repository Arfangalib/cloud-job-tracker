const cloudTerms = [
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "lambda",
  "ecs",
  "s3",
  "cloudwatch",
  "ci/cd",
  "linux"
];

const sweTerms = [
  "javascript",
  "typescript",
  "react",
  "node",
  "express",
  "mongodb",
  "postgres",
  "python",
  "java",
  "api",
  "rest",
  "graphql",
  "testing",
  "git"
];

export function extractKeywords(text, terms = [...cloudTerms, ...sweTerms]) {
  const lower = text.toLowerCase();
  return [...new Set(terms.filter((term) => lower.includes(term.toLowerCase())))];
}

export function parseResume(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const cloudSkills = extractKeywords(rawText, cloudTerms);
  const sweSkills = extractKeywords(rawText, sweTerms);

  return {
    skills: [...new Set([...cloudSkills, ...sweSkills])],
    cloudSkills,
    sweSkills,
    projects: lines.filter((line) => /project|built|developed|implemented/i.test(line)).slice(0, 8),
    education: lines.filter((line) => /university|college|bachelor|diploma|degree/i.test(line)).slice(0, 5)
  };
}

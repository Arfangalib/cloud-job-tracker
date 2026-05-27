import { extractKeywords } from "./resumeParser.js";

export function detectSource(url = "") {
  const host = safeHost(url);
  if (host.includes("greenhouse")) return "greenhouse";
  if (host.includes("lever")) return "lever";
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("indeed")) return "indeed";
  if (host.includes("eluta")) return "eluta";
  return "manual";
}

export function needsApify(url = "") {
  return ["linkedin", "indeed", "eluta"].includes(detectSource(url));
}

export function normalizeJob(raw, fallback = {}) {
  const title = raw.title || raw.position || raw.name || fallback.title || "Imported role";
  const company = raw.company || raw.companyName || raw.organization || fallback.company || "Unknown company";
  const description = raw.description || raw.text || raw.jobDescription || "";
  const sourceUrl = raw.url || raw.applyUrl || raw.link || fallback.sourceUrl;

  return {
    source: fallback.source || detectSource(sourceUrl),
    sourceUrl,
    externalId: raw.id || raw.jobId || raw.externalId,
    title: String(title).trim(),
    company: String(company).trim(),
    location: raw.location || raw.locations?.[0]?.name || fallback.location || "Remote / Canada",
    description,
    employmentType: raw.employmentType || raw.type || "Internship / Co-op",
    remoteType: /remote/i.test(`${raw.location || ""} ${description}`) ? "remote" : "unspecified",
    deadline: raw.deadline ? new Date(raw.deadline) : undefined,
    keywords: extractKeywords(`${title} ${description}`)
  };
}

function safeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_error) {
    return "";
  }
}

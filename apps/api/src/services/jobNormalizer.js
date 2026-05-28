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
  const title = raw.title || raw.job_title || raw.position || raw.positionName || raw.name || fallback.title || "Imported role";
  const company =
    raw.company || raw.company_name || raw.companyName || raw.employer || raw.organization || fallback.company || "Unknown company";
  const description = raw.job_description_plain || raw.description || raw.job_description || raw.text || raw.jobDescription || "";
  const sourceUrl = raw.url || raw.job_url || raw.applyUrl || raw.apply_link || raw.link || fallback.sourceUrl;
  const location = raw.location || raw.job_location || raw.jobLocation || raw.locations?.[0]?.name || fallback.location || "Remote / Canada";

  return {
    source: fallback.source || detectSource(sourceUrl),
    sourceUrl,
    externalId: raw.id || raw.job_id || raw.jobId || raw.externalId,
    title: String(title).trim(),
    company: String(company).trim(),
    location: String(location).trim(),
    description,
    employmentType: raw.employmentType || raw.type || "Internship / Co-op",
    remoteType: /remote/i.test(`${location} ${description}`) ? "remote" : "unspecified",
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

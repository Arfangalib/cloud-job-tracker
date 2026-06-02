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
    postedAt: parsePostedAt(raw),
    keywords: extractKeywords(`${title} ${description}`)
  };
}

// Pull a real posting date from the many shapes scrapers/ATS APIs return.
// Falls back to undefined so the document's createdAt is used at query time.
export function parsePostedAt(raw = {}) {
  const candidates = [
    raw.postedAt,
    raw.posted_at,
    raw.postedDate,
    raw.posted_date,
    raw.datePosted,
    raw.date_posted,
    raw.listedAt,
    raw.listed_at,
    raw.publishedAt,
    raw.published_at,
    raw.updated_at, // Greenhouse
    raw.updatedAt,
    raw.createdAt, // Lever (ms epoch)
    raw.created_at
  ];
  for (const value of candidates) {
    const parsed = toDate(value);
    if (parsed) return parsed;
  }
  return undefined;
}

function toDate(value) {
  if (value == null || value === "") return undefined;
  const isDigitString = typeof value === "string" && /^\d+$/.test(value);

  if (typeof value === "number" || isDigitString) {
    const num = Number(value);
    // Only large values are plausible epochs: ms (>=1e12) or seconds (>=1e9).
    if (num >= 1e12) return validDate(new Date(num));
    if (num >= 1e9) return validDate(new Date(num * 1000));
    // Too small for an epoch. A bare year string ("2024") parses as a year;
    // a small bare number is not a real date.
    return isDigitString ? validDate(new Date(value)) : undefined;
  }
  return validDate(new Date(value));
}

function validDate(date) {
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function safeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_error) {
    return "";
  }
}

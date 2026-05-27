import { detectSource, normalizeJob } from "./jobNormalizer.js";

export async function fetchDirectJob(url) {
  const source = detectSource(url);
  if (source === "greenhouse") return fetchGreenhouseJob(url);
  if (source === "lever") return fetchLeverJob(url);
  return normalizeJob(
    {
      title: "Imported Internship / Co-op",
      company: "Imported Company",
      location: "Canada / Remote",
      description: "Imported from a direct job URL. Add details from the posting before tailoring.",
      url
    },
    { source }
  );
}

async function fetchGreenhouseJob(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const company = parts[0];
  const jobId = parts.find((part) => /^\d+$/.test(part)) || parts.at(-1);
  if (!company || !jobId) throw new Error("Could not detect Greenhouse company or job id");

  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs/${encodeURIComponent(jobId)}`
  );
  if (!response.ok) throw new Error(`Greenhouse API returned ${response.status}`);
  const job = await response.json();
  return normalizeJob(
    {
      id: job.id,
      title: job.title,
      company,
      location: job.location?.name,
      description: stripHtml(job.content || ""),
      url: job.absolute_url || url
    },
    { source: "greenhouse", sourceUrl: url }
  );
}

async function fetchLeverJob(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const company = parts[0];
  const postingId = parts[1];
  if (!company || !postingId) throw new Error("Could not detect Lever company or posting id");

  const response = await fetch(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company)}/${encodeURIComponent(postingId)}`
  );
  if (!response.ok) throw new Error(`Lever API returned ${response.status}`);
  const job = await response.json();
  return normalizeJob(
    {
      id: job.id,
      title: job.text,
      company,
      location: job.categories?.location,
      description: stripHtml(`${job.description || ""} ${job.lists?.map((list) => list.content).join(" ") || ""}`),
      url: job.hostedUrl || url
    },
    { source: "lever", sourceUrl: url }
  );
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

import { describe, expect, it } from "vitest";
import { normalizeJob, parsePostedAt } from "../src/services/jobNormalizer.js";

describe("parsePostedAt", () => {
  it("parses ISO date strings", () => {
    expect(parsePostedAt({ posted_at: "2026-05-20T10:00:00Z" }).toISOString()).toBe(
      "2026-05-20T10:00:00.000Z"
    );
  });

  it("parses millisecond epoch timestamps (Lever createdAt)", () => {
    expect(parsePostedAt({ createdAt: 1700000000000 }).getTime()).toBe(1700000000000);
  });

  it("parses second epoch timestamps", () => {
    expect(parsePostedAt({ date_posted: 1700000000 }).getTime()).toBe(1700000000 * 1000);
  });

  it("prefers explicit posted dates over update timestamps", () => {
    const date = parsePostedAt({ postedAt: "2026-01-01", updated_at: "2026-02-02" });
    expect(date.toISOString().startsWith("2026-01-01")).toBe(true);
  });

  it("returns undefined when no date field is present", () => {
    expect(parsePostedAt({})).toBeUndefined();
  });

  it("normalizeJob attaches postedAt from the raw payload", () => {
    const job = normalizeJob({
      job_title: "Cloud SWE Intern",
      company_name: "Acme",
      job_url: "https://example.com/1",
      posted_at: "2026-05-20T10:00:00Z"
    });
    expect(job.postedAt.toISOString()).toBe("2026-05-20T10:00:00.000Z");
  });
});

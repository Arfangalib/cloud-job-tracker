import { describe, expect, it } from "vitest";
import { parseResume } from "../src/services/resumeParser.js";
import { renderDocument } from "../src/services/documentRenderer.js";

const RESUME_TEXT =
  "Built a React and Node project on AWS using Docker, S3, and REST APIs. " +
  "Developed a Kubernetes deployment pipeline. BSc Computer Science, University of Test.";

const resume = { rawText: RESUME_TEXT, parsed: parseResume(RESUME_TEXT) };
const user = { name: "Ada Lovelace", email: "ada@example.com" };
const job = {
  title: "Cloud SWE Intern",
  company: "Acme Cloud",
  location: "Remote",
  match: { score: 82, summary: "Strong fit.", strongMatches: ["react", "aws"], missingKeywords: ["terraform"] }
};
const draft = {
  resumeHeadline: "Cloud SWE intern candidate with React and AWS projects",
  bulletSuggestions: ["Emphasize React project impact", "Mention AWS deployment truthfully"],
  coverLetterDraft: "I am excited to apply for the Cloud SWE Intern role.\n\nMy background aligns with React and AWS.",
  guardrails: { doNotInvent: ["certifications"], onlyAddIfTrue: ["terraform"] }
};

describe("document renderer", () => {
  it("renders an ATS resume PDF with selectable text", async () => {
    const buffer = await renderDocument({ kind: "resume", format: "pdf", draft, resume, user, job });
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renders a resume DOCX (zip/OOXML container)", async () => {
    const buffer = await renderDocument({ kind: "resume", format: "docx", draft, resume, user, job });
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK");
  });

  it("renders a cover letter PDF", async () => {
    const buffer = await renderDocument({ kind: "coverLetter", format: "pdf", draft, resume, user, job });
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renders a cover letter DOCX", async () => {
    const buffer = await renderDocument({ kind: "coverLetter", format: "docx", draft, resume, user, job });
    expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK");
  });

  it("rejects an unsupported kind/format combination", async () => {
    await expect(
      renderDocument({ kind: "resume", format: "rtf", draft, resume, user, job })
    ).rejects.toThrow(/Unsupported document/);
  });
});

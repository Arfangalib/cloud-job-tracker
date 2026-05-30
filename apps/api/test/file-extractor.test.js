import { describe, expect, it } from "vitest";
import { extractTextFromFile } from "../src/services/fileExtractor.js";

const RESUME_TEXT =
  "Senior cloud engineer. Built a React and Node project on AWS using Docker, " +
  "Kubernetes, Terraform, S3, and REST APIs. BSc Computer Science, University of Test.";

describe("resume text extraction (no DB)", () => {
  it("extracts plain text and preserves spacing", async () => {
    const text = await extractTextFromFile({
      buffer: Buffer.from(RESUME_TEXT, "utf8"),
      mimetype: "text/plain",
      originalName: "resume.txt"
    });
    expect(text).toContain("React and Node");
    expect(text).toContain("Terraform");
  });

  it("falls back to extension when mimetype is generic octet-stream", async () => {
    const text = await extractTextFromFile({
      buffer: Buffer.from(RESUME_TEXT, "utf8"),
      mimetype: "application/octet-stream",
      originalName: "resume.txt"
    });
    expect(text).toContain("AWS");
  });

  it("rejects files with too little readable text (e.g. scanned PDFs)", async () => {
    await expect(
      extractTextFromFile({
        buffer: Buffer.from("   ", "utf8"),
        mimetype: "text/plain",
        originalName: "x.txt"
      })
    ).rejects.toThrow(/Could not read enough text/);
  });

  it("rejects empty files", async () => {
    await expect(
      extractTextFromFile({ buffer: Buffer.alloc(0), mimetype: "text/plain", originalName: "x.txt" })
    ).rejects.toThrow(/empty/);
  });

  it("rejects unsupported file types", async () => {
    await expect(
      extractTextFromFile({
        buffer: Buffer.from("binary"),
        mimetype: "image/png",
        originalName: "photo.png"
      })
    ).rejects.toThrow(/Unsupported file type/);
  });
});

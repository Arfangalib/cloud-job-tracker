import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain"
]);

export const SUPPORTED_UPLOAD_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt"]);

class UnsupportedFileError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsupportedFileError";
    this.status = 400;
  }
}

/**
 * Extract plain text from an uploaded resume buffer.
 *
 * Returns the trimmed text. Throws a 400-status error for unsupported types or
 * when nothing could be extracted (e.g. a scanned/image-only PDF).
 */
export async function extractTextFromFile({ buffer, mimetype, originalName = "" }) {
  if (!buffer || !buffer.length) {
    throw new UnsupportedFileError("The uploaded file was empty.");
  }

  const dot = originalName.lastIndexOf(".");
  const ext = dot >= 0 ? originalName.toLowerCase().slice(dot) : "";
  const text = ((await extractByType({ buffer, mimetype, ext })) || "").trim();

  // Measure meaningful characters (ignoring whitespace) without mutating output.
  if (text.replace(/\s/g, "").length < 20) {
    throw new UnsupportedFileError(
      "Could not read enough text from this file. If it is a scanned or image-only PDF, paste the resume text instead."
    );
  }
  return text;
}

async function extractByType({ buffer, mimetype, ext }) {
  if (mimetype === "application/pdf" || ext === ".pdf") {
    return extractPdf(buffer);
  }
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword" ||
    ext === ".docx" ||
    ext === ".doc"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimetype === "text/plain" || ext === ".txt") {
    return buffer.toString("utf8");
  }
  throw new UnsupportedFileError("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
}

async function extractPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy().catch(() => {});
  }
}

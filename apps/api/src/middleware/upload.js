import multer from "multer";
import {
  SUPPORTED_UPLOAD_EXTENSIONS,
  SUPPORTED_UPLOAD_MIME_TYPES
} from "../services/fileExtractor.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function fileFilter(_req, file, cb) {
  const dot = file.originalname.lastIndexOf(".");
  const ext = dot >= 0 ? file.originalname.toLowerCase().slice(dot) : "";
  const mimeOk = SUPPORTED_UPLOAD_MIME_TYPES.has(file.mimetype);
  const extOk = SUPPORTED_UPLOAD_EXTENSIONS.has(ext);

  // Accept when either signal is valid; octet-stream uploads often lack a
  // precise mimetype, so the extension is a reasonable fallback.
  if (mimeOk || extOk) {
    return cb(null, true);
  }
  const error = new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
  error.status = 400;
  return cb(error);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter
});

/** Single-file resume upload under the form field "file". */
export const resumeUpload = upload.single("file");

export { MAX_UPLOAD_BYTES };

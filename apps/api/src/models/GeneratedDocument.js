import mongoose from "mongoose";

const generatedDocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", required: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume" },
    kind: { type: String, enum: ["resume", "coverLetter"], required: true },
    format: { type: String, enum: ["pdf", "docx"], required: true },
    storageKey: { type: String, required: true },
    storageDriver: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: Number,
    fileName: String,
    // Preserve the draft the document was generated from for auditability.
    draftSnapshot: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

generatedDocumentSchema.index({ userId: 1, createdAt: -1 });

export const GeneratedDocument = mongoose.model("GeneratedDocument", generatedDocumentSchema);

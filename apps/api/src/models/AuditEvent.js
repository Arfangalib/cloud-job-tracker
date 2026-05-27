import mongoose from "mongoose";

const auditEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    type: { type: String, required: true },
    ipAddress: String,
    userAgent: String,
    metadata: { type: Object, default: {} }
  },
  { timestamps: true }
);

export const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);

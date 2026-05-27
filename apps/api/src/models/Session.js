import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    userAgent: String,
    ipAddress: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: String,
    lastUsedAt: Date
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", sessionSchema);

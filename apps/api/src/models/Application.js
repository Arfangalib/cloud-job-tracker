import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", required: true },
    status: {
      type: String,
      enum: ["saved", "tailoring", "applied", "interview", "rejected", "offer"],
      default: "saved"
    },
    notes: String,
    followUpAt: Date,
    appliedAt: Date
  },
  { timestamps: true }
);

export const Application = mongoose.model("Application", applicationSchema);

import mongoose from "mongoose";

const workItemSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    payload: { type: Object, default: {} },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    runAfter: { type: Date, default: Date.now, index: true },
    lastError: String
  },
  { timestamps: true }
);

export const WorkItem = mongoose.model("WorkItem", workItemSchema);

import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost" },
    title: { type: String, required: true },
    dueAt: { type: Date, required: true, index: true },
    channel: { type: String, enum: ["email", "in-app"], default: "in-app" },
    status: { type: String, enum: ["scheduled", "sent", "cancelled"], default: "scheduled" }
  },
  { timestamps: true }
);

export const Reminder = mongoose.model("Reminder", reminderSchema);

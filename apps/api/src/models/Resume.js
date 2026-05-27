import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    rawText: { type: String, required: true },
    parsed: {
      skills: [String],
      cloudSkills: [String],
      sweSkills: [String],
      projects: [String],
      education: [String]
    },
    isPrimary: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Resume = mongoose.model("Resume", resumeSchema);

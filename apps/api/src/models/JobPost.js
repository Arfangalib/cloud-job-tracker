import mongoose from "mongoose";

const jobPostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    source: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    externalId: String,
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: String,
    description: String,
    employmentType: String,
    remoteType: String,
    deadline: Date,
    postedAt: Date,
    keywords: [String],
    match: {
      score: { type: Number, default: 0 },
      strongMatches: [String],
      missingKeywords: [String],
      summary: String
    },
    // Set when fit scoring actually runs, so a genuine 0% score isn't mistaken
    // for "never scored" (match.score defaults to 0).
    scoredAt: Date,
    status: {
      type: String,
      enum: ["saved", "tailoring", "applied", "interview", "rejected", "offer"],
      default: "saved"
    }
  },
  { timestamps: true }
);

jobPostSchema.index({ userId: 1, sourceUrl: 1 }, { unique: true });
jobPostSchema.index({ userId: 1, postedAt: -1 });
// Backs free-text job search (title/company/description/keywords).
jobPostSchema.index({ title: "text", company: "text", description: "text", keywords: "text" });

export const JobPost = mongoose.model("JobPost", jobPostSchema);

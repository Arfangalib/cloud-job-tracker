import mongoose from "mongoose";

const ingestionRunSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    source: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    mode: { type: String, enum: ["direct", "apify"], required: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending"
    },
    apifyRunId: String,
    actorId: String,
    datasetId: String,
    costEstimate: Number,
    itemsImported: { type: Number, default: 0 },
    error: String
  },
  { timestamps: true }
);

export const IngestionRun = mongoose.model("IngestionRun", ingestionRunSchema);

import { connectDb } from "./db.js";
import { IngestionRun } from "./models/IngestionRun.js";
import { JobPost } from "./models/JobPost.js";
import { Resume } from "./models/Resume.js";
import { normalizeJob } from "./services/jobNormalizer.js";
import { claimNextWorkItem, completeWorkItem, failWorkItem } from "./services/queue.js";
import { scoreJobAgainstResume } from "./services/scoring.js";
import { upsertJobs } from "./routes/jobs.js";

await connectDb();
console.log("Worker started");

async function processItem(item) {
  if (item.type === "direct-import") {
    const run = await IngestionRun.findById(item.payload.ingestionRunId);
    if (!run) throw new Error("Ingestion run not found");
    const job = normalizeJob(
      {
        title: "Imported Internship / Co-op",
        company: "Imported Company",
        location: "Canada / Remote",
        description: "Imported from a direct job URL. Add details from the posting before tailoring.",
        url: item.payload.url
      },
      { source: run.source }
    );
    const jobs = await upsertJobs(run.userId, [job]);
    run.status = "completed";
    run.itemsImported = jobs.length;
    await run.save();
    await queueScoring(run.userId, jobs);
  }

  if (item.type === "apify-results") {
    const jobs = await upsertJobs(item.payload.userId, item.payload.jobs);
    await queueScoring(item.payload.userId, jobs);
  }

  if (item.type === "score-job") {
    const [job, resume] = await Promise.all([
      JobPost.findOne({ _id: item.payload.jobId, userId: item.payload.userId }),
      Resume.findOne({ userId: item.payload.userId, isPrimary: true }).sort({ createdAt: -1 })
    ]);
    if (job && resume) {
      job.match = scoreJobAgainstResume(job, resume);
      await job.save();
    }
  }
}

async function queueScoring(userId, jobs) {
  const { enqueue } = await import("./services/queue.js");
  for (const job of jobs) {
    await enqueue("score-job", { userId: userId.toString(), jobId: job._id.toString() });
  }
}

async function loop() {
  const item = await claimNextWorkItem();
  if (!item) return setTimeout(loop, 1500);

  try {
    await processItem(item);
    await completeWorkItem(item);
  } catch (error) {
    console.error("Worker item failed", error);
    await failWorkItem(item, error);
  }
  setImmediate(loop);
}

loop();

import { WorkItem } from "../models/WorkItem.js";

export function enqueue(type, payload = {}, options = {}) {
  return WorkItem.create({
    type,
    payload,
    runAfter: options.runAfter || new Date(),
    maxAttempts: options.maxAttempts || 3
  });
}

export async function claimNextWorkItem() {
  return WorkItem.findOneAndUpdate(
    {
      status: "queued",
      runAfter: { $lte: new Date() },
      $expr: { $lt: ["$attempts", "$maxAttempts"] }
    },
    { status: "processing", $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, new: true }
  );
}

export async function completeWorkItem(item) {
  item.status = "completed";
  await item.save();
}

export async function failWorkItem(item, error) {
  item.lastError = error.message;
  item.status = item.attempts >= item.maxAttempts ? "failed" : "queued";
  item.runAfter = new Date(Date.now() + item.attempts * 5000);
  await item.save();
}

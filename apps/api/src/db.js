import mongoose from "mongoose";
import { env } from "./config/env.js";

let memoryServer;

export async function connectDb(uri = env.mongoUri) {
  mongoose.set("strictQuery", true);
  if (uri === "memory") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri);
  await ensureIndexes();
}

// Mongoose's autoIndex builds run asynchronously after connect and do not block
// queries, so the first request (e.g. a JobPost $text search) can race a
// not-yet-built index and error. Awaiting model.init() here guarantees every
// registered model's indexes exist before connectDb resolves.
async function ensureIndexes() {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

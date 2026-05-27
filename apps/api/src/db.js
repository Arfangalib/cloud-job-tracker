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
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

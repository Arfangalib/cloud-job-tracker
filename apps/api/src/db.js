import mongoose from "mongoose";
import { env } from "./config/env.js";

export async function connectDb(uri = env.mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

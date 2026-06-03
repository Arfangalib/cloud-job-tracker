import { connectDb } from "./db.js";
import { startWorker } from "./workerLoop.js";

// Standalone worker process (docker-compose / production). The API runs separately.
await connectDb();
console.log("Worker started");
startWorker();

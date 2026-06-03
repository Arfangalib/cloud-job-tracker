import { createApp } from "./server.js";
import { connectDb } from "./db.js";
import { env } from "./config/env.js";
import { startWorker } from "./workerLoop.js";

await connectDb();

const app = createApp();

// For the free-tier demo, run the worker in-process so a single service handles both
// HTTP and background work. In production the worker runs as its own service.
if (env.runWorkerInline) {
  startWorker();
  console.log("Inline worker enabled (RUN_WORKER_INLINE=true)");
}

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

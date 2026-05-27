import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env, isProduction } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimits.js";
import { authRouter } from "./routes/auth.js";
import { resumeRouter } from "./routes/resumes.js";
import { jobRouter } from "./routes/jobs.js";
import { applicationRouter } from "./routes/applications.js";
import { ingestionRouter } from "./routes/ingestionRuns.js";
import { webhookRouter } from "./routes/webhooks.js";
import { reminderRouter } from "./routes/reminders.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(apiLimiter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cloud-job-tracker-api" });
  });

  app.use("/auth", authRouter);
  app.use("/resumes", resumeRouter);
  app.use("/jobs", jobRouter);
  app.use("/applications", applicationRouter);
  app.use("/ingestion-runs", ingestionRouter);
  app.use("/reminders", reminderRouter);
  app.use("/webhooks", webhookRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({
      error: status === 500 && isProduction ? "Internal server error" : err.message
    });
  });

  return app;
}

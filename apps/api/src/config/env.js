import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const production = nodeEnv === "production";
const refreshCookieSameSite = parseSameSite(process.env.REFRESH_COOKIE_SAME_SITE);
const requestedRefreshCookieSecure = parseBoolean(process.env.REFRESH_COOKIE_SECURE, production);

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 4000),
  runWorkerInline: process.env.RUN_WORKER_INLINE === "true",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/cloud-job-tracker",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me",
  refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER || "dev_refresh_pepper_change_me",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  refreshCookieSameSite,
  refreshCookieSecure: refreshCookieSameSite === "none" ? true : requestedRefreshCookieSecure,
  apifyToken: process.env.APIFY_TOKEN || "",
  apifyJobActorId: process.env.APIFY_JOB_ACTOR_ID || "",
  apifyWebhookSecret: process.env.APIFY_WEBHOOK_SECRET || "dev_apify_webhook_secret",
  apifyPollIntervalMs: Number(process.env.APIFY_POLL_INTERVAL_MS || 15000),
  apifyPollMaxAttempts: Number(process.env.APIFY_POLL_MAX_ATTEMPTS || 40),
  publicApiUrl: process.env.PUBLIC_API_URL || "http://localhost:4000",
  aiProvider: process.env.AI_PROVIDER || "mock",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiScoringModel: process.env.OPENAI_SCORING_MODEL || "gpt-5.4-mini",
  openaiTailorModel: process.env.OPENAI_TAILOR_MODEL || "gpt-5.4",
  storageDriver: process.env.STORAGE_DRIVER || "local",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  s3Bucket: process.env.S3_BUCKET || "",
  awsRegion: process.env.AWS_REGION || "us-east-1"
};

export const isProduction = env.nodeEnv === "production";

function parseSameSite(value) {
  const normalized = (value || "strict").trim().toLowerCase();
  if (["strict", "lax", "none"].includes(normalized)) return normalized;
  throw new Error("REFRESH_COOKIE_SAME_SITE must be strict, lax, or none");
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error("REFRESH_COOKIE_SECURE must be true or false");
}

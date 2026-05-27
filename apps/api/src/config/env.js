import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/cloud-job-tracker",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me",
  refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER || "dev_refresh_pepper_change_me",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  apifyToken: process.env.APIFY_TOKEN || "",
  apifyJobActorId: process.env.APIFY_JOB_ACTOR_ID || "",
  apifyWebhookSecret: process.env.APIFY_WEBHOOK_SECRET || "dev_apify_webhook_secret",
  publicApiUrl: process.env.PUBLIC_API_URL || "http://localhost:4000",
  aiProvider: process.env.AI_PROVIDER || "mock"
};

export const isProduction = env.nodeEnv === "production";

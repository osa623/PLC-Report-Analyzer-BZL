const dotenv = require("dotenv");

// Preserve process-level env (for scripts/containers that inject runtime config).
dotenv.config();

const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  pipelineStrictAllBackends: String(process.env.PIPELINE_STRICT_ALL_BACKENDS || "false").toLowerCase() === "true",
  consolidatedPipelineMode: String(process.env.CONSOLIDATED_PIPELINE_MODE || "false").toLowerCase() === "true",
  batchPipelineConcurrency: Number(process.env.BATCH_PIPELINE_CONCURRENCY || 3),
  analyticsQualityThreshold: Number(process.env.ANALYTICS_QUALITY_THRESHOLD || 0.65),
  minRowConfidenceForAnalytics: Number(process.env.MIN_ROW_CONFIDENCE_FOR_ANALYTICS || 0.4)
};

module.exports = { env };

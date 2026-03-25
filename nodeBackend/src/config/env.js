const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  pipelineStrictAllBackends: String(process.env.PIPELINE_STRICT_ALL_BACKENDS || "false").toLowerCase() === "true",
  batchPipelineConcurrency: Number(process.env.BATCH_PIPELINE_CONCURRENCY || 3)
};

module.exports = { env };

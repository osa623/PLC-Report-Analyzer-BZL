require('dotenv').config();
const path = require('path');

module.exports = {
  port: Number(process.env.PORT || 3000),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
  extractionServiceUrl: process.env.EXTRACTION_SERVICE_URL || 'http://localhost:8001',
  analysisServiceUrl: process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8002',
  reportingServiceUrl: process.env.REPORTING_SERVICE_URL || 'http://localhost:8003',
  pipelineOrchestratorUrl: process.env.PIPELINE_ORCHESTRATOR_URL || 'http://localhost:8100',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')
};

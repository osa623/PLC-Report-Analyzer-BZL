require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/0',
  extractionServiceUrl: process.env.EXTRACTION_SERVICE_URL || 'http://localhost:8001',
  analysisServiceUrl: process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8002',
  reportingServiceUrl: process.env.REPORTING_SERVICE_URL || 'http://localhost:8003',
  uploadDir: process.env.UPLOAD_DIR || 'uploads'
};

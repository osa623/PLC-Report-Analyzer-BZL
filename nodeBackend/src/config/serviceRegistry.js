const serviceRegistry = {
  ingestion_extraction_platform:
    process.env.INGESTION_EXTRACTION_PLATFORM_URL || "http://localhost:8101",
  data_quality_intelligence_engine:
    process.env.DATA_QUALITY_INTELLIGENCE_ENGINE_URL || "http://localhost:8102",
  reporting_delivery_service:
    process.env.REPORTING_DELIVERY_SERVICE_URL || "http://localhost:8103"
};

module.exports = { serviceRegistry };

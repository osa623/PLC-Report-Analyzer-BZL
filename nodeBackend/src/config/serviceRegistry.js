const serviceRegistry = {
  document_parser: process.env.DOCUMENT_PARSER_URL || "http://localhost:8001",
  structure_detector: process.env.STRUCTURE_DETECTOR_URL || "http://localhost:8002",
  financial_statement_extractor:
    process.env.FINANCIAL_STATEMENT_EXTRACTOR_URL || "http://localhost:8003",
  balance_sheet_extractor: process.env.BALANCE_SHEET_EXTRACTOR_URL || "http://localhost:8004",
  cashflow_extractor: process.env.CASHFLOW_EXTRACTOR_URL || "http://localhost:8005",
  ratio_calculator: process.env.RATIO_CALCULATOR_URL || "http://localhost:8006",
  segment_extractor: process.env.SEGMENT_EXTRACTOR_URL || "http://localhost:8007",
  governance_extractor: process.env.GOVERNANCE_EXTRACTOR_URL || "http://localhost:8008",
  risk_extractor: process.env.RISK_EXTRACTOR_URL || "http://localhost:8009",
  esg_extractor: process.env.ESG_EXTRACTOR_URL || "http://localhost:8010",
  strategy_nlp: process.env.STRATEGY_NLP_URL || "http://localhost:8011",
  kpi_sector_engine: process.env.KPI_SECTOR_ENGINE_URL || "http://localhost:8012",
  pattern_detection: process.env.PATTERN_DETECTION_URL || "http://localhost:8013",
  report_generator: process.env.REPORT_GENERATOR_URL || "http://localhost:8014",
  comparative_analysis: process.env.COMPARATIVE_ANALYSIS_URL || "http://localhost:8015",
  aggregation_service: process.env.AGGREGATION_SERVICE_URL || "http://localhost:8019",
  validation_engine: process.env.VALIDATION_ENGINE_URL || "http://localhost:8020"
};

module.exports = { serviceRegistry };

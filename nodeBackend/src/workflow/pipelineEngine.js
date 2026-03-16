const { WorkflowState } = require("./states");

class PipelineEngine {
  constructor({ reportRepository, serviceClient, logger }) {
    this.reportRepository = reportRepository;
    this.serviceClient = serviceClient;
    this.logger = logger;
  }

  async execute({ reportId, filePath }) {
    try {
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.PARSING);
      await this.serviceClient.post("document_parser", "/parse-document", { report_id: reportId, file_path: filePath });
      await this.serviceClient.post("structure_detector", "/detect-structure", { report_id: reportId, file_path: filePath });

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.EXTRACTING);

      await Promise.all([
        this.serviceClient.post("financial_statement_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        this.serviceClient.post("balance_sheet_extractor", "/extract-balance-sheet", {
          report_id: reportId,
          file_path: filePath
        }),
        this.serviceClient.post("cashflow_extractor", "/extract-cashflow", {
          report_id: reportId,
          file_path: filePath
        }),
        this.serviceClient.post("segment_extractor", "/extract-segments", {
          report_id: reportId,
          file_path: filePath
        }),
        this.serviceClient.post("governance_extractor", "/extract-governance", {
          report_id: reportId,
          file_path: filePath
        }),
        this.serviceClient.post("risk_extractor", "/extract-risks", {
          report_id: reportId,
          file_path: filePath
        }),
        this.serviceClient.post("esg_extractor", "/extract-esg", {
          report_id: reportId,
          file_path: filePath
        })
      ]);

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.ANALYZING);

      await Promise.all([
        this.serviceClient.post("ratio_calculator", "/calculate-ratios", { report_id: reportId, file_path: filePath }),
        this.serviceClient.post("strategy_nlp", "/analyze-strategy", { report_id: reportId, file_path: filePath }),
        this.serviceClient.post("kpi_sector_engine", "/calculate-kpi", { report_id: reportId, file_path: filePath }),
        this.serviceClient.post("pattern_detection", "/detect-patterns", { report_id: reportId, file_path: filePath })
      ]);

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.GENERATING_REPORT);

      const generated = await this.serviceClient.post("report_generator", "/generate-report", {
        report_id: reportId,
        file_path: filePath
      });

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.COMPLETED);

      return generated;
    } catch (error) {
      this.logger.error({ reportId, error: error.message }, "Pipeline execution failed");
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.FAILED, error.message);
      throw error;
    }
  }
}

module.exports = { PipelineEngine };

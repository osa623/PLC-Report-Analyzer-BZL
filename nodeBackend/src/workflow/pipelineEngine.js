const { WorkflowState } = require("./states");
const { ApplicationError } = require("../utils/errors");

class PipelineEngine {
  constructor({ reportRepository, serviceClient, logger }) {
    this.reportRepository = reportRepository;
    this.serviceClient = serviceClient;
    this.logger = logger;
    this.requiredTimeoutMs = 300000;
    this.optionalTimeoutMs = 300000;
  }

  async invokeOptional(serviceName, endpoint, payload) {
    try {
      return await this.serviceClient.post(serviceName, endpoint, payload, {
        timeoutMs: this.optionalTimeoutMs
      });
    } catch (error) {
      this.logger.warn(
        {
          serviceName,
          endpoint,
          error: error.message,
          reportId: payload?.report_id
        },
        "Optional service failed; continuing pipeline"
      );
      return { status: "failed", optional: true, service: serviceName };
    }
  }

  async invokeRequired(serviceName, endpoint, payload) {
    return this.serviceClient.post(serviceName, endpoint, payload, {
      timeoutMs: this.requiredTimeoutMs
    });
  }

  async execute({ reportId, filePath }) {
    try {
      const report = await this.reportRepository.getById(reportId);
      if (!report?.sector) {
        throw new ApplicationError("Missing sector for report", 400, { reportId });
      }

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.PARSING);
      const parsed = await this.invokeRequired("document_parser", "/parse-document", {
        report_id: reportId,
        file_path: filePath
      });
      if (parsed?.status !== "parsed") {
        throw new ApplicationError("Document parsing failed", 502, { reportId, parsedStatus: parsed?.status });
      }
      await this.invokeOptional("structure_detector", "/detect-structure", {
        report_id: reportId,
        file_path: filePath
      });

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.EXTRACTING);

      const extractionResults = await Promise.allSettled([
        this.invokeOptional("financial_statement_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        this.invokeOptional("balance_sheet_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        this.invokeOptional("cashflow_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        this.invokeOptional("segment_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        this.invokeOptional("governance_extractor", "/extract-governance", {
          report_id: reportId,
          file_path: filePath
        }),
        this.invokeOptional("risk_extractor", "/extract-risk", {
          report_id: reportId,
          file_path: filePath
        }),
        this.invokeOptional("esg_extractor", "/extract-esg", {
          report_id: reportId,
          file_path: filePath
        })
      ]);

      const extractionSuccessCount = extractionResults.filter(
        (result) => result.status === "fulfilled" && result.value?.status !== "failed"
      ).length;
      if (extractionSuccessCount === 0) {
        this.logger.warn({ reportId }, "All extraction services failed; proceeding with partial pipeline data");
      }

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.ANALYZING);

      await Promise.allSettled([
        this.invokeOptional("ratio_calculator", "/calculate-ratios", { report_id: reportId, file_path: filePath }),
        this.invokeOptional("strategy_nlp", "/extract-strategy", { report_id: reportId, file_path: filePath }),
        this.invokeOptional("kpi_sector_engine", "/sector-kpis", { report_id: reportId, sector: report.sector }),
        this.invokeOptional("pattern_detection", "/detect-patterns", { report_id: reportId, file_path: filePath })
      ]);

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.GENERATING_REPORT);

      const generated = await this.invokeRequired("report_generator", "/generate-report", {
        report_id: reportId,
        file_path: filePath
      });
      if (generated?.status !== "completed") {
        throw new ApplicationError("Report generation failed", 502, {
          reportId,
          generatorStatus: generated?.status || "unknown"
        });
      }

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

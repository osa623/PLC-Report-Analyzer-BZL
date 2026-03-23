const { WorkflowState } = require("./states");
const { ApplicationError } = require("../utils/errors");

class PipelineEngine {
  constructor({ reportRepository, serviceClient, logger, strictAllBackends = false }) {
    this.reportRepository = reportRepository;
    this.serviceClient = serviceClient;
    this.logger = logger;
    this.strictAllBackends = strictAllBackends;
    this.requiredTimeoutMs = 300000;
    this.optionalTimeoutMs = 300000;
  }

  async invokeBestEffort(serviceName, endpoint, payload) {
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
        "Best-effort service failed; continuing pipeline"
      );
      return { status: "failed", bestEffort: true, service: serviceName };
    }
  }

  async invokeRequired(serviceName, endpoint, payload) {
    return this.serviceClient.post(serviceName, endpoint, payload, {
      timeoutMs: this.requiredTimeoutMs
    });
  }

  async execute({ reportId, filePath, strictAllBackends }) {
    try {
      const report = await this.reportRepository.getById(reportId);
      if (!report?.sector) {
        throw new ApplicationError("Missing sector for report", 400, { reportId });
      }

      const strictMode =
        typeof strictAllBackends === "boolean" ? strictAllBackends : this.strictAllBackends;

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.PARSING);
      const parsed = await this.invokeRequired("document_parser", "/parse-document", {
        report_id: reportId,
        file_path: filePath
      });
      if (parsed?.status !== "parsed") {
        throw new ApplicationError("Document parsing failed", 502, { reportId, parsedStatus: parsed?.status });
      }

      const invokeParticipation = strictMode
        ? this.invokeRequired.bind(this)
        : this.invokeBestEffort.bind(this);

      await invokeParticipation("structure_detector", "/detect-structure", {
        report_id: reportId,
        file_path: filePath
      });

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.EXTRACTING);

      const extractionCalls = [
        invokeParticipation("financial_statement_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("balance_sheet_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("cashflow_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("segment_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("governance_extractor", "/extract-governance", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("risk_extractor", "/extract-risk", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("esg_extractor", "/extract-esg", {
          report_id: reportId,
          file_path: filePath
        })
      ];

      if (strictMode) {
        await Promise.all(extractionCalls);
      } else {
        await Promise.allSettled(extractionCalls);
      }

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.ANALYZING);

      const analysisCalls = [
        invokeParticipation("ratio_calculator", "/calculate-ratios", { report_id: reportId, file_path: filePath }),
        invokeParticipation("strategy_nlp", "/extract-strategy", { report_id: reportId, file_path: filePath }),
        invokeParticipation("kpi_sector_engine", "/sector-kpis", { report_id: reportId, sector: report.sector }),
        invokeParticipation("pattern_detection", "/detect-patterns", { report_id: reportId, file_path: filePath })
      ];

      if (strictMode) {
        await Promise.all(analysisCalls);
      } else {
        await Promise.allSettled(analysisCalls);
      }

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

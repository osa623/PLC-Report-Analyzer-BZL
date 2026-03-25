const { WorkflowState } = require("./states");
const { ApplicationError } = require("../utils/errors");

class PipelineEngine {
  constructor({
    reportRepository,
    serviceClient,
    logger,
    strictAllBackends = false,
    analyticsQualityThreshold = 0.65
  }) {
    this.reportRepository = reportRepository;
    this.serviceClient = serviceClient;
    this.logger = logger;
    this.strictAllBackends = strictAllBackends;
    this.analyticsQualityThreshold = Number(analyticsQualityThreshold) || 0.65;
    this.requiredTimeoutMs = 300000;
    this.optionalTimeoutMs = 300000;
  }

  resolveQualityScore(validationPayload) {
    const direct = validationPayload?.overall_data_quality_score;
    if (typeof direct === "number") return direct;

    const nested = validationPayload?.quality_gate?.overall_data_quality_score;
    if (typeof nested === "number") return nested;

    const fallback = validationPayload?.metadata?.overall_data_quality_score;
    if (typeof fallback === "number") return fallback;

    return null;
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

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.STRUCTURE_DETECTED);

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
        }),
        invokeParticipation("strategy_nlp", "/extract-strategy", {
          report_id: reportId,
          file_path: filePath
        })
      ];

      if (strictMode) {
        await Promise.all(extractionCalls);
      } else {
        await Promise.allSettled(extractionCalls);
      }

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.AGGREGATING);

      await this.invokeRequired("aggregation_service", "/aggregate-report", {
        report_id: reportId
      });

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.VALIDATING);

      const validationResult = await this.invokeRequired("validation_engine", "/validate-report", {
        report_id: reportId
      });

      const overallDataQualityScore = this.resolveQualityScore(validationResult);
      if (
        typeof overallDataQualityScore === "number" &&
        overallDataQualityScore < this.analyticsQualityThreshold
      ) {
        const msg = `Low confidence: overall_data_quality_score=${overallDataQualityScore.toFixed(
          3
        )} threshold=${this.analyticsQualityThreshold.toFixed(3)}`;

        this.logger.warn({ reportId, overallDataQualityScore, threshold: this.analyticsQualityThreshold }, msg);
      }

      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.ANALYZING);

      const analysisCalls = [
        invokeParticipation("ratio_calculator", "/calculate-ratios", { report_id: reportId, file_path: filePath }),
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

      if (generated.pdf_path) {
        await this.reportRepository.updateReportPdfPath(reportId, generated.pdf_path);
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

const { WorkflowState } = require("./states");
const { ApplicationError } = require("../utils/errors");

class PipelineEngine {
  constructor({
    reportRepository,
    serviceClient,
    redisClient,
    logger,
    strictAllBackends = false,
    analyticsQualityThreshold = 0.65,
    consolidatedPipelineMode = false
  }) {
    this.reportRepository = reportRepository;
    this.serviceClient = serviceClient;
    this.redisClient = redisClient;
    this.logger = logger;
    this.strictAllBackends = strictAllBackends;
    this.consolidatedPipelineMode = consolidatedPipelineMode;
    this.analyticsQualityThreshold = Number(analyticsQualityThreshold) || 0.65;
    this.requiredTimeoutMs = 300000;
    this.optionalTimeoutMs = 300000;
  }

  // ---------------------------------------------------------------------------
  // Stage metadata helpers
  // ---------------------------------------------------------------------------

  _stagesKey(reportId) {
    return `report:${reportId}:pipeline_stages`;
  }

  async _initStages(reportId) {
    const stageNames = [
      "UPLOAD", "PARSING", "STRUCTURE", "EXTRACTION",
      "AGGREGATION", "VALIDATION", "ANALYTICS", "REPORT"
    ];
    const stages = {};
    for (const name of stageNames) {
      stages[name] = {
        status: name === "UPLOAD" ? "completed" : "pending",
        start_time: name === "UPLOAD" ? new Date().toISOString() : null,
        end_time: name === "UPLOAD" ? new Date().toISOString() : null,
        duration_ms: name === "UPLOAD" ? 0 : null,
        error: null
      };
    }
    await this.redisClient.setEx(
      this._stagesKey(reportId),
      7200,
      JSON.stringify(stages)
    );
    return stages;
  }

  async _updateStage(reportId, stageName, updates) {
    try {
      const raw = await this.redisClient.get(this._stagesKey(reportId));
      const stages = raw ? JSON.parse(raw) : {};
      stages[stageName] = { ...(stages[stageName] || {}), ...updates };
      await this.redisClient.setEx(
        this._stagesKey(reportId),
        7200,
        JSON.stringify(stages)
      );
    } catch (err) {
      this.logger.warn({ reportId, stageName, error: err.message }, "Failed to update stage metadata");
    }
  }

  async _startStage(reportId, stageName) {
    await this._updateStage(reportId, stageName, {
      status: "running",
      start_time: new Date().toISOString(),
      end_time: null,
      duration_ms: null,
      error: null
    });
  }

  async _completeStage(reportId, stageName, startTime) {
    const endTime = Date.now();
    await this._updateStage(reportId, stageName, {
      status: "completed",
      end_time: new Date(endTime).toISOString(),
      duration_ms: endTime - startTime
    });
  }

  async _failStage(reportId, stageName, errorMessage, startTime) {
    const endTime = Date.now();
    await this._updateStage(reportId, stageName, {
      status: "failed",
      end_time: new Date(endTime).toISOString(),
      duration_ms: startTime ? endTime - startTime : null,
      error: errorMessage
    });
  }

  async _skipStage(reportId, stageName, reason) {
    await this._updateStage(reportId, stageName, {
      status: "skipped",
      error: reason || "Skipped due to low confidence"
    });
  }

  // ---------------------------------------------------------------------------
  // Service invocation
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Main pipeline execution
  // ---------------------------------------------------------------------------

  async executeConsolidated({ reportId, filePath, strictMode, report }) {
    // -----------------------------------------------------------------------
    // STAGE: PARSING + STRUCTURE + EXTRACTION (handled in consolidated service)
    // -----------------------------------------------------------------------
    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.PARSING);
    await this._startStage(reportId, "PARSING");
    const parseStart = Date.now();

    await this.invokeRequired("ingestion_extraction_platform", "/run-ingestion-extraction", {
      report_id: reportId,
      file_path: filePath,
      strict_mode: strictMode
    });

    await this._completeStage(reportId, "PARSING", parseStart);

    await this._startStage(reportId, "STRUCTURE");
    const structStart = Date.now();
    await this._completeStage(reportId, "STRUCTURE", structStart);
    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.STRUCTURE_DETECTED);

    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.EXTRACTING);
    await this._startStage(reportId, "EXTRACTION");
    const extractStart = Date.now();
    await this._completeStage(reportId, "EXTRACTION", extractStart);

    // -----------------------------------------------------------------------
    // STAGE: AGGREGATION + VALIDATION + ANALYTICS (handled in consolidated service)
    // -----------------------------------------------------------------------
    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.AGGREGATING);
    await this._startStage(reportId, "AGGREGATION");
    const aggStart = Date.now();

    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.VALIDATING);
    await this._startStage(reportId, "VALIDATION");
    const valStart = Date.now();

    const qualityRun = await this.invokeRequired(
      "data_quality_intelligence_engine",
      "/run-quality-intelligence",
      {
        report_id: reportId,
        file_path: filePath,
        sector: report.sector,
        strict_mode: strictMode
      }
    );

    await this._completeStage(reportId, "AGGREGATION", aggStart);
    await this._completeStage(reportId, "VALIDATION", valStart);

    const overallDataQualityScore =
      this.resolveQualityScore(qualityRun?.validation || qualityRun) ??
      qualityRun?.overall_data_quality_score ??
      null;

    if (qualityRun?.status === "low_confidence" || (
      typeof overallDataQualityScore === "number" &&
      overallDataQualityScore < this.analyticsQualityThreshold
    )) {
      const msg = `Low confidence: overall_data_quality_score=${Number(overallDataQualityScore).toFixed(
        3
      )} threshold=${this.analyticsQualityThreshold.toFixed(3)}`;

      await this._skipStage(reportId, "ANALYTICS", msg);
      await this._skipStage(reportId, "REPORT", msg);
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.LOW_CONFIDENCE);

      return {
        status: "low_confidence",
        report_id: reportId,
        workflow_state: WorkflowState.LOW_CONFIDENCE,
        overall_data_quality_score: overallDataQualityScore,
        quality_threshold: this.analyticsQualityThreshold,
        message: msg
      };
    }

    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.ANALYZING);
    await this._startStage(reportId, "ANALYTICS");
    const analyticsStart = Date.now();
    await this._completeStage(reportId, "ANALYTICS", analyticsStart);

    // -----------------------------------------------------------------------
    // STAGE: REPORT GENERATION
    // -----------------------------------------------------------------------
    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.GENERATING_REPORT);
    await this._startStage(reportId, "REPORT");
    const reportStart = Date.now();

    const generated = await this.invokeRequired("reporting_delivery_service", "/run-report", {
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

    await this._completeStage(reportId, "REPORT", reportStart);
    await this.reportRepository.updateWorkflowState(reportId, WorkflowState.COMPLETED);

    return {
      ...generated,
      status: "completed",
      report_id: reportId,
      workflow_state: WorkflowState.COMPLETED,
      overall_data_quality_score: overallDataQualityScore
    };
  }

  async execute({ reportId, filePath, strictAllBackends }) {
    try {
      const report = await this.reportRepository.getById(reportId);
      if (!report?.sector) {
        throw new ApplicationError("Missing sector for report", 400, { reportId });
      }

      const strictMode =
        typeof strictAllBackends === "boolean" ? strictAllBackends : this.strictAllBackends;

      if (this.consolidatedPipelineMode) {
        await this._initStages(reportId);
        return this.executeConsolidated({
          reportId,
          filePath,
          strictMode,
          report
        });
      }

      const invokeParticipation = strictMode
        ? this.invokeRequired.bind(this)
        : this.invokeBestEffort.bind(this);

      // Initialize stage metadata
      await this._initStages(reportId);

      // -----------------------------------------------------------------------
      // STAGE: PARSING
      // -----------------------------------------------------------------------
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.PARSING);
      await this._startStage(reportId, "PARSING");
      const parseStart = Date.now();

      const parsed = await this.invokeRequired("document_parser", "/parse-document", {
        report_id: reportId,
        file_path: filePath
      });
      if (parsed?.status !== "parsed") {
        throw new ApplicationError("Document parsing failed", 502, { reportId, parsedStatus: parsed?.status });
      }

      await this._completeStage(reportId, "PARSING", parseStart);

      // -----------------------------------------------------------------------
      // STAGE: STRUCTURE DETECTION
      // -----------------------------------------------------------------------
      await this._startStage(reportId, "STRUCTURE");
      const structStart = Date.now();

      await this.invokeRequired("structure_detector", "/detect-structure", {
        report_id: reportId,
        file_path: filePath
      });

      await this._completeStage(reportId, "STRUCTURE", structStart);
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.STRUCTURE_DETECTED);

      // -----------------------------------------------------------------------
      // STAGE: EXTRACTION (parallel, all extractors)
      // -----------------------------------------------------------------------
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.EXTRACTING);
      await this._startStage(reportId, "EXTRACTION");
      const extractStart = Date.now();

      const extractionCalls = [
        invokeParticipation("income_statement_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("balance_sheet_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("cashflow_statement_extractor", "/extract-financials", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("income_notes_extractor", "/extract-financials", {
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

      // Always use allSettled — we want ALL extractors to finish before proceeding
      const extractionResults = await Promise.allSettled(extractionCalls);

      // In strict mode, check for critical failures
      if (strictMode) {
        const failures = extractionResults.filter(r => r.status === "rejected");
        if (failures.length > 0) {
          const failMsg = failures.map(f => f.reason?.message || "Unknown").join("; ");
          this.logger.error({ reportId, failMsg }, "Strict-mode extraction failures");
        }
      }

      await this._completeStage(reportId, "EXTRACTION", extractStart);

      // -----------------------------------------------------------------------
      // STAGE: AGGREGATION (mandatory, blocking)
      // -----------------------------------------------------------------------
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.AGGREGATING);
      await this._startStage(reportId, "AGGREGATION");
      const aggStart = Date.now();

      await this.invokeRequired("aggregation_service", "/aggregate-report", {
        report_id: reportId
      });

      await this._completeStage(reportId, "AGGREGATION", aggStart);

      // -----------------------------------------------------------------------
      // STAGE: VALIDATION (mandatory, blocking)
      // -----------------------------------------------------------------------
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.VALIDATING);
      await this._startStage(reportId, "VALIDATION");
      const valStart = Date.now();

      const validationResult = await this.invokeRequired("validation_engine", "/validate-report", {
        report_id: reportId
      });

      await this._completeStage(reportId, "VALIDATION", valStart);

      // -----------------------------------------------------------------------
      // QUALITY GATE — enforce LOW_CONFIDENCE terminal state
      // -----------------------------------------------------------------------
      const overallDataQualityScore = this.resolveQualityScore(validationResult);

      if (
        typeof overallDataQualityScore === "number" &&
        overallDataQualityScore < this.analyticsQualityThreshold
      ) {
        const msg = `Low confidence: overall_data_quality_score=${overallDataQualityScore.toFixed(
          3
        )} threshold=${this.analyticsQualityThreshold.toFixed(3)}`;

        this.logger.warn({ reportId, overallDataQualityScore, threshold: this.analyticsQualityThreshold }, msg);

        // ENFORCED: Skip analytics and report generation
        await this._skipStage(reportId, "ANALYTICS", msg);
        await this._skipStage(reportId, "REPORT", msg);
        await this.reportRepository.updateWorkflowState(reportId, WorkflowState.LOW_CONFIDENCE);

        return {
          status: "low_confidence",
          report_id: reportId,
          workflow_state: WorkflowState.LOW_CONFIDENCE,
          overall_data_quality_score: overallDataQualityScore,
          quality_threshold: this.analyticsQualityThreshold,
          message: msg
        };
      }

      // -----------------------------------------------------------------------
      // STAGE: ANALYTICS (parallel, confidence-aware)
      // -----------------------------------------------------------------------
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.ANALYZING);
      await this._startStage(reportId, "ANALYTICS");
      const analyticsStart = Date.now();

      const analysisCalls = [
        invokeParticipation("ratio_calculator", "/calculate-ratios", {
          report_id: reportId,
          file_path: filePath
        }),
        invokeParticipation("kpi_sector_engine", "/sector-kpis", {
          report_id: reportId,
          sector: report.sector
        }),
        invokeParticipation("pattern_detection", "/detect-patterns", {
          report_id: reportId,
          file_path: filePath
        })
      ];

      await Promise.allSettled(analysisCalls);

      await this._completeStage(reportId, "ANALYTICS", analyticsStart);

      // -----------------------------------------------------------------------
      // STAGE: REPORT GENERATION
      // -----------------------------------------------------------------------
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.GENERATING_REPORT);
      await this._startStage(reportId, "REPORT");
      const reportStart = Date.now();

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

      await this._completeStage(reportId, "REPORT", reportStart);
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.COMPLETED);

      return {
        ...generated,
        status: "completed",
        report_id: reportId,
        workflow_state: WorkflowState.COMPLETED,
        overall_data_quality_score: overallDataQualityScore
      };
    } catch (error) {
      this.logger.error({ reportId, error: error.message }, "Pipeline execution failed");
      await this.reportRepository.updateWorkflowState(reportId, WorkflowState.FAILED, error.message);

      // Mark any running stage as failed
      try {
        const raw = await this.redisClient.get(this._stagesKey(reportId));
        if (raw) {
          const stages = JSON.parse(raw);
          for (const [name, stage] of Object.entries(stages)) {
            if (stage.status === "running") {
              stages[name] = {
                ...stage,
                status: "failed",
                end_time: new Date().toISOString(),
                error: error.message
              };
            }
          }
          await this.redisClient.setEx(
            this._stagesKey(reportId),
            7200,
            JSON.stringify(stages)
          );
        }
      } catch (_) {
        // best-effort stage cleanup
      }

      throw error;
    }
  }
}

module.exports = { PipelineEngine };

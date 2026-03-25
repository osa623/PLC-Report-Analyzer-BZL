const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class ReportService {
  constructor({
    reportRepository,
    companyRepository,
    pipelineEngine,
    uploadDir,
    serviceClient,
    redisClient,
    batchPipelineConcurrency = 3
  }) {
    this.reportRepository = reportRepository;
    this.companyRepository = companyRepository;
    this.pipelineEngine = pipelineEngine;
    this.uploadDir = uploadDir;
    this.serviceClient = serviceClient;
    this.redisClient = redisClient;
    this.batchPipelineConcurrency = Math.max(1, Number(batchPipelineConcurrency) || 1);
  }

  // --- Single Report Upload & Analysis ---
  async uploadAndAnalyze({ file, company }) {
    // If multer diskStorage is used, file.path is the location. 
    // If we want to use our own naming convention or path, we can move/rename it, 
    // but for now let's assume valid file on disk.

    if (!file || !file.path) {
        throw new Error("File upload failed or missing.");
    }

    const companyRecord = await this.companyRepository.upsertCompany(company);

    const report = await this.reportRepository.createReport({
      companyId: companyRecord.id,
      filePath: file.path
    });

    // Execute the analysis pipeline
    // Note: The pipeline engine likely expects an absolute path.
    const result = await this.pipelineEngine.execute({
      reportId: report.id,
      filePath: file.path
    });

    const latestReport = await this.reportRepository.getById(report.id);

    return {
      report: latestReport || report,
      generatedReport: result
    };
  }

  // --- Batch Upload & Analysis ---
  async batchUploadAndAnalyze({ batchId, files, company }) {
    // 1. Initiate tracking structure
    const initResult = await this.initiateBatch({ batchId, files, company });
    
    // 2. Start background processing
    this.processBatch({ batchId, reports: initResult.reports, company })
      .catch(err => console.error(`Batch processing background error for ${batchId}:`, err));

    return initResult;
  }

  async initiateBatch({ batchId, files, company }) {
    // Ensure upload directory structure (though multer likely handled saving)
    if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    const companyRecord = await this.companyRepository.upsertCompany(company);
    const reports = [];

    // 'files' array comes from multer. Files are already on disk.
    for (const file of files) {
      // Create DB entry for each report
      const report = await this.reportRepository.createReport({
        companyId: companyRecord.id,
        filePath: file.path // Should use the path provided by multer
      });

      reports.push({
        report,
        originalName: file.originalname,
        targetPath: file.path
      });
    }

    // Initialize batch status in Redis
    const initialStatus = {
      batchId,
      status: "processing",
      total: reports.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      lowConfidence: 0,
      reports: reports.map(r => ({
        fileName: r.originalName,
        status: "pending",
        reportId: r.report.id
      }))
    };

    await this.redisClient.setEx(
      `batch:${batchId}`, 
      3600, // Expires in 1 hour
      JSON.stringify(initialStatus)
    );

    return { 
      batchId, 
      message: "Batch upload initiated", 
      reports 
    };
  }

  async processBatch({ batchId, reports, company }) {
    const workerCount = this.batchPipelineConcurrency;
    let nextFileIndex = 0;
    
    // Tracking results for final output
    const reportResults = new Array(reports.length);
    const completedReportIds = new Array(reports.length);

    // Initial Progress Update helper
    const updateBatchProgress = async (index, status, result = null) => {
        const currentData = await this.redisClient.get(`batch:${batchId}`);
        if (!currentData) return;

        const batchState = JSON.parse(currentData);
        batchState.reports[index].status = status;
        
        if (status === 'completed') {
            batchState.succeeded++;
            batchState.processed++;
            // Optionally store result summary if needed, but keep redis object lean
        } else if (status === 'low_confidence') {
          batchState.lowConfidence++;
          batchState.processed++;
        } else if (status === 'failed') {
            batchState.failed++;
            batchState.processed++;
        }

        if (batchState.processed === batchState.total) {
            batchState.status = "completed";
            // Trigger PDF aggregation effectively at the end
        }
        
        await this.redisClient.setEx(`batch:${batchId}`, 3600, JSON.stringify(batchState));
    };


    const processFile = async (item, index) => {
      try {
        await updateBatchProgress(index, "processing", null);

        // Execute Pipeline
        const result = await this.pipelineEngine.execute({
          reportId: item.report.id,
          filePath: item.targetPath,
          strictAllBackends: false
        });

        const isLowConfidence = result?.status === "low_confidence";

        // Cleanup intermediate PDF if generated, to save space (since we make a big batch PDF later)
        this.cleanupSingleReportPdf(result);

        reportResults[index] = {
          report: item.report,
          generatedReport: result,
          status: isLowConfidence ? "low_confidence" : "completed",
          fileName: item.originalName
        };
        if (!isLowConfidence) {
          completedReportIds[index] = item.report.id;
        }
        
        await updateBatchProgress(index, isLowConfidence ? "low_confidence" : "completed", result);

      } catch (error) {
        console.error(`Error processing file ${item.originalName}:`, error);
        reportResults[index] = {
          report: item.report,
          generatedReport: null,
          status: "failed",
          fileName: item.originalName,
          error: error.message
        };
         await updateBatchProgress(index, "failed", null);
      }
    };

    // Worker Pool Implementation
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextFileIndex++; // Atomically increment
        if (currentIndex >= reports.length) {
          return;
        }
        await processFile(reports[currentIndex], currentIndex);
      }
    });

    // Wait for all workers to finish
    await Promise.all(workers);

    // Final Step: Generate Batched PDF Report
    await this.finalizeBatchReport(batchId, completedReportIds.filter(Boolean), company);
  }

  async finalizeBatchReport(batchId, completedReportIds, company) {
    if (completedReportIds.length === 0) return;

    // Call report_generator service to merge/create batch PDF
    const batchPdfPath = await this.buildBatchPdf({ batchId, company });

    // Update Redis with final link
    const currentData = await this.redisClient.get(`batch:${batchId}`);
    if (currentData) {
        const batchState = JSON.parse(currentData);
        batchState.pdfUrl = batchPdfPath; // or download link
        await this.redisClient.setEx(`batch:${batchId}`, 3600, JSON.stringify(batchState));
    }
  }

  // --- Helpers ---

  async buildBatchPdf({ batchId, company }) {
    try {
      // Assuming 'report_generator' service handles this route
      const pdfResult = await this.serviceClient.post(
        "report_generator",
        "/generate-batch-report",
        { batch_id: batchId, company },
        { timeoutMs: 300000 } // 5 min timeout
      );
      return pdfResult?.pdf_path || null;
    } catch (error) {
      console.error("Batch PDF generation failed:", error.message);
      return null;
    }
  }

  cleanupSingleReportPdf(generatedReport) {
    const pdfPath = generatedReport?.pdf_path;
    if (!pdfPath) return;

    try {
      if (fs.existsSync(pdfPath)) {
        // fs.unlinkSync(pdfPath); // Keep partial reports for download
        console.log(`Kept intermediate PDF for report: ${pdfPath}`);
      }
    } catch (error) {
      console.warn("Unable to remove single-report PDF during batch cleanup:", error.message);
    }
  }

  async getBatchResult(batchId) {
    const data = await this.redisClient.get(`batch:${batchId}`);
    return data ? JSON.parse(data) : null;
  }

  async getReport(reportId) {
      const report = await this.reportRepository.getById(reportId);
      if (!report) {
        return null;
      }

      const stageKeys = {
        raw: `report:${reportId}`,
        cleaned: `report:${reportId}:canonical_raw`,
        validated: `report:${reportId}:canonical_validated`,
        ratios: `report:${reportId}:ratios`,
        sectorKpis: `report:${reportId}:sector_kpis`,
        patterns: `report:${reportId}:patterns`,
        governance: `report:${reportId}:governance`,
        risk: `report:${reportId}:risk`,
        esg: `report:${reportId}:esg`,
        strategy: `report:${reportId}:strategy`,
        finalReport: `report:${reportId}:final_report`,
        chunks: `report:${reportId}:document_chunks`,
        structure: `report:${reportId}:structure`
      };

      const dataViews = {
        raw_data: await this.readRedisJson(stageKeys.raw),
        cleaned_data: await this.readRedisJson(stageKeys.cleaned),
        validated_data: await this.readRedisJson(stageKeys.validated)
      };

      const analytics = {
        ratios: await this.readRedisJson(stageKeys.ratios),
        sector_kpis: await this.readRedisJson(stageKeys.sectorKpis),
        patterns: await this.readRedisJson(stageKeys.patterns)
      };

      const narratives = {
        governance: await this.readRedisJson(stageKeys.governance),
        risk: await this.readRedisJson(stageKeys.risk),
        esg: await this.readRedisJson(stageKeys.esg),
        strategy: await this.readRedisJson(stageKeys.strategy)
      };

      const validated = dataViews.validated_data || {};
      const validationSummary = validated.validation_summary || validated.quality_gate || null;
      const overallDataQualityScore =
        validated.overall_data_quality_score ??
        validated.quality_gate?.overall_data_quality_score ??
        null;

      return {
        ...report,
        pipeline_tracker: this.buildPipelineTracker(report.workflow_state, {
          hasChunks: !!(await this.readRedisJson(stageKeys.chunks)),
          hasStructure: !!(await this.readRedisJson(stageKeys.structure)),
          hasRaw: !!dataViews.raw_data,
          hasCanonicalRaw: !!dataViews.cleaned_data,
          hasValidated: !!dataViews.validated_data,
          hasAnalytics: !!(analytics.ratios || analytics.sector_kpis || analytics.patterns),
          hasFinalReport: !!(await this.readRedisJson(stageKeys.finalReport)) || !!report.pdf_path
        }),
        data_views: dataViews,
        confidence: {
          overall_data_quality_score: overallDataQualityScore
        },
        validation: {
          summary: validationSummary,
          errors: validated.error_catalog || validated.validation_errors || [],
          missing_values: validated.missing_value_index || [],
          confidence_distribution: validated.confidence_distribution || null
        },
        analytics,
        narratives
      };
  }

  async readRedisJson(key) {
    const raw = await this.redisClient.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return { raw_value: raw };
    }
  }

  buildPipelineTracker(workflowState, dataPresence) {
    const stageOrder = [
      "UPLOAD",
      "PARSING",
      "STRUCTURE",
      "EXTRACTION",
      "AGGREGATION",
      "VALIDATION",
      "ANALYTICS",
      "REPORT"
    ];

    const stateIndex = {
      UPLOADED: 0,
      PARSING: 1,
      STRUCTURE_DETECTED: 2,
      EXTRACTING: 3,
      AGGREGATING: 4,
      VALIDATING: 5,
      LOW_CONFIDENCE: 5,
      ANALYZING: 6,
      GENERATING_REPORT: 7,
      COMPLETED: 7,
      FAILED: -1
    };

    const idx = stateIndex[workflowState] ?? 0;

    const statusFor = (targetIdx, hasData = false) => {
      if (workflowState === "FAILED" && targetIdx >= Math.max(0, idx)) return "failed";
      if (hasData || idx > targetIdx) return "completed";
      if (idx === targetIdx) return "running";
      return "pending";
    };

    return stageOrder.map((stage, targetIdx) => {
      let hasData = false;
      if (stage === "PARSING") hasData = dataPresence.hasChunks;
      if (stage === "STRUCTURE") hasData = dataPresence.hasStructure;
      if (stage === "EXTRACTION") hasData = dataPresence.hasRaw;
      if (stage === "AGGREGATION") hasData = dataPresence.hasCanonicalRaw;
      if (stage === "VALIDATION") hasData = dataPresence.hasValidated;
      if (stage === "ANALYTICS") hasData = dataPresence.hasAnalytics;
      if (stage === "REPORT") hasData = dataPresence.hasFinalReport;
      if (stage === "UPLOAD") hasData = true;

      let status = statusFor(targetIdx, hasData);
      if (workflowState === "LOW_CONFIDENCE" && (stage === "ANALYTICS" || stage === "REPORT")) {
        status = "skipped";
      }

      return {
        stage,
        status
      };
    });
  }
}

module.exports = { ReportService };

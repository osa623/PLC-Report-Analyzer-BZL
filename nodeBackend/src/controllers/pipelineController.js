class PipelineController {
  constructor({ redisClient, reportRepository }) {
    this.redisClient = redisClient;
    this.reportRepository = reportRepository;
  }

  async _readRedisJson(key) {
    const raw = await this.redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return { raw_value: raw };
    }
  }

  async _getReport(reportId) {
    return this.reportRepository.getById(reportId);
  }

  /** GET /pipeline/:reportId/stages */
  async getStages(req, res) {
    const { reportId } = req.params;
    const report = await this._getReport(reportId);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const stagesData = await this._readRedisJson(`report:${reportId}:pipeline_stages`);

    const stageOrder = [
      "UPLOAD", "PARSING", "STRUCTURE", "EXTRACTION",
      "AGGREGATION", "VALIDATION", "ANALYTICS", "REPORT"
    ];

    // Build structured stages array from Redis data or fallback from workflow_state
    let stages;
    if (stagesData && typeof stagesData === "object") {
      stages = stageOrder.map(name => ({
        stage: name,
        ...(stagesData[name] || { status: "pending" })
      }));
    } else {
      // Fallback: derive from workflow_state
      const stateIndex = {
        UPLOADED: 0, PARSING: 1, STRUCTURE_DETECTED: 2, EXTRACTING: 3,
        AGGREGATING: 4, VALIDATING: 5, LOW_CONFIDENCE: 5,
        ANALYZING: 6, GENERATING_REPORT: 7, COMPLETED: 7, FAILED: -1
      };
      const idx = stateIndex[report.workflow_state] ?? 0;
      stages = stageOrder.map((name, i) => {
        let status = "pending";
        if (report.workflow_state === "FAILED" && i >= Math.max(0, idx)) status = "failed";
        else if (i < idx || (i === 0)) status = "completed";
        else if (i === idx) status = "running";
        if (report.workflow_state === "LOW_CONFIDENCE" && (name === "ANALYTICS" || name === "REPORT")) {
          status = "skipped";
        }
        return { stage: name, status };
      });
    }

    return res.status(200).json({
      report_id: reportId,
      workflow_state: report.workflow_state,
      company: report.name || report.symbol || null,
      sector: report.sector || null,
      stages
    });
  }

  /** GET /pipeline/:reportId/raw */
  async getRaw(req, res) {
    const { reportId } = req.params;
    const report = await this._getReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const data = await this._readRedisJson(`report:${reportId}`);
    const narratives = {
      governance: await this._readRedisJson(`report:${reportId}:governance`),
      risk: await this._readRedisJson(`report:${reportId}:risk`),
      esg: await this._readRedisJson(`report:${reportId}:esg`),
      strategy: await this._readRedisJson(`report:${reportId}:strategy`)
    };

    return res.status(200).json({
      report_id: reportId,
      financial_data: data,
      narratives
    });
  }

  /** GET /pipeline/:reportId/canonical */
  async getCanonical(req, res) {
    const { reportId } = req.params;
    const report = await this._getReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const data = await this._readRedisJson(`report:${reportId}:canonical_raw`);
    return res.status(200).json({
      report_id: reportId,
      canonical_raw: data
    });
  }

  /** GET /pipeline/:reportId/validated */
  async getValidated(req, res) {
    const { reportId } = req.params;
    const report = await this._getReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const data = await this._readRedisJson(`report:${reportId}:canonical_validated`);
    return res.status(200).json({
      report_id: reportId,
      validated: data
    });
  }

  /** GET /pipeline/:reportId/analytics */
  async getAnalytics(req, res) {
    const { reportId } = req.params;
    const report = await this._getReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const ratios = await this._readRedisJson(`report:${reportId}:ratios`);
    const sectorKpis = await this._readRedisJson(`report:${reportId}:sector_kpis`);
    const patterns = await this._readRedisJson(`report:${reportId}:patterns`);

    return res.status(200).json({
      report_id: reportId,
      ratios,
      sector_kpis: sectorKpis,
      patterns
    });
  }

  /** GET /pipeline/:reportId/errors */
  async getErrors(req, res) {
    const { reportId } = req.params;
    const report = await this._getReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });

    const validated = await this._readRedisJson(`report:${reportId}:canonical_validated`);

    const errorCatalog = validated?.error_catalog || [];
    const missingValues = validated?.missing_value_index || [];
    const validationSummary = validated?.validation_summary || null;
    const confidenceDistribution = validated?.confidence_distribution || null;

    // Extract row-level warnings (rows below moderate confidence)
    const weakRows = (validated?.validated_rows || [])
      .filter(r => (r.confidence_score || 0) < 0.5)
      .map(r => ({
        row_id: r.row_id,
        canonical_label: r.canonical_label,
        confidence_score: r.confidence_score,
        flags: r.validation_flags || []
      }));

    return res.status(200).json({
      report_id: reportId,
      error_catalog: errorCatalog,
      missing_values: missingValues,
      validation_summary: validationSummary,
      confidence_distribution: confidenceDistribution,
      weak_data_entries: weakRows,
      total_errors: errorCatalog.length,
      total_missing: missingValues.length,
      total_weak: weakRows.length
    });
  }
}

module.exports = { PipelineController };

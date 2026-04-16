const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const upload = require('../utils/upload');
const { getRedis } = require('../services/redisClient');
const { triggerExtract, triggerAnalyze, triggerGenerateReport } = require('../services/pipelineClient');

const router = Router();

function parseJson(raw, fallback = null) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeStatus(status) {
  if (status === 'completed' || status === 'running' || status === 'failed' || status === 'skipped') {
    return status;
  }
  return 'pending';
}

function buildValidatedRows(validated = null) {
  const financialStatements = validated?.financial_statements;
  if (!financialStatements || typeof financialStatements !== 'object') {
    return [];
  }

  const statementTypeByKey = {
    income_statement: 'income_statement',
    balance_sheet: 'balance_sheet',
    cashflow: 'cashflow_statement',
    equity: 'equity_statement',
  };

  const rows = [];
  Object.entries(statementTypeByKey).forEach(([key, statementType]) => {
    const items = Array.isArray(financialStatements[key]) ? financialStatements[key] : [];
    items.forEach((item, index) => {
      rows.push({
        row_id: `${statementType}-${index}`,
        canonical_label: item?.label || 'unknown',
        original_label: item?.label || 'unknown',
        value: typeof item?.value === 'number' ? item.value : Number(item?.value || 0),
        year: item?.period || null,
        statement_type: statementType,
        confidence_score: 0.9,
        page_number: null,
      });
    });
  });

  return rows;
}

function deriveQualityScore(validatedRows = [], validationIssues = [], deterministicChecks = {}) {
  if (!Array.isArray(validatedRows) || validatedRows.length === 0) {
    return 0;
  }

  const avgRowConfidence = validatedRows.reduce((acc, row) => acc + (row.confidence_score || 0), 0) / validatedRows.length;
  const issuePenalty = Math.min((validationIssues.length || 0) * 0.04, 0.4);
  const checks = Object.values(deterministicChecks || {});
  const passedChecks = checks.filter(Boolean).length;
  const checkBonus = checks.length > 0 ? (passedChecks / checks.length) * 0.1 : 0;
  return Math.max(0, Math.min(1, avgRowConfidence - issuePenalty + checkBonus));
}

function mapLegacyStages(stageState = {}, hasUpload = false, artifacts = {}) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';

  const parsingStatus =
    extraction === 'failed'
      ? 'failed'
      : artifacts.hasCanonicalRaw
      ? 'completed'
      : normalizeStatus(extraction);

  const structureStatus = parsingStatus;

  const extractionStatus =
    extraction === 'failed'
      ? 'failed'
      : artifacts.hasCanonicalRaw
      ? 'completed'
      : normalizeStatus(extraction);

  const aggregationStatus =
    analysis === 'failed'
      ? 'failed'
      : artifacts.hasCanonicalValidated
      ? 'completed'
      : analysis === 'running'
      ? 'running'
      : 'pending';

  const validationStatus =
    analysis === 'failed'
      ? 'failed'
      : artifacts.hasCanonicalValidated
      ? 'completed'
      : analysis === 'running'
      ? 'running'
      : 'pending';

  const analyticsStatus =
    analysis === 'failed'
      ? 'failed'
      : artifacts.hasAnalytics
      ? 'completed'
      : analysis === 'running'
      ? 'running'
      : 'pending';

  const reportStatus =
    reporting === 'failed'
      ? 'failed'
      : (artifacts.hasFinalReport && analyticsStatus === 'completed' && validationStatus === 'completed')
      ? 'completed'
      : reporting === 'running'
      ? 'running'
      : 'pending';

  return [
    { stage: 'UPLOAD', status: hasUpload ? 'completed' : 'pending' },
    { stage: 'PARSING', status: parsingStatus },
    { stage: 'STRUCTURE', status: structureStatus },
    { stage: 'EXTRACTION', status: extractionStatus },
    { stage: 'AGGREGATION', status: aggregationStatus },
    { stage: 'VALIDATION', status: validationStatus },
    { stage: 'ANALYTICS', status: analyticsStatus },
    { stage: 'REPORT', status: reportStatus },
  ];
}

function deriveWorkflowState(stageState = {}, confidence = null) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';

  if ([extraction, analysis, reporting].includes('failed')) {
    return 'FAILED';
  }
  if (extraction === 'completed' && analysis === 'completed' && reporting === 'completed') {
    return 'COMPLETED';
  }
  if (analysis === 'completed' && confidence?.band === 'low') {
    return 'LOW_CONFIDENCE';
  }
  if (analysis === 'completed' && reporting === 'running') {
    return 'GENERATING_REPORT';
  }
  if (analysis === 'running') {
    return 'ANALYZING';
  }
  if (extraction === 'running') {
    return 'EXTRACTING';
  }
  return 'UPLOADED';
}

function deriveWorkflowStateFromArtifacts(stageState = {}, artifacts = {}, confidence = null) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';

  if ([extraction, analysis, reporting].includes('failed')) {
    return 'FAILED';
  }
  if (artifacts.hasFinalReport || (extraction === 'completed' && analysis === 'completed' && reporting === 'completed')) {
    return 'COMPLETED';
  }
  if ((analysis === 'completed' || artifacts.hasCanonicalValidated) && confidence?.band === 'low') {
    return 'LOW_CONFIDENCE';
  }
  if (reporting === 'running' || (artifacts.hasAnalytics && !artifacts.hasFinalReport)) {
    return 'GENERATING_REPORT';
  }
  if (analysis === 'running' || (artifacts.hasCanonicalValidated && !artifacts.hasAnalytics)) {
    return 'ANALYZING';
  }
  if (extraction === 'running' || (artifacts.hasCanonicalRaw && !artifacts.hasCanonicalValidated)) {
    return 'EXTRACTING';
  }
  return artifacts.hasUploadedFile ? 'UPLOADED' : 'PENDING';
}

async function startPipeline(reportId, filePath) {
  await triggerExtract(reportId, filePath);
  await triggerAnalyze(reportId);
  await triggerGenerateReport(reportId);
}

function inferFailedStage(error) {
  const url = String(error?.config?.url || '').toLowerCase();
  if (url.includes('/extract')) return 'EXTRACTION';
  if (url.includes('/analyze')) return 'ANALYSIS';
  if (url.includes('/generate-report')) return 'REPORTING';
  return 'EXTRACTION';
}

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }
    const reportId = uuidv4();
    const redis = await getRedis();
    await redis.set(`report:${reportId}:uploaded_file`, req.file.path);
    return res.status(201).json({ reportId, filePath: req.file.path });
  } catch (error) {
    return next(error);
  }
});

router.post('/reports', upload.single('report'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const reportId = uuidv4();
    const redis = await getRedis();
    await redis.set(`report:${reportId}:uploaded_file`, req.file.path);
    await redis.set(
      `report:${reportId}:meta`,
      JSON.stringify({
        report_id: reportId,
        symbol: req.body.symbol || 'UNKNOWN',
        name: req.body.name || 'Unknown Company',
        sector: req.body.sector || 'Diversified',
      })
    );

    void startPipeline(reportId, req.file.path).catch(async (error) => {
      const failedStage = inferFailedStage(error);
      const state = {
        EXTRACTION: { status: failedStage === 'EXTRACTION' ? 'failed' : 'completed', diagnostics: { error: error.message } },
        ANALYSIS: { status: failedStage === 'ANALYSIS' ? 'failed' : (failedStage === 'EXTRACTION' ? 'pending' : 'completed'), diagnostics: { error: error.message } },
        REPORTING: { status: failedStage === 'REPORTING' ? 'failed' : 'pending', diagnostics: { error: error.message } },
      };
      await redis.set(`report:${reportId}:pipeline_stages`, JSON.stringify(state));
    });

    return res.status(201).json({
      report_id: reportId,
      workflow_state: 'UPLOADED',
      message: 'Report created. Pipeline started.',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/extract', async (req, res, next) => {
  try {
    const { reportId } = req.body;
    const redis = await getRedis();
    const filePath = await redis.get(`report:${reportId}:uploaded_file`);
    if (!filePath) {
      return res.status(404).json({ error: 'Uploaded file not found for reportId' });
    }
    const response = await triggerExtract(reportId, filePath);
    return res.json(response.data);
  } catch (error) {
    return next(error);
  }
});

router.post('/analyze', async (req, res, next) => {
  try {
    const { reportId } = req.body;
    const response = await triggerAnalyze(reportId);
    return res.json(response.data);
  } catch (error) {
    return next(error);
  }
});

router.post('/generate-report', async (req, res, next) => {
  try {
    const { reportId } = req.body;
    const response = await triggerGenerateReport(reportId);
    return res.json(response.data);
  } catch (error) {
    return next(error);
  }
});

router.post('/pipeline/start', async (req, res, next) => {
  try {
    const { reportId } = req.body;
    const extract = await triggerExtract(reportId, req.body.filePath);
    const analyze = await triggerAnalyze(reportId);
    const report = await triggerGenerateReport(reportId);
    return res.json({ extract: extract.data, analyze: analyze.data, report: report.data });
  } catch (error) {
    return next(error);
  }
});

router.get('/status/:reportId', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const stages = await redis.get(`report:${reportId}:pipeline_stages`);
    return res.json({ reportId, stages: stages ? JSON.parse(stages) : null });
  } catch (error) {
    return next(error);
  }
});

router.get('/pipeline/:reportId/stages', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const [rawStages, uploadedFile, rawConfidence, canonicalRaw, canonicalValidated, ratiosRaw, patternsRaw, sectorRaw, finalReportRaw] = await Promise.all([
      redis.get(`report:${reportId}:pipeline_stages`),
      redis.get(`report:${reportId}:uploaded_file`),
      redis.get(`report:${reportId}:confidence`),
      redis.get(`report:${reportId}:canonical_raw`),
      redis.get(`report:${reportId}:canonical_validated`),
      redis.get(`report:${reportId}:ratios`),
      redis.get(`report:${reportId}:patterns`),
      redis.get(`report:${reportId}:sector_comparison`),
      redis.get(`report:${reportId}:final_report`),
    ]);

    const stageState = parseJson(rawStages, {});
    const confidence = parseJson(rawConfidence, null);
    const artifacts = {
      hasCanonicalRaw: Boolean(canonicalRaw),
      hasCanonicalValidated: Boolean(canonicalValidated),
      hasAnalytics: Boolean(ratiosRaw || patternsRaw || sectorRaw),
      hasFinalReport: Boolean(finalReportRaw),
    };
    const stages = mapLegacyStages(stageState, Boolean(uploadedFile), artifacts);

    return res.json({
      report_id: reportId,
      workflow_state: deriveWorkflowStateFromArtifacts(stageState, {
        ...artifacts,
        hasUploadedFile: Boolean(uploadedFile),
      }, confidence),
      stages,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/pipeline/:reportId/raw', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const canonicalRaw = parseJson(await redis.get(`report:${reportId}:canonical_raw`), null);
    return res.json({ report_id: reportId, financial_data: canonicalRaw, narratives: canonicalRaw?.narrative_sections || {} });
  } catch (error) {
    return next(error);
  }
});

router.get('/pipeline/:reportId/canonical', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const canonicalRaw = parseJson(await redis.get(`report:${reportId}:canonical_raw`), null);
    return res.json({ report_id: reportId, canonical_raw: canonicalRaw });
  } catch (error) {
    return next(error);
  }
});

router.get('/pipeline/:reportId/validated', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const validated = parseJson(await redis.get(`report:${reportId}:canonical_validated`), null);
    const validatedRows = buildValidatedRows(validated);
    const qualityScore = deriveQualityScore(
      validatedRows,
      Array.isArray(validated?.validation_issues) ? validated.validation_issues : [],
      validated?.deterministic_checks || {}
    );
    return res.json({
      report_id: reportId,
      validated: {
        ...(validated || {}),
        validated_rows: validatedRows,
        overall_data_quality_score: qualityScore,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/pipeline/:reportId/analytics', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const [ratiosRaw, patternsRaw, sectorRaw] = await Promise.all([
      redis.get(`report:${reportId}:ratios`),
      redis.get(`report:${reportId}:patterns`),
      redis.get(`report:${reportId}:sector_comparison`),
    ]);
    return res.json({
      report_id: reportId,
      ratios: parseJson(ratiosRaw, {}),
      patterns: parseJson(patternsRaw, []),
      sector_kpis: parseJson(sectorRaw, {}),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/pipeline/:reportId/errors', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const validated = parseJson(await redis.get(`report:${reportId}:canonical_validated`), {});
    const validationIssues = Array.isArray(validated?.validation_issues) ? validated.validation_issues : [];
    const normalizedIssues = validationIssues.map((issue) => {
      if (typeof issue === 'string') return issue;
      const code = issue?.code ? String(issue.code) : 'validation_issue';
      const message = issue?.message ? String(issue.message) : 'Validation issue';
      return `${code}: ${message}`;
    });

    const financialStatements = validated?.financial_statements || {};
    const flattenedItems = [
      ...(Array.isArray(financialStatements.income_statement) ? financialStatements.income_statement : []),
      ...(Array.isArray(financialStatements.balance_sheet) ? financialStatements.balance_sheet : []),
      ...(Array.isArray(financialStatements.cashflow) ? financialStatements.cashflow : []),
      ...(Array.isArray(financialStatements.equity) ? financialStatements.equity : []),
    ];
    const missingValues = flattenedItems
      .filter((item) => item?.value == null)
      .slice(0, 50)
      .map((item, index) => ({
        row_id: `missing-${index}`,
        flags: ['missing_value'],
        canonical_label: item?.label || 'unknown',
      }));

    const weakDataEntries = flattenedItems
      .filter((item) => typeof item?.value === 'number' && Number.isNaN(item.value))
      .slice(0, 50)
      .map((item) => ({
        canonical_label: item?.label || 'unknown',
        confidence_score: 0.3,
      }));

    return res.json({
      report_id: reportId,
      error_catalog: normalizedIssues,
      missing_values: missingValues,
      validation_summary: {
        failed_rule_count: normalizedIssues.length,
      },
      confidence_distribution: null,
      weak_data_entries: weakDataEntries,
      total_errors: normalizedIssues.length,
      total_missing: missingValues.length,
      total_weak: weakDataEntries.length,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/:reportId', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const [rawMeta, rawStages, uploadedFile, canonicalRawStr, validatedStr, ratiosStr, patternsStr, sectorStr, confidenceStr, finalReportStr] = await Promise.all([
      redis.get(`report:${reportId}:meta`),
      redis.get(`report:${reportId}:pipeline_stages`),
      redis.get(`report:${reportId}:uploaded_file`),
      redis.get(`report:${reportId}:canonical_raw`),
      redis.get(`report:${reportId}:canonical_validated`),
      redis.get(`report:${reportId}:ratios`),
      redis.get(`report:${reportId}:patterns`),
      redis.get(`report:${reportId}:sector_comparison`),
      redis.get(`report:${reportId}:confidence`),
      redis.get(`report:${reportId}:final_report`),
    ]);

    const meta = parseJson(rawMeta, {});
    const stageState = parseJson(rawStages, {});
    const canonicalRaw = parseJson(canonicalRawStr, null);
    const validated = parseJson(validatedStr, null);
    const ratios = parseJson(ratiosStr, {});
    const patterns = parseJson(patternsStr, []);
    const sector = parseJson(sectorStr, {});
    const confidence = parseJson(confidenceStr, null);
    const finalReport = parseJson(finalReportStr, null);

    const artifacts = {
      hasUploadedFile: Boolean(uploadedFile),
      hasCanonicalRaw: Boolean(canonicalRaw),
      hasCanonicalValidated: Boolean(validated),
      hasAnalytics: Boolean(ratiosStr || patternsStr || sectorStr),
      hasFinalReport: Boolean(finalReport),
    };
    const workflowState = deriveWorkflowStateFromArtifacts(stageState, artifacts, confidence);
    const pipelineTracker = mapLegacyStages(stageState, artifacts.hasUploadedFile, artifacts);

    const validatedRows = buildValidatedRows(validated);
    const qualityScore = deriveQualityScore(
      validatedRows,
      Array.isArray(validated?.validation_issues) ? validated.validation_issues : [],
      validated?.deterministic_checks || {}
    );

    const narratives = {
      governance: Array.isArray(canonicalRaw?.narrative_sections?.governance) ? canonicalRaw.narrative_sections.governance : [],
      risk: Array.isArray(canonicalRaw?.narrative_sections?.risk) ? canonicalRaw.narrative_sections.risk : [],
      esg: Array.isArray(canonicalRaw?.narrative_sections?.esg) ? canonicalRaw.narrative_sections.esg : [],
      strategy: Array.isArray(canonicalRaw?.narrative_sections?.notes) ? canonicalRaw.narrative_sections.notes : [],
    };

    return res.json({
      id: reportId,
      symbol: meta.symbol || 'UNKNOWN',
      name: meta.name || 'Unknown Company',
      sector: meta.sector || 'Diversified',
      workflow_state: workflowState,
      pipeline_tracker: pipelineTracker,
      data_views: {
        raw_data: canonicalRaw || null,
        cleaned_data: canonicalRaw || null,
        validated_data: validated
          ? {
              ...validated,
              validated_rows: validatedRows,
              overall_data_quality_score: qualityScore,
            }
          : null,
      },
      analytics: {
        ratios,
        patterns,
        sector_kpis: sector,
      },
      confidence: confidence || {
        overall_data_quality_score: qualityScore,
      },
      narratives,
      pdf_path: finalReport ? `/results/${reportId}` : null,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/:reportId/download', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const finalReport = parseJson(await redis.get(`report:${reportId}:final_report`), null);
    if (!finalReport) {
      return res.status(404).json({ error: 'final_report not found' });
    }

    const content = finalReport.content || JSON.stringify(finalReport, null, 2);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="analysis_${reportId}.txt"`);
    return res.send(content);
  } catch (error) {
    return next(error);
  }
});

router.get('/results/:reportId', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const finalReport = await redis.get(`report:${reportId}:final_report`);
    if (!finalReport) {
      return res.status(404).json({ error: 'final_report not found' });
    }
    return res.json(JSON.parse(finalReport));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

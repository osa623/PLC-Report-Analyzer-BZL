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

function mapLegacyStages(stageState = {}, hasUpload = false) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';

  return [
    { stage: 'UPLOAD', status: hasUpload ? 'completed' : 'pending' },
    { stage: 'PARSING', status: extraction },
    { stage: 'STRUCTURE', status: extraction },
    { stage: 'EXTRACTION', status: extraction },
    { stage: 'AGGREGATION', status: analysis },
    { stage: 'VALIDATION', status: analysis },
    { stage: 'ANALYTICS', status: analysis },
    { stage: 'REPORT', status: reporting },
  ];
}

function deriveWorkflowState(stageState = {}, confidence = null) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';

  if ([extraction, analysis, reporting].includes('failed')) {
    return 'FAILED';
  }
  if (reporting === 'completed') {
    return 'COMPLETED';
  }
  if (analysis === 'completed' && confidence?.band === 'low') {
    return 'LOW_CONFIDENCE';
  }
  if (reporting === 'running') {
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
    const [rawStages, uploadedFile, rawConfidence] = await Promise.all([
      redis.get(`report:${reportId}:pipeline_stages`),
      redis.get(`report:${reportId}:uploaded_file`),
      redis.get(`report:${reportId}:confidence`),
    ]);

    const stageState = parseJson(rawStages, {});
    const confidence = parseJson(rawConfidence, null);
    const stages = mapLegacyStages(stageState, Boolean(uploadedFile));

    return res.json({
      report_id: reportId,
      workflow_state: deriveWorkflowState(stageState, confidence),
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
    return res.json({ report_id: reportId, validated });
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
    const validationIssues = validated?.validation_issues || [];
    return res.json({
      report_id: reportId,
      error_catalog: validationIssues,
      missing_values: [],
      validation_summary: {
        failed_rule_count: validationIssues.length,
      },
      confidence_distribution: null,
      weak_data_entries: [],
      total_errors: validationIssues.length,
      total_missing: 0,
      total_weak: 0,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/:reportId', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const [rawMeta, rawStages] = await Promise.all([
      redis.get(`report:${reportId}:meta`),
      redis.get(`report:${reportId}:pipeline_stages`),
    ]);
    const meta = parseJson(rawMeta, {});
    const stageState = parseJson(rawStages, {});
    return res.json({
      id: reportId,
      symbol: meta.symbol || 'UNKNOWN',
      name: meta.name || 'Unknown Company',
      sector: meta.sector || 'Diversified',
      workflow_state: deriveWorkflowState(stageState, null),
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

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const upload = require('../utils/upload');
const { getRedis } = require('../services/redisClient');
const { triggerExtract, triggerAnalyze, triggerGenerateReport } = require('../services/pipelineClient');
const {
  derivePipelineStatus,
  parseDocumentStatuses,
  buildPipelineMonitor,
  buildExtractionAuditReport,
} = require('../services/pipelineContract');

const router = Router();

const BASE_CURRENCY = 'LKR';
const SUPPORTED_CURRENCIES = new Set(['LKR', 'USD']);
const parsedFxRate = Number(process.env.FX_LKR_PER_USD || process.env.USD_LKR_RATE || 300);
const FX_LKR_PER_USD = Number.isFinite(parsedFxRate) && parsedFxRate > 0 ? parsedFxRate : 300;
const CONVERSION_CACHE = new Map();
const MAX_CONVERSION_CACHE_ENTRIES = 200;
const MONETARY_METRIC_KEYS = new Set([
  'revenue',
  'gross_profit',
  'operating_profit',
  'net_income',
  'net_profit',
  'current_assets',
  'current_liabilities',
  'total_assets',
  'total_liabilities',
  'total_equity',
  'cash_and_cash_equivalents',
  'operating_cash_flow',
  'investing_cash_flow',
  'financing_cash_flow',
  'net_cash_flow',
  'total_cash_flow',
  'tangible_net_worth',
  'capital_employed',
  'net_asset_value',
  'market_capitalization',
  'enterprise_value',
  'book_value_per_share',
  'eps',
  'dividend_per_share',
  'depreciation',
  'interest_expense',
  'operating_expenses',
  'profit_before_tax',
  'tax_expense',
]);

function normalizeCurrency(target) {
  const normalized = String(target || BASE_CURRENCY).trim().toUpperCase();
  return SUPPORTED_CURRENCIES.has(normalized) ? normalized : BASE_CURRENCY;
}

function getLatestFxSnapshot() {
  const now = new Date();
  const exchangeRateDate = now.toISOString().slice(0, 10);
  return {
    base_currency: BASE_CURRENCY,
    quote_currency: 'USD',
    exchange_rate_date: exchangeRateDate,
    fx_rate_lkr_per_usd: FX_LKR_PER_USD,
    source: 'configured',
    fetched_at: now.toISOString(),
  };
}

function buildConversionCacheKey(reportId, exchangeRateDate) {
  return `${String(reportId)}:${String(exchangeRateDate)}`;
}

function getConversionCache(cacheKey) {
  return CONVERSION_CACHE.get(cacheKey) || null;
}

function setConversionCache(cacheKey, payload) {
  if (!cacheKey) {
    return;
  }
  if (CONVERSION_CACHE.size >= MAX_CONVERSION_CACHE_ENTRIES) {
    const oldestKey = CONVERSION_CACHE.keys().next().value;
    if (oldestKey) {
      CONVERSION_CACHE.delete(oldestKey);
    }
  }
  CONVERSION_CACHE.set(cacheKey, payload);
}

function convertAmountFromLkr(value, targetCurrency, fxRateLkrPerUsd = FX_LKR_PER_USD) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }
  if (targetCurrency === BASE_CURRENCY) {
    return value;
  }
  if (targetCurrency === 'USD') {
    const safeRate = Number(fxRateLkrPerUsd);
    if (!Number.isFinite(safeRate) || safeRate <= 0) {
      return value;
    }
    return Number((value / safeRate).toFixed(6));
  }
  return value;
}

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function convertMetricMap(metricMap, targetCurrency, fxRateLkrPerUsd = FX_LKR_PER_USD) {
  if (!metricMap || typeof metricMap !== 'object') {
    return metricMap;
  }
  Object.keys(metricMap).forEach((key) => {
    if (MONETARY_METRIC_KEYS.has(key) && typeof metricMap[key] === 'number' && Number.isFinite(metricMap[key])) {
      metricMap[key] = convertAmountFromLkr(metricMap[key], targetCurrency, fxRateLkrPerUsd);
    }
  });
  return metricMap;
}

function convertValidatedCurrency(validated, targetCurrency, fxRateLkrPerUsd = FX_LKR_PER_USD) {
  const out = cloneJson(validated, null);
  if (!out || typeof out !== 'object') {
    return out;
  }

  const statements = out.financial_statements;
  if (statements && typeof statements === 'object') {
    ['income_statement', 'balance_sheet', 'cashflow', 'equity'].forEach((sectionKey) => {
      const rows = Array.isArray(statements[sectionKey]) ? statements[sectionKey] : [];
      rows.forEach((row) => {
        if (typeof row?.value === 'number' && Number.isFinite(row.value)) {
          row.value = convertAmountFromLkr(row.value, targetCurrency, fxRateLkrPerUsd);
        }
      });
    });
  }

  const validatedRows = Array.isArray(out.validated_rows) ? out.validated_rows : [];
  validatedRows.forEach((row) => {
    if (typeof row?.value === 'number' && Number.isFinite(row.value)) {
      row.value = convertAmountFromLkr(row.value, targetCurrency, fxRateLkrPerUsd);
    }
  });

  return out;
}

function convertAnalyticsCurrency(analyticsPayload, targetCurrency, fxRateLkrPerUsd = FX_LKR_PER_USD) {
  const out = cloneJson(analyticsPayload, {
    ratios: {},
    patterns: [],
    risk: {},
    sector_kpis: {},
    confidence: {},
    analysis_coverage: {},
    sections: {},
    transparency: {},
  });

  const ratios = out.ratios && typeof out.ratios === 'object' ? out.ratios : {};
  convertMetricMap(ratios, targetCurrency, fxRateLkrPerUsd);

  if (ratios.by_year && typeof ratios.by_year === 'object') {
    Object.keys(ratios.by_year).forEach((year) => {
      convertMetricMap(ratios.by_year[year], targetCurrency, fxRateLkrPerUsd);
    });
  }

  out.ratios = ratios;
  return out;
}

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

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toSafeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDeviation(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeValidationIssues(validationIssues = []) {
  const items = Array.isArray(validationIssues) ? validationIssues : [];
  return items
    .map((issue) => {
      if (typeof issue === 'string') {
        const text = normalizeText(issue);
        return {
          code: text,
          message: text,
          text,
          severity: text.includes('failed') || text.includes('error') ? 'error' : 'warning',
        };
      }

      if (!issue || typeof issue !== 'object') {
        return null;
      }

      const code = normalizeText(issue.code || 'validation_issue');
      const message = normalizeText(issue.message || 'validation issue');
      const severity = String(issue.severity || '').toLowerCase();
      return {
        code,
        message,
        text: `${code} ${message}`.trim(),
        severity: severity === 'error' || severity === 'warning' || severity === 'info' ? severity : 'warning',
      };
    })
    .filter(Boolean)
    .map((issue) => ({
      ...issue,
      severityWeight: issue.severity === 'error' ? 1.0 : issue.severity === 'warning' ? 0.6 : 0.3,
    }));
}

function selectCanonicalQualityScore(_calculatedScore, confidencePayload = null) {
  let selected = null;
  if (confidencePayload && typeof confidencePayload === 'object') {
    if (typeof confidencePayload.raw_score === 'number' && Number.isFinite(confidencePayload.raw_score)) {
      selected = confidencePayload.raw_score;
    } else if (typeof confidencePayload.score === 'number' && Number.isFinite(confidencePayload.score)) {
      selected = confidencePayload.score;
    }
  }
  if (selected == null) {
    return null;
  }
  return clamp01(selected);
}

function normalizeConfidencePayload(confidencePayload, fallbackQualityScore = null) {
  const normalized = confidencePayload && typeof confidencePayload === 'object'
    ? { ...confidencePayload }
    : {};
  const qualityScore = selectCanonicalQualityScore(fallbackQualityScore, normalized);
  if (typeof qualityScore === 'number') {
    normalized.overall_data_quality_score = qualityScore;
  }
  return normalized;
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

  const expectedSectionCounts = {
    income_statement: 8,
    balance_sheet: 7,
    cashflow_statement: 7,
    equity_statement: 2,
  };

  const deterministicChecks = validated?.deterministic_checks && typeof validated.deterministic_checks === 'object'
    ? validated.deterministic_checks
    : {};
  const deterministicFlags = Object.values(deterministicChecks).filter((value) => typeof value === 'boolean');
  const deterministicPassRate = deterministicFlags.length > 0
    ? deterministicFlags.filter(Boolean).length / deterministicFlags.length
    : 0;

  const normalizedIssues = normalizeValidationIssues(validated?.validation_issues);

  const sectionYearNumericCounts = {};
  const labelSeries = {};

  Object.entries(statementTypeByKey).forEach(([key, statementType]) => {
    const items = Array.isArray(financialStatements[key]) ? financialStatements[key] : [];
    items.forEach((item) => {
      const period = String(item?.period || 'unknown');
      const label = normalizeText(item?.label || 'unknown');
      const value = toSafeNumber(item?.value);
      if (value == null) {
        return;
      }
      const sectionYearKey = `${statementType}|${period}`;
      sectionYearNumericCounts[sectionYearKey] = (sectionYearNumericCounts[sectionYearKey] || 0) + 1;
      const labelKey = `${statementType}|${label}`;
      if (!labelSeries[labelKey]) {
        labelSeries[labelKey] = [];
      }
      labelSeries[labelKey].push(value);
    });
  });

  const spreadScore = (value, peers) => {
    if (!Array.isArray(peers) || peers.length < 2 || !Number.isFinite(value)) {
      return 0.6;
    }
    const med = median(peers);
    if (!Number.isFinite(med)) {
      return 0.6;
    }
    const relDist = Math.abs(value - med) / Math.max(Math.abs(med), 1);
    return clamp01(1 - (relDist / 3));
  };

  const rows = [];
  Object.entries(statementTypeByKey).forEach(([key, statementType]) => {
    const items = Array.isArray(financialStatements[key]) ? financialStatements[key] : [];
    items.forEach((item, index) => {
      const rawValue = toSafeNumber(item?.value);
      const period = String(item?.period || 'unknown');
      const label = String(item?.label || 'unknown');
      const normalizedLabel = normalizeText(label);

      const sectionYearKey = `${statementType}|${period}`;
      const sectionCoverage = clamp01(
        (sectionYearNumericCounts[sectionYearKey] || 0)
        / Math.max(1, expectedSectionCounts[statementType] || 6)
      );

      const labelKey = `${statementType}|${normalizedLabel}`;
      const valueDistribution = spreadScore(rawValue, labelSeries[labelKey] || []);

      let issuePenalty = 0;
      normalizedIssues.forEach((issue) => {
        const tokenHits = normalizedLabel
          .split(' ')
          .filter((token) => token.length >= 5 && issue.text.includes(token)).length;
        const sectionHit = issue.text.includes(statementType.replace(/_/g, ' '));
        if (tokenHits > 0 || sectionHit) {
          issuePenalty += (0.05 + (tokenHits * 0.01)) * issue.severityWeight;
        }
      });
      issuePenalty = Math.min(0.30, issuePenalty);

      const valueSignal = rawValue == null ? 0.10 : 0.75;
      const periodSignal = /^\d{4}$/.test(period) ? 1.0 : 0.5;
      const labelSignal = normalizedLabel ? 1.0 : 0.25;

      let confidenceScore = 0;
      confidenceScore += 0.34 * valueSignal;
      confidenceScore += 0.20 * sectionCoverage;
      confidenceScore += 0.16 * deterministicPassRate;
      confidenceScore += 0.12 * valueDistribution;
      confidenceScore += 0.10 * periodSignal;
      confidenceScore += 0.08 * labelSignal;
      confidenceScore -= issuePenalty;

      rows.push({
        row_id: `${statementType}-${index}`,
        canonical_label: label,
        original_label: label,
        value: rawValue,
        year: item?.period || null,
        statement_type: statementType,
        confidence_score: Number(clamp01(confidenceScore).toFixed(4)),
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

  const confidences = validatedRows
    .map((row) => toSafeNumber(row?.confidence_score))
    .filter((value) => value != null);
  const avgRowConfidence = confidences.length > 0
    ? (confidences.reduce((acc, value) => acc + value, 0) / confidences.length)
    : 0;
  const highConfidenceShare = confidences.length > 0
    ? (confidences.filter((value) => value >= 0.75).length / confidences.length)
    : 0;
  const confidenceStability = clamp01(1 - (stdDeviation(confidences) / 0.35));

  const checks = Object.values(deterministicChecks || {}).filter((value) => typeof value === 'boolean');
  const checkPassRate = checks.length > 0 ? (checks.filter(Boolean).length / checks.length) : 0;

  const numericRows = validatedRows.filter((row) => toSafeNumber(row?.value) != null).length;
  const completeness = numericRows / Math.max(validatedRows.length, 1);

  const normalizedIssues = normalizeValidationIssues(validationIssues);
  const weightedIssueCount = normalizedIssues.reduce((sum, issue) => sum + issue.severityWeight, 0);
  const issuePenalty = Math.min(0.40, (weightedIssueCount / Math.max(validatedRows.length, 1)) * 1.25);

  let score = 0;
  score += 0.32 * avgRowConfidence;
  score += 0.22 * completeness;
  score += 0.18 * checkPassRate;
  score += 0.16 * confidenceStability;
  score += 0.12 * highConfidenceShare;
  score -= issuePenalty;

  return clamp01(score);
}

function mapLegacyStages(
  stageState = {},
  hasUpload = false,
  artifacts = {},
  extractionSubstages = {},
  strictAnalysis = null,
) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';
  const strictStatus = String(strictAnalysis?.status || '').toUpperCase();

  const textExtractionStatus = extractionSubstages.text_extraction?.status || null;
  const tableDetectionStatus = extractionSubstages.table_detection?.status || null;
  const fieldMappingStatus = extractionSubstages.field_mapping?.status || null;
  const normalizationStatus = extractionSubstages.normalization?.status || null;
  const validationSubStatus = extractionSubstages.validation?.status || null;

  const documentIngestionStatus =
    !hasUpload
      ? 'pending'
      : textExtractionStatus === 'completed' || extraction === 'completed' || extraction === 'failed'
      ? 'completed'
      : textExtractionStatus === 'running' || extraction === 'running'
      ? 'running'
      : 'pending';

  const pageClassificationStatus =
    !hasUpload
      ? 'pending'
      : tableDetectionStatus === 'completed' || extraction === 'completed' || extraction === 'failed'
      ? 'completed'
      : tableDetectionStatus === 'running' || (documentIngestionStatus === 'completed' && extraction === 'running')
      ? 'running'
      : normalizeStatus(extraction);

  const statementDetectionStatus =
    extraction === 'failed' && !tableDetectionStatus
      ? 'failed'
      : tableDetectionStatus === 'completed' || artifacts.hasCanonicalRaw
      ? 'completed'
      : tableDetectionStatus === 'running' || extraction === 'running'
      ? 'running'
      : 'pending';

  const multiExtractorExecutionStatus =
    extraction === 'failed' && !fieldMappingStatus
      ? 'failed'
      : fieldMappingStatus === 'completed' || artifacts.hasCanonicalRaw
      ? 'completed'
      : fieldMappingStatus === 'running' || extraction === 'running'
      ? 'running'
      : 'pending';

  const crossExtractorReconciliationStatus =
    extraction === 'failed' && !normalizationStatus
      ? 'failed'
      : normalizationStatus === 'completed' || artifacts.hasCanonicalRaw
      ? 'completed'
      : normalizationStatus === 'running' || extraction === 'running'
      ? 'running'
      : 'pending';

  const accountingValidationStatus =
    extraction === 'failed' && !validationSubStatus
      ? 'failed'
      : validationSubStatus === 'completed' || artifacts.hasCanonicalRaw
      ? 'completed'
      : validationSubStatus === 'running' || extraction === 'running'
      ? 'running'
      : 'pending';

  const coverageScoringGateStatus =
    strictStatus === 'VALIDATED_READY'
      ? 'completed'
      : strictStatus === 'EXTRACTION_INCOMPLETE' || analysis === 'skipped'
      ? 'failed'
      : analysis === 'running' || analysis === 'completed'
      ? 'running'
      : 'pending';

  const financialAnalysisStatus =
    coverageScoringGateStatus === 'failed'
      ? 'skipped'
      : analysis === 'failed'
      ? 'failed'
      : strictStatus === 'VALIDATED_READY' && (artifacts.hasAnalytics || analysis === 'completed')
      ? 'completed'
      : analysis === 'running'
      ? 'running'
      : 'pending';

  const reportGenerationStatus =
    coverageScoringGateStatus === 'failed' || reporting === 'skipped'
      ? 'skipped'
      : reporting === 'failed'
      ? 'failed'
      : strictStatus === 'VALIDATED_READY' && artifacts.hasFinalReport
      ? 'completed'
      : reporting === 'running'
      ? 'running'
      : 'pending';

  return [
    { stage: 'DOCUMENT_INGESTION', status: documentIngestionStatus },
    { stage: 'PAGE_CLASSIFICATION', status: pageClassificationStatus },
    { stage: 'STATEMENT_DETECTION', status: statementDetectionStatus },
    { stage: 'MULTI_EXTRACTOR_EXECUTION', status: multiExtractorExecutionStatus },
    { stage: 'CROSS_EXTRACTOR_RECONCILIATION', status: crossExtractorReconciliationStatus },
    { stage: 'ACCOUNTING_VALIDATION', status: accountingValidationStatus },
    { stage: 'COVERAGE_SCORING_GATE', status: coverageScoringGateStatus },
    { stage: 'FINANCIAL_ANALYSIS', status: financialAnalysisStatus },
    { stage: 'REPORT_GENERATION', status: reportGenerationStatus },
  ];
}

function deriveWorkflowState(stageState = {}, confidence = null) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';
  const confidenceScore = Number(confidence?.score || 0);
  const lowConfidence = confidence?.band === 'low' && confidenceScore < 0.85;

  if ([extraction, analysis, reporting].includes('failed')) {
    return 'FAILED';
  }
  if (extraction === 'completed' && analysis === 'completed' && reporting === 'completed') {
    return 'COMPLETED';
  }
  if (analysis === 'completed' && lowConfidence) {
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

function deriveWorkflowStateFromArtifacts(stageState = {}, artifacts = {}, confidence = null, strictAnalysis = null) {
  const extraction = stageState.EXTRACTION?.status || 'pending';
  const analysis = stageState.ANALYSIS?.status || 'pending';
  const reporting = stageState.REPORTING?.status || 'pending';
  const confidenceScore = Number(confidence?.score || 0);
  const lowConfidence = confidence?.band === 'low' && confidenceScore < 0.85;

  // Extraction validation gate: if analysis determined extraction is incomplete,
  // this is a terminal state — no analytics or reporting should follow.
  const analysisStatus = String(strictAnalysis?.status || '').toUpperCase();
  if (analysisStatus === 'EXTRACTION_INCOMPLETE') {
    return 'EXTRACTION_FAILED';
  }

  if ([extraction, analysis, reporting].includes('failed')) {
    return 'FAILED';
  }

  // Skipped stages are terminal: analysis or reporting was gated off.
  if (analysis === 'skipped' || reporting === 'skipped') {
    return 'EXTRACTION_FAILED';
  }

  if (artifacts.hasFinalReport || (extraction === 'completed' && analysis === 'completed' && reporting === 'completed')) {
    return 'COMPLETED';
  }
  if ((analysis === 'completed' || artifacts.hasCanonicalValidated) && lowConfidence) {
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

function trendLimitations(yearCount) {
  if (yearCount >= 3) {
    return [];
  }
  if (yearCount <= 1) {
    return [
      'Trend analysis limited due to single reporting year',
      'Multi-year pattern detection not available for current dataset',
      'Structural financial snapshot generated from available data',
    ];
  }
  return [
    'Long-horizon trend detection is limited because fewer than three reporting years were detected',
    'Structural financial snapshot generated from available data',
  ];
}

function analysisBlocksReporting(analysisPayload = {}) {
  const status = String(analysisPayload?.status || '').toUpperCase();
  const validYears = Array.isArray(analysisPayload?.valid_years)
    ? analysisPayload.valid_years.filter((year) => typeof year === 'string' && /^\d{4}$/.test(year))
    : [];
  return status === 'VALIDATION_FAILED'
    || status === 'EXTRACTION_INCOMPLETE'
    || validYears.length === 0;
}

async function markReportingSkipped(reportId, analysisPayload = {}) {
  const redis = await getRedis();
  const raw = await redis.get(`report:${reportId}:pipeline_stages`);
  const stages = parseJson(raw, {});
  const now = new Date().toISOString();
  const reporting = stages.REPORTING && typeof stages.REPORTING === 'object' ? stages.REPORTING : {};
  const reasons = Array.isArray(analysisPayload?.reasons) ? analysisPayload.reasons : [];

  stages.REPORTING = {
    ...reporting,
    status: 'skipped',
    start_time: reporting.start_time || now,
    end_time: now,
    diagnostics: {
      ...(reporting.diagnostics && typeof reporting.diagnostics === 'object' ? reporting.diagnostics : {}),
      reason: reasons[0] || 'Report generation skipped because analysis did not yield a valid analytics result',
    },
  };

  await redis.set(
    `report:${reportId}:pipeline_stages`,
    JSON.stringify(stages),
    'EX',
    86400
  );
}

async function markAnalysisSkipped(reportId, reason = 'Analysis skipped because extraction did not satisfy audit gates') {
  const redis = await getRedis();
  const raw = await redis.get(`report:${reportId}:pipeline_stages`);
  const stages = parseJson(raw, {});
  const now = new Date().toISOString();
  const analysis = stages.ANALYSIS && typeof stages.ANALYSIS === 'object' ? stages.ANALYSIS : {};

  stages.ANALYSIS = {
    ...analysis,
    status: 'skipped',
    start_time: analysis.start_time || now,
    end_time: now,
    diagnostics: {
      ...(analysis.diagnostics && typeof analysis.diagnostics === 'object' ? analysis.diagnostics : {}),
      reason,
    },
  };

  await redis.set(
    `report:${reportId}:pipeline_stages`,
    JSON.stringify(stages),
    'EX',
    86400
  );
}

async function startPipeline(reportId, filePath) {
  let extractPayload;
  try {
    const extract = await triggerExtract(reportId, filePath);
    extractPayload = extract.data;
  } catch (error) {
    const extractionFailure = error?.response?.status === 422 ? error.response.data : null;
    if (extractionFailure && typeof extractionFailure === 'object') {
      await markAnalysisSkipped(reportId, 'Extraction incomplete. Analysis blocked before financial calculations.');
      await markReportingSkipped(reportId, {
        reasons: ['Extraction failed — report generation blocked by validation gate'],
      });
      // Still generate a failure report so the frontend has an artifact to display.
      const report = await triggerGenerateReport(reportId).catch(() => ({ data: null }));
      return {
        pipeline_status: 'EXTRACTION_INCOMPLETE',
        extract: extractionFailure,
        analyze: {
          status: 'EXTRACTION_INCOMPLETE',
          reasons: ['Extraction failed before analysis could start'],
        },
        report: report?.data || {
          status: 'EXTRACTION_INCOMPLETE',
          reason: 'Extraction failure report could not be generated',
        },
      };
    }
    throw error;
  }

  // ── VALIDATION GATE: analysis must pass before reporting proceeds ──
  let analyzePayload;
  try {
    const analyze = await triggerAnalyze(reportId);
    analyzePayload = analyze.data;
  } catch (error) {
    // Analysis service failure is non-recoverable.
    await markReportingSkipped(reportId, {
      reasons: ['Analysis service failed — report generation blocked'],
    });
    const report = await triggerGenerateReport(reportId).catch(() => ({ data: null }));
    return {
      pipeline_status: 'EXTRACTION_INCOMPLETE',
      extract: extractPayload,
      analyze: { status: 'EXTRACTION_INCOMPLETE', reasons: ['Analysis service error'] },
      report: report?.data || { status: 'EXTRACTION_INCOMPLETE' },
    };
  }

  // ── Check if analysis determined extraction data is insufficient ──
  if (analysisBlocksReporting(analyzePayload)) {
    await markReportingSkipped(reportId, analyzePayload);
    // Generate a failure/diagnostic report instead of a financial report.
    const report = await triggerGenerateReport(reportId).catch(() => ({ data: null }));
    return {
      pipeline_status: 'EXTRACTION_INCOMPLETE',
      extract: extractPayload,
      analyze: analyzePayload,
      report: report?.data || { status: 'EXTRACTION_INCOMPLETE' },
    };
  }

  // ── Validation gate passed: proceed to full report generation ──
  const report = await triggerGenerateReport(reportId);
  return {
    pipeline_status: 'VALIDATED_READY',
    extract: extractPayload,
    analyze: analyzePayload,
    report: report.data,
  };
}

function extractUploadedPaths(req, fieldName) {
  const files = Array.isArray(req.files) ? req.files : [];
  const fromArray = files
    .filter((file) => !fieldName || file.fieldname === fieldName)
    .map((file) => file.path)
    .filter(Boolean);

  if (fromArray.length > 0) {
    return fromArray;
  }

  if (req.file?.path) {
    return [req.file.path];
  }

  return [];
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

router.post('/reports', upload.array('report', 20), async (req, res, next) => {
  try {
    const uploadedPaths = extractUploadedPaths(req, 'report');
    if (uploadedPaths.length === 0) {
      return res.status(400).json({ error: 'At least one PDF file is required' });
    }

    const reportId = uuidv4();
    const redis = await getRedis();
    await redis.set(`report:${reportId}:uploaded_file`, uploadedPaths[0]);
    await redis.set(`report:${reportId}:uploaded_files`, JSON.stringify(uploadedPaths));
    await redis.set(
      `report:${reportId}:meta`,
      JSON.stringify({
        report_id: reportId,
        symbol: req.body.symbol || 'UNKNOWN',
        name: req.body.name || 'Unknown Company',
        sector: req.body.sector || 'Diversified',
        document_count: uploadedPaths.length,
      })
    );

    void startPipeline(reportId, uploadedPaths.length === 1 ? uploadedPaths[0] : uploadedPaths).catch(async (error) => {
      const failedStage = inferFailedStage(error);
      let stages = {};
      try {
        const redis = await getRedis();
        const raw = await redis.get(`report:${reportId}:pipeline_stages`);
        stages = raw ? JSON.parse(raw) : {};
      } catch (e) {}

      const state = {
        EXTRACTION: { ...stages.EXTRACTION, status: failedStage === 'EXTRACTION' ? 'failed' : 'completed', diagnostics: { error: error.message } },
        ANALYSIS: { ...stages.ANALYSIS, status: failedStage === 'ANALYSIS' ? 'failed' : (failedStage === 'EXTRACTION' ? 'pending' : 'completed'), diagnostics: { error: error.message } },
        REPORTING: { ...stages.REPORTING, status: failedStage === 'REPORTING' ? 'failed' : 'pending', diagnostics: { error: error.message } },
      };
      
      try {
        const redis = await getRedis();
        await redis.set(`report:${reportId}:pipeline_stages`, JSON.stringify(state));
        await updateBatchStatus(reportId, { status: 'failed' });
      } catch (e) {}
    });

    // Register this upload as a batch for tracking
    await registerBatch(reportId, {
      report_id: reportId,
      company_name: req.body.name || 'Unknown Company',
      sector: req.body.sector || 'Diversified',
      file_count: uploadedPaths.length,
      files: uploadedPaths.map((p) => p.split(/[/\\]/).pop()),
    });

    return res.status(201).json({
      report_id: reportId,
      batch_id: reportId,
      pipeline_status: 'PROCESSING',
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
    const filePathsRaw = await redis.get(`report:${reportId}:uploaded_files`);
    const filePaths = parseJson(filePathsRaw, []);
    const inputPaths = Array.isArray(filePaths) && filePaths.length > 0 ? filePaths : (filePath ? [filePath] : []);

    if (inputPaths.length === 0) {
      return res.status(404).json({ error: 'Uploaded file not found for reportId' });
    }
    const response = await triggerExtract(reportId, inputPaths.length === 1 ? inputPaths[0] : inputPaths);
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
    const fileInput = Array.isArray(req.body.filePaths) && req.body.filePaths.length > 0
      ? req.body.filePaths
      : req.body.filePath;
    const result = await startPipeline(reportId, fileInput);
    return res.json(result);
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
    const [rawStages, uploadedFile, rawConfidence, canonicalRaw, canonicalValidated, ratiosRaw, patternsRaw, sectorRaw, riskRaw, finalReportRaw, rawExtractionSubstages, strictAnalysisRaw, strictExtractionRaw, extractionFailureRaw, extractionCoverageRaw, rawDocumentStatuses] = await Promise.all([
      redis.get(`report:${reportId}:pipeline_stages`),
      redis.get(`report:${reportId}:uploaded_file`),
      redis.get(`report:${reportId}:confidence`),
      redis.get(`report:${reportId}:canonical_raw`),
      redis.get(`report:${reportId}:canonical_validated`),
      redis.get(`report:${reportId}:ratios`),
      redis.get(`report:${reportId}:patterns`),
      redis.get(`report:${reportId}:sector_comparison`),
      redis.get(`report:${reportId}:risk`),
      redis.get(`report:${reportId}:final_report`),
      redis.get(`report:${reportId}:extraction_substages`),
      redis.get(`report:${reportId}:strict_analysis`),
      redis.get(`report:${reportId}:strict_extraction`),
      redis.get(`report:${reportId}:extraction_failure`),
      redis.get(`report:${reportId}:extraction_coverage`),
      redis.hGetAll(`report:${reportId}:document_statuses`),
    ]);

    const stageState = parseJson(rawStages, {});
    const confidence = parseJson(rawConfidence, null);
    const extractionSubstages = parseJson(rawExtractionSubstages, {});
    const strictAnalysis = parseJson(strictAnalysisRaw, null);
    const strictExtraction = parseJson(strictExtractionRaw, null);
    const extractionFailure = parseJson(extractionFailureRaw, null);
    const extractionCoverage = parseJson(extractionCoverageRaw, null);
    const finalReport = parseJson(finalReportRaw, null);
    const artifacts = {
      hasCanonicalRaw: Boolean(canonicalRaw),
      hasCanonicalValidated: Boolean(canonicalValidated),
      hasAnalytics: Boolean(ratiosRaw || patternsRaw || sectorRaw || riskRaw),
      hasFinalReport: Boolean(finalReportRaw),
    };
    const stages = mapLegacyStages(stageState, Boolean(uploadedFile), artifacts, extractionSubstages, strictAnalysis);
    const documents = parseDocumentStatuses(rawDocumentStatuses);
    const pipelineStatus = derivePipelineStatus({
      stageState,
      strictAnalysis,
      extractionFailure,
      finalReport,
    });
    const pipelineMonitor = buildPipelineMonitor({
      pipelineStatus,
      stageState,
      extractionSubstages,
      documents,
      strictAnalysis,
      strictExtraction,
      extractionCoverage,
      extractionFailure,
    });

    return res.json({
      report_id: reportId,
      pipeline_status: pipelineStatus,
      workflow_state: deriveWorkflowStateFromArtifacts(stageState, {
        ...artifacts,
        hasUploadedFile: Boolean(uploadedFile),
      }, confidence),
      stages,
      extraction_substages: extractionSubstages,
      pipeline_monitor: pipelineMonitor,
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
    const [validatedRaw, confidenceRaw, strictAnalysisRaw, extractionFailureRaw] = await Promise.all([
      redis.get(`report:${reportId}:canonical_validated`),
      redis.get(`report:${reportId}:confidence`),
      redis.get(`report:${reportId}:strict_analysis`),
      redis.get(`report:${reportId}:extraction_failure`),
    ]);
    const validated = parseJson(validatedRaw, null);
    const confidence = parseJson(confidenceRaw, null);
    const strictAnalysis = parseJson(strictAnalysisRaw, null);
    const extractionFailure = parseJson(extractionFailureRaw, null);
    const validatedRows = buildValidatedRows(validated);
    const derivedQualityScore = deriveQualityScore(
      validatedRows,
      Array.isArray(validated?.validation_issues) ? validated.validation_issues : [],
      validated?.deterministic_checks || {}
    );
    const qualityScore = selectCanonicalQualityScore(derivedQualityScore, confidence) ?? derivedQualityScore;
    return res.json({
      report_id: reportId,
      pipeline_status: derivePipelineStatus({ strictAnalysis, extractionFailure }),
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
    const [ratiosRaw, patternsRaw, sectorRaw, riskRaw, confidenceRaw, analysisCoverageRaw, finalReportRaw, strictAnalysisRaw, extractionFailureRaw] = await Promise.all([
      redis.get(`report:${reportId}:ratios`),
      redis.get(`report:${reportId}:patterns`),
      redis.get(`report:${reportId}:sector_comparison`),
      redis.get(`report:${reportId}:risk`),
      redis.get(`report:${reportId}:confidence`),
      redis.get(`report:${reportId}:analysis_coverage`),
      redis.get(`report:${reportId}:final_report`),
      redis.get(`report:${reportId}:strict_analysis`),
      redis.get(`report:${reportId}:extraction_failure`),
    ]);

    const finalReport = parseJson(finalReportRaw, null);
    const strictAnalysis = parseJson(strictAnalysisRaw, null);
    const extractionFailure = parseJson(extractionFailureRaw, null);
    const confidencePayload = normalizeConfidencePayload(parseJson(confidenceRaw, {}));
    return res.json({
      report_id: reportId,
      pipeline_status: derivePipelineStatus({ strictAnalysis, extractionFailure, finalReport }),
      ratios: parseJson(ratiosRaw, {}),
      patterns: parseJson(patternsRaw, []),
      risk: parseJson(riskRaw, {}),
      sector_kpis: parseJson(sectorRaw, {}),
      confidence: confidencePayload,
      analysis_coverage: parseJson(analysisCoverageRaw, {}),
      yearly_audit: strictAnalysis?.yearly_audit || {},
      sections: finalReport?.sections || {},
      transparency: finalReport?.transparency || {},
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/fx/latest', async (_req, res, next) => {
  try {
    return res.json(getLatestFxSnapshot());
  } catch (error) {
    return next(error);
  }
});

router.get('/currency/convert', async (req, res, next) => {
  try {
    const reportId = String(req.query.reportId || '').trim();
    const targetCurrency = normalizeCurrency(req.query.target);
    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const fxSnapshot = getLatestFxSnapshot();
    const useUsdCache = targetCurrency === 'USD';
    const cacheKey = useUsdCache ? buildConversionCacheKey(reportId, fxSnapshot.exchange_rate_date) : null;
    if (cacheKey) {
      const cached = getConversionCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const redis = await getRedis();
    const [validatedRaw, ratiosRaw, patternsRaw, sectorRaw, riskRaw, confidenceRaw, analysisCoverageRaw, finalReportRaw] = await Promise.all([
      redis.get(`report:${reportId}:canonical_validated`),
      redis.get(`report:${reportId}:ratios`),
      redis.get(`report:${reportId}:patterns`),
      redis.get(`report:${reportId}:sector_comparison`),
      redis.get(`report:${reportId}:risk`),
      redis.get(`report:${reportId}:confidence`),
      redis.get(`report:${reportId}:analysis_coverage`),
      redis.get(`report:${reportId}:final_report`),
    ]);

    if (!validatedRaw || !ratiosRaw) {
      return res.status(409).json({
        error: 'Currency conversion is available only after calculations complete',
        report_id: reportId,
      });
    }

    const validated = parseJson(validatedRaw, null);
    const convertedValidated = convertValidatedCurrency(validated, targetCurrency, fxSnapshot.fx_rate_lkr_per_usd);
    const convertedValidatedRows = buildValidatedRows(convertedValidated);
    const confidencePayload = parseJson(confidenceRaw, {});
    const derivedConvertedQualityScore = deriveQualityScore(
      convertedValidatedRows,
      Array.isArray(convertedValidated?.validation_issues) ? convertedValidated.validation_issues : [],
      convertedValidated?.deterministic_checks || {}
    );
    const convertedQualityScore = selectCanonicalQualityScore(derivedConvertedQualityScore, confidencePayload) ?? derivedConvertedQualityScore;
    const finalReport = parseJson(finalReportRaw, null);
    const analyticsPayload = {
      report_id: reportId,
      ratios: parseJson(ratiosRaw, {}),
      patterns: parseJson(patternsRaw, []),
      risk: parseJson(riskRaw, {}),
      sector_kpis: parseJson(sectorRaw, {}),
      confidence: normalizeConfidencePayload(confidencePayload, convertedQualityScore),
      analysis_coverage: parseJson(analysisCoverageRaw, {}),
      sections: finalReport?.sections || {},
      transparency: finalReport?.transparency || {},
    };

    const payload = {
      report_id: reportId,
      base_currency: BASE_CURRENCY,
      target_currency: targetCurrency,
      exchange_rate_date: fxSnapshot.exchange_rate_date,
      fx_rate_lkr_per_usd: fxSnapshot.fx_rate_lkr_per_usd,
      converted: {
        validated: {
          ...(convertedValidated || {}),
          validated_rows: convertedValidatedRows,
          overall_data_quality_score: convertedQualityScore,
        },
        analytics: convertAnalyticsCurrency(analyticsPayload, targetCurrency, fxSnapshot.fx_rate_lkr_per_usd),
      },
    };

    if (cacheKey) {
      setConversionCache(cacheKey, payload);
    }

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

router.get('/pipeline/:reportId/errors', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const [extractionFailureRaw, strictAnalysisRaw] = await Promise.all([
      redis.get(`report:${reportId}:extraction_failure`),
      redis.get(`report:${reportId}:strict_analysis`),
    ]);
    const extractionFailure = parseJson(extractionFailureRaw, null);
    const strictAnalysis = parseJson(strictAnalysisRaw, null);
    const pipelineStatus = derivePipelineStatus({ strictAnalysis, extractionFailure });
    const extractionAudit = buildExtractionAuditReport({ strictAnalysis, extractionFailure });

    if (extractionFailure) {
      return res.json({
        report_id: reportId,
        pipeline_status: pipelineStatus,
        extraction_audit: extractionAudit,
        extraction_failure: extractionFailure,
        error_catalog: [
          'EXTRACTION_FAILED: deterministic extraction gate not satisfied',
        ],
        missing_values: [],
        validation_summary: {
          failed_rule_count: 1,
        },
        confidence_distribution: null,
        weak_data_entries: [],
        total_errors: 1,
        total_missing: 0,
        total_weak: 0,
      });
    }

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
      pipeline_status: pipelineStatus,
      extraction_audit: pipelineStatus === 'EXTRACTION_INCOMPLETE' ? extractionAudit : null,
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
    const [rawMeta, rawStages, uploadedFile, canonicalRawStr, validatedStr, ratiosStr, patternsStr, sectorStr, riskStr, confidenceStr, finalReportStr, extractionFailureStr, strictAnalysisStr, strictExtractionStr, extractionCoverageStr, rawExtractionSubstages, rawDocumentStatuses] = await Promise.all([
      redis.get(`report:${reportId}:meta`),
      redis.get(`report:${reportId}:pipeline_stages`),
      redis.get(`report:${reportId}:uploaded_file`),
      redis.get(`report:${reportId}:canonical_raw`),
      redis.get(`report:${reportId}:canonical_validated`),
      redis.get(`report:${reportId}:ratios`),
      redis.get(`report:${reportId}:patterns`),
      redis.get(`report:${reportId}:sector_comparison`),
      redis.get(`report:${reportId}:risk`),
      redis.get(`report:${reportId}:confidence`),
      redis.get(`report:${reportId}:final_report`),
      redis.get(`report:${reportId}:extraction_failure`),
      redis.get(`report:${reportId}:strict_analysis`),
      redis.get(`report:${reportId}:strict_extraction`),
      redis.get(`report:${reportId}:extraction_coverage`),
      redis.get(`report:${reportId}:extraction_substages`),
      redis.hGetAll(`report:${reportId}:document_statuses`),
    ]);

    const meta = parseJson(rawMeta, {});
    const stageState = parseJson(rawStages, {});
    const canonicalRaw = parseJson(canonicalRawStr, null);
    const validated = parseJson(validatedStr, null);
    const ratios = parseJson(ratiosStr, {});
    const patterns = parseJson(patternsStr, []);
    const sector = parseJson(sectorStr, {});
    const risk = parseJson(riskStr, {});
    const confidence = parseJson(confidenceStr, null);
    const finalReport = parseJson(finalReportStr, null);
    const extractionFailure = parseJson(extractionFailureStr, null);
    const strictAnalysis = parseJson(strictAnalysisStr, null);
    const strictExtraction = parseJson(strictExtractionStr, null);
    const extractionCoverage = parseJson(extractionCoverageStr, null);
    const extractionSubstages = parseJson(rawExtractionSubstages, {});
    const documents = parseDocumentStatuses(rawDocumentStatuses);
    const pipelineStatus = derivePipelineStatus({
      stageState,
      strictAnalysis,
      extractionFailure,
      finalReport,
    });
    const pipelineMonitor = buildPipelineMonitor({
      pipelineStatus,
      stageState,
      extractionSubstages,
      documents,
      strictAnalysis,
      strictExtraction,
      extractionCoverage,
      extractionFailure,
    });
    const extractionAudit = buildExtractionAuditReport({ strictAnalysis, extractionFailure });

    if (extractionFailure) {
      return res.status(422).json({
        id: reportId,
        pipeline_status: pipelineStatus,
        workflow_state: 'FAILED',
        pipeline_monitor: pipelineMonitor,
        extraction_audit: extractionAudit,
        extraction_failure: extractionFailure,
        transparency: {
          documents_uploaded: Number(meta.document_count || extractionFailure.pdfs_processed || 1),
          detected_reporting_years: Array.isArray(extractionFailure.years_detected) ? extractionFailure.years_detected : [],
          analysis_executed: ['extraction'],
          analysis_limited: ['Analysis stopped because mandatory extraction metrics were not met'],
        },
      });
    }

    const artifacts = {
      hasUploadedFile: Boolean(uploadedFile),
      hasCanonicalRaw: Boolean(canonicalRaw),
      hasCanonicalValidated: Boolean(validated),
      hasAnalytics: Boolean(ratiosStr || patternsStr || sectorStr || riskStr),
      hasFinalReport: Boolean(finalReport),
    };
    const workflowState = deriveWorkflowStateFromArtifacts(stageState, artifacts, confidence);
    const pipelineTracker = mapLegacyStages(stageState, artifacts.hasUploadedFile, artifacts, extractionSubstages, strictAnalysis);

    const validatedRows = buildValidatedRows(validated);
    const derivedQualityScore = deriveQualityScore(
      validatedRows,
      Array.isArray(validated?.validation_issues) ? validated.validation_issues : [],
      validated?.deterministic_checks || {}
    );
    const qualityScore = selectCanonicalQualityScore(derivedQualityScore, confidence) ?? derivedQualityScore;
    const normalizedConfidence = normalizeConfidencePayload(confidence, qualityScore);

    const narratives = {
      governance: Array.isArray(canonicalRaw?.narrative_sections?.governance) ? canonicalRaw.narrative_sections.governance : [],
      risk: Array.isArray(canonicalRaw?.narrative_sections?.risk) ? canonicalRaw.narrative_sections.risk : [],
      esg: Array.isArray(canonicalRaw?.narrative_sections?.esg) ? canonicalRaw.narrative_sections.esg : [],
      strategy: Array.isArray(canonicalRaw?.narrative_sections?.notes) ? canonicalRaw.narrative_sections.notes : [],
    };

    const detectedYears = Array.isArray(ratios?.detected_years)
      ? ratios.detected_years.filter((y) => typeof y === 'string' && /^\d{4}$/.test(y))
      : [];
    const transparency = {
      documents_uploaded: Number(meta.document_count || 1),
      detected_reporting_years: detectedYears,
      analysis_executed: [
        'extraction',
        'normalization',
        'validation',
        'ratio_engine',
        'risk_analysis',
        'pattern_logic',
        'report_generation',
      ],
      analysis_limited: trendLimitations(detectedYears.length),
    };

    return res.json({
      id: reportId,
      symbol: meta.symbol || 'UNKNOWN',
      name: meta.name || 'Unknown Company',
      sector: meta.sector || 'Diversified',
      pipeline_status: pipelineStatus,
      workflow_state: workflowState,
      pipeline_tracker: pipelineTracker,
      pipeline_monitor: pipelineMonitor,
      extraction_audit: pipelineStatus === 'EXTRACTION_INCOMPLETE' ? extractionAudit : null,
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
        risk,
        sector_kpis: sector,
      },
      confidence: normalizedConfidence,
      narratives,
      transparency,
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

    const pdfPath = finalReport?.pdf_report_path;
    if (pdfPath && fs.existsSync(pdfPath)) {
      return res.download(pdfPath, `analysis_${reportId}.pdf`);
    }

    const content = finalReport.content || JSON.stringify(finalReport, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="analysis_${reportId}.json"`);
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

router.get('/pipeline/:reportId/documents', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const reportId = req.params.reportId;
    const rawStatuses = await redis.hGetAll(`report:${reportId}:document_statuses`);

    const documents = Object.values(rawStatuses || {}).map((raw) => parseJson(raw, null)).filter(Boolean);
    const counts = {
      queued: documents.filter((d) => d.status === 'queued').length,
      running: documents.filter((d) => d.status === 'running').length,
      completed: documents.filter((d) => d.status === 'completed').length,
      failed: documents.filter((d) => d.status === 'failed').length,
      total: documents.length,
    };

    return res.json({ report_id: reportId, documents, counts });
  } catch (error) {
    return next(error);
  }
});

// ── Batch Management API ──────────────────────────────────────────────────
const BATCH_REGISTRY_KEY = 'pipeline:batch_registry';

async function registerBatch(batchId, metadata) {
  const redis = await getRedis();
  const entry = {
    batch_id: batchId,
    created_at: new Date().toISOString(),
    status: 'processing',
    ...metadata,
  };
  await redis.hSet(BATCH_REGISTRY_KEY, batchId, JSON.stringify(entry));
  return entry;
}

async function updateBatchStatus(batchId, updates) {
  const redis = await getRedis();
  const raw = await redis.hGet(BATCH_REGISTRY_KEY, batchId);
  const entry = raw ? JSON.parse(raw) : { batch_id: batchId };
  const updated = { ...entry, ...updates, updated_at: new Date().toISOString() };
  await redis.hSet(BATCH_REGISTRY_KEY, batchId, JSON.stringify(updated));
  return updated;
}

router.get('/batches', async (_req, res, next) => {
  try {
    const redis = await getRedis();
    const all = await redis.hGetAll(BATCH_REGISTRY_KEY);
    const batches = Object.values(all || {})
      .map((raw) => { try { return JSON.parse(raw); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return res.json({ batches, total: batches.length });
  } catch (error) {
    return next(error);
  }
});

router.get('/batches/:batchId/status', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const { batchId } = req.params;
    const raw = await redis.hGet(BATCH_REGISTRY_KEY, batchId);
    if (!raw) return res.status(404).json({ error: 'Batch not found' });
    const batch = JSON.parse(raw);
    let stages = null;
    if (batch.report_id) {
      const stagesRaw = await redis.get(`report:${batch.report_id}:pipeline_stages`);
      stages = stagesRaw ? JSON.parse(stagesRaw) : null;
    }
    return res.json({
      batch_id: batchId,
      ...batch,
      stages: stages ? {
        upload: { status: 'completed', timestamp: batch.created_at },
        extraction: { status: stages.EXTRACTION?.status || 'pending', timestamp: stages.EXTRACTION?.start_time },
        normalization: { status: stages.EXTRACTION?.status === 'completed' ? 'completed' : 'pending' },
        analysis: { status: stages.ANALYSIS?.status || 'pending', timestamp: stages.ANALYSIS?.start_time },
        report_generation: { status: stages.REPORTING?.status || 'pending', timestamp: stages.REPORTING?.start_time },
        completed: { status: stages.REPORTING?.status === 'completed' ? 'completed' : 'pending' },
      } : null,
      current_stage: !stages ? 'upload'
        : stages.REPORTING?.status === 'completed' ? 'completed'
        : stages.REPORTING?.status === 'running' ? 'report_generation'
        : stages.ANALYSIS?.status === 'running' ? 'analysis'
        : stages.EXTRACTION?.status === 'running' ? 'extraction' : 'upload',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/batches/:batchId/results', async (req, res, next) => {
  try {
    const redis = await getRedis();
    const { batchId } = req.params;
    const raw = await redis.hGet(BATCH_REGISTRY_KEY, batchId);
    if (!raw) return res.status(404).json({ error: 'Batch not found' });
    const batch = JSON.parse(raw);
    if (!batch.report_id) {
      return res.json({ batch_id: batchId, status: 'no_results', message: 'No report linked to this batch' });
    }
    const [finalReportRaw, strictAnalysisRaw, ratiosRaw, riskRaw, patternsRaw, confidenceRaw] = await Promise.all([
      redis.get(`report:${batch.report_id}:final_report`),
      redis.get(`report:${batch.report_id}:strict_analysis`),
      redis.get(`report:${batch.report_id}:ratios`),
      redis.get(`report:${batch.report_id}:risk`),
      redis.get(`report:${batch.report_id}:patterns`),
      redis.get(`report:${batch.report_id}:confidence`),
    ]);
    return res.json({
      batch_id: batchId,
      report_id: batch.report_id,
      status: batch.status,
      final_report: parseJson(finalReportRaw),
      analysis: parseJson(strictAnalysisRaw),
      ratios: parseJson(ratiosRaw, {}),
      risk: parseJson(riskRaw, {}),
      patterns: parseJson(patternsRaw, []),
      confidence: parseJson(confidenceRaw, {}),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

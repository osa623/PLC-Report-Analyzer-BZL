function derivePipelineStatus({ stageState, strictAnalysis, extractionFailure, finalReport }) {
  if (extractionFailure) return 'FAILED';
  if (strictAnalysis && strictAnalysis.status === 'EXTRACTION_INCOMPLETE') return 'EXTRACTION_INCOMPLETE';
  if (finalReport) return 'COMPLETED';
  const extraction = stageState?.EXTRACTION?.status;
  const analysis = stageState?.ANALYSIS?.status;
  if (extraction === 'failed' || analysis === 'failed') return 'FAILED';
  if (extraction === 'running' || analysis === 'running') return 'RUNNING';
  return 'PENDING';
}

function parseDocumentStatuses(rawStatuses) {
  if (!rawStatuses) return {};
  try {
    if (typeof rawStatuses === 'string') return JSON.parse(rawStatuses);
    return rawStatuses;
  } catch (e) {
    return Object.keys(rawStatuses).length ? rawStatuses : {};
  }
}

function buildPipelineMonitor({ pipelineStatus, stageState, extractionSubstages, documents, strictAnalysis, strictExtraction, extractionCoverage, extractionFailure }) {
  return {
    status: pipelineStatus,
    stages: stageState || {},
    substages: extractionSubstages || {},
    documents: documents || {},
    strictAnalysis,
    strictExtraction,
    extractionCoverage,
    extractionFailure
  };
}

function buildExtractionAuditReport({ strictAnalysis, extractionFailure }) {
  return { strictAnalysis, extractionFailure };
}

module.exports = {
  derivePipelineStatus,
  parseDocumentStatuses,
  buildPipelineMonitor,
  buildExtractionAuditReport,
};

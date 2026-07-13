const axios = require('axios');
const config = require('../config');

function buildContractEnvelope(reportId, schemaVersion, calculationVersion) {
  return {
    dataset_id: `dataset_${reportId}`,
    schema_version: schemaVersion,
    calculation_version: calculationVersion,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Initialize pipeline stages in Redis before extraction starts.
 * This ensures the frontend always has well-formed stage state.
 */
async function initPipelineStages(reportId) {
  try {
    const { getRedis } = require('./redisClient');
    const redis = await getRedis();
    const stages = {
      EXTRACTION: { status: 'pending', start_time: null, end_time: null, diagnostics: {} },
      ANALYSIS: { status: 'pending', start_time: null, end_time: null, diagnostics: {} },
      REPORTING: { status: 'pending', start_time: null, end_time: null, diagnostics: {} },
    };
    await redis.set(
      `report:${reportId}:pipeline_stages`,
      JSON.stringify(stages),
      'EX',
      86400
    );
  } catch (err) {
    // Non-fatal — extraction service will also initialize stages
    console.error('initPipelineStages failed (non-fatal):', err.message);
  }
}

async function triggerExtract(reportId, fileInput, options = {}) {
  // Ensure pipeline stages are initialized before extraction begins.
  await initPipelineStages(reportId);

  const payload = {
    report_id: reportId,
    ...buildContractEnvelope(reportId, 'financial_statement_model_v1', 'extraction_normalization_v1'),
  };

  if (Array.isArray(fileInput)) {
    payload.file_paths = fileInput;
  } else {
    payload.file_path = fileInput;
  }

  if (options && typeof options === 'object' && options.execution_mode) {
    payload.execution_mode = String(options.execution_mode);
  }

  return axios.post(`${config.extractionServiceUrl}/extract`, payload);
}

async function triggerAnalyze(reportId) {
  return axios.post(`${config.analysisServiceUrl}/analyze`, {
    report_id: reportId,
    ...buildContractEnvelope(reportId, 'analysis_result_model_v1', 'analysis_calculation_engine_v1'),
  });
}

async function triggerGenerateReport(reportId) {
  return axios.post(`${config.reportingServiceUrl}/generate-report`, {
    report_id: reportId,
    ...buildContractEnvelope(reportId, 'dashboard_dto_v1', 'reporting_presentation_v1'),
  });
}

async function triggerFullPipeline(reportId, filePaths) {
  await initPipelineStages(reportId);
  return axios.post(`${config.pipelineOrchestratorUrl}/run-full-pipeline`, {
    report_id: reportId,
    pdf_paths: filePaths,
    ...buildContractEnvelope(reportId, 'pipeline_full_run_v1', 'pipeline_orchestration_v1'),
  });
}

async function triggerRetryDocumentExtraction(reportId, pdfName, selectedPages) {
  return axios.post(`${config.pipelineOrchestratorUrl}/retry-document-extraction`, {
    report_id: reportId,
    pdf_name: pdfName,
    selected_pages: selectedPages,
    ...buildContractEnvelope(reportId, 'pipeline_document_retry_v1', 'extraction_normalization_v1'),
  });
}

async function triggerFinalizeCompletedBatch(reportId) {
  return axios.post(`${config.pipelineOrchestratorUrl}/finalize-completed-batch`, {
    report_id: reportId,
    ...buildContractEnvelope(reportId, 'pipeline_batch_finalize_v1', 'analysis_calculation_engine_v1'),
  });
}

module.exports = { triggerExtract, triggerAnalyze, triggerGenerateReport, triggerFullPipeline, triggerRetryDocumentExtraction, triggerFinalizeCompletedBatch, initPipelineStages };


const axios = require('axios');
const config = require('../config');

async function triggerExtract(reportId, fileInput) {
  const payload = { report_id: reportId };

  if (Array.isArray(fileInput)) {
    payload.file_paths = fileInput;
  } else {
    payload.file_path = fileInput;
  }

  return axios.post(`${config.extractionServiceUrl}/extract`, payload);
}

async function triggerAnalyze(reportId) {
  return axios.post(`${config.analysisServiceUrl}/analyze`, { report_id: reportId });
}

async function triggerGenerateReport(reportId) {
  return axios.post(`${config.reportingServiceUrl}/generate-report`, { report_id: reportId });
}

module.exports = { triggerExtract, triggerAnalyze, triggerGenerateReport };

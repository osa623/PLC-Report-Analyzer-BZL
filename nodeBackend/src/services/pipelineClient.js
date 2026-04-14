const axios = require('axios');
const config = require('../config');

async function triggerExtract(reportId, filePath) {
  return axios.post(`${config.extractionServiceUrl}/extract`, { report_id: reportId, file_path: filePath });
}

async function triggerAnalyze(reportId) {
  return axios.post(`${config.analysisServiceUrl}/analyze`, { report_id: reportId });
}

async function triggerGenerateReport(reportId) {
  return axios.post(`${config.reportingServiceUrl}/generate-report`, { report_id: reportId });
}

module.exports = { triggerExtract, triggerAnalyze, triggerGenerateReport };

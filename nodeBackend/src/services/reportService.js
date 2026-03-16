const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class ReportService {
  constructor({ reportRepository, companyRepository, pipelineEngine, uploadDir }) {
    this.reportRepository = reportRepository;
    this.companyRepository = companyRepository;
    this.pipelineEngine = pipelineEngine;
    this.uploadDir = uploadDir;
  }

  async uploadAndAnalyze({ file, company }) {
    fs.mkdirSync(this.uploadDir, { recursive: true });

    const extension = path.extname(file.originalname) || ".pdf";
    const fileName = `${uuidv4()}${extension}`;
    const targetPath = path.join(this.uploadDir, fileName);

    fs.writeFileSync(targetPath, file.buffer);

    const companyRecord = await this.companyRepository.upsertCompany(company);

    const report = await this.reportRepository.createReport({
      companyId: companyRecord.id,
      filePath: targetPath
    });

    const result = await this.pipelineEngine.execute({
      reportId: report.id,
      filePath: targetPath
    });

    return {
      report,
      generatedReport: result
    };
  }

  async getReport(reportId) {
    return this.reportRepository.getById(reportId);
  }
}

module.exports = { ReportService };

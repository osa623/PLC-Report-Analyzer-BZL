const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class ReportService {
  constructor({ reportRepository, companyRepository, pipelineEngine, uploadDir, serviceClient }) {
    this.reportRepository = reportRepository;
    this.companyRepository = companyRepository;
    this.pipelineEngine = pipelineEngine;
    this.uploadDir = uploadDir;
    this.serviceClient = serviceClient;
  }

  async uploadAndAnalyze({ file, company }) {
    fs.mkdirSync(this.uploadDir, { recursive: true });

    const extension = path.extname(file.originalname) || ".pdf";
    const fileName = `${uuidv4()}${extension}`;
    const targetPath = path.resolve(this.uploadDir, fileName);

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

  async batchUploadAndAnalyze({ batchId, files, company }) {
    fs.mkdirSync(this.uploadDir, { recursive: true });

    const companyRecord = await this.companyRepository.upsertCompany(company);
    const reportResults = [];
    const reportIds = [];

    // Process each PDF through the existing pipeline sequentially
    for (const file of files) {
      const extension = path.extname(file.originalname) || ".pdf";
      const fileName = `${uuidv4()}${extension}`;
      const targetPath = path.resolve(this.uploadDir, fileName);

      fs.writeFileSync(targetPath, file.buffer);

      const report = await this.reportRepository.createReport({
        companyId: companyRecord.id,
        filePath: targetPath
      });

      try {
        const result = await this.pipelineEngine.execute({
          reportId: report.id,
          filePath: targetPath
        });

        reportResults.push({
          report,
          generatedReport: result,
          status: "completed",
          fileName: file.originalname
        });
        reportIds.push(report.id);
      } catch (error) {
        reportResults.push({
          report,
          generatedReport: null,
          status: "failed",
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    // Run comparative analysis across all completed reports
    let comparativeResult = null;
    if (reportIds.length >= 1) {
      try {
        comparativeResult = await this.serviceClient.post(
          "comparative_analysis",
          "/analyze-comparative",
          {
            batch_id: batchId,
            report_ids: reportIds,
            company: {
              symbol: company.symbol,
              name: company.name,
              sector: company.sector
            }
          },
          { timeoutMs: 300000 }
        );

        if (comparativeResult && comparativeResult.status === "completed") {
          try {
            const pdfResult = await this.serviceClient.post(
              "report_generator",
              "/generate-batch-report",
              { batch_id: batchId, company },
              { timeoutMs: 300000 }
            );
            comparativeResult.pdf_path = pdfResult.pdf_path;
          } catch (error) {
            console.error("Batch PDF generation failed:", error.message);
          }
        }
      } catch (error) {
        comparativeResult = {
          status: "failed",
          error: error.message
        };
      }
    }

    return {
      batchId,
      totalFiles: files.length,
      completedReports: reportIds.length,
      reports: reportResults,
      comparativeAnalysis: comparativeResult
    };
  }

  async getBatchResult(batchId) {
    // Batch results are stored by the comparative_analysis service in Redis
    // This is a pass-through to fetch them
    try {
      const result = await this.serviceClient.post(
        "comparative_analysis",
        "/get-batch-result",
        { batch_id: batchId },
        { timeoutMs: 30000 }
      );
      return result;
    } catch {
      return null;
    }
  }

  async getReport(reportId) {
    return this.reportRepository.getById(reportId);
  }
}

module.exports = { ReportService };

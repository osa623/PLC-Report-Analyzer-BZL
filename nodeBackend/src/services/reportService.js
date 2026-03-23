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

  async buildBatchPdf({ batchId, company }) {
    try {
      const pdfResult = await this.serviceClient.post(
        "report_generator",
        "/generate-batch-report",
        { batch_id: batchId, company },
        { timeoutMs: 300000 }
      );
      return pdfResult?.pdf_path || null;
    } catch (error) {
      console.error("Batch PDF generation failed:", error.message);
      return null;
    }
  }

  cleanupSingleReportPdf(generatedReport) {
    const pdfPath = generatedReport?.pdf_path;
    if (!pdfPath) {
      return;
    }

    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    } catch (error) {
      console.warn("Unable to remove single-report PDF during batch cleanup:", error.message);
    }
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
          filePath: targetPath,
          strictAllBackends: false
        });

        // Batch mode should produce one consolidated multi-year PDF, not per-file PDFs.
        this.cleanupSingleReportPdf(result);

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

    // Run comparative analysis across all completed reports and create one consolidated output.
    let comparativeResult = null;
    let consolidatedReport = {
      status: "failed",
      reportType: "multi_year_company_report",
      batchId,
      reportIds,
      pdfPath: null,
      message: "Comparative analysis not available"
    };

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
          comparativeResult.pdf_path = await this.buildBatchPdf({
            batchId,
            company
          });

          consolidatedReport = {
            status: "completed",
            reportType: "multi_year_company_report",
            batchId,
            reportIds,
            pdfPath: comparativeResult.pdf_path || null,
            message: "Consolidated multi-year report generated"
          };
        } else {
          consolidatedReport = {
            status: "failed",
            reportType: "multi_year_company_report",
            batchId,
            reportIds,
            pdfPath: null,
            message: "Comparative analysis did not complete"
          };
        }
      } catch (error) {
        comparativeResult = {
          status: "failed",
          error: error.message
        };

        consolidatedReport = {
          status: "failed",
          reportType: "multi_year_company_report",
          batchId,
          reportIds,
          pdfPath: null,
          message: error.message
        };
      }
    } else {
      consolidatedReport = {
        status: "failed",
        reportType: "multi_year_company_report",
        batchId,
        reportIds,
        pdfPath: null,
        message: "No report completed in batch"
      };
    }

    return {
      batchId,
      totalFiles: files.length,
      completedReports: reportIds.length,
      consolidatedReport,
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

      if (!result || result.status === "not_found") {
        return null;
      }

      // Ensure batch PDF path is available when fetching batch results later.
      if (!result.pdf_path) {
        const company = result.company || {};
        result.pdf_path = await this.buildBatchPdf({
          batchId,
          company
        });
      }

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

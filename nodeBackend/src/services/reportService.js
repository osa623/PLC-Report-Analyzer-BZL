const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  HeadingLevel
} = require("docx");

class ReportService {
  constructor({
    reportRepository,
    companyRepository,
    pipelineEngine,
    uploadDir,
    serviceClient,
    redisClient,
    batchPipelineConcurrency = 3,
    analyticsQualityThreshold = 0.65
  }) {
    this.reportRepository = reportRepository;
    this.companyRepository = companyRepository;
    this.pipelineEngine = pipelineEngine;
    this.uploadDir = uploadDir;
    this.serviceClient = serviceClient;
    this.redisClient = redisClient;
    this.batchPipelineConcurrency = Math.max(1, Number(batchPipelineConcurrency) || 1);
    this.analyticsQualityThreshold = Number(analyticsQualityThreshold) || 0.65;
  }

  // --- Create report record (returns immediately, no pipeline) ---
  async createReportRecord({ file, company }) {
    if (!file || !file.path) {
      throw new Error("File upload failed or missing.");
    }

    const companyRecord = await this.companyRepository.upsertCompany(company);

    const report = await this.reportRepository.createReport({
      companyId: companyRecord.id,
      filePath: file.path
    });

    return { report, company: companyRecord };
  }

  // --- Start pipeline asynchronously (fire-and-forget) ---
  startPipelineAsync(reportId, filePath) {
    this.pipelineEngine.execute({
      reportId,
      filePath,
      strictAllBackends: false
    }).catch(err => {
      console.error(`Pipeline failed for report ${reportId}:`, err.message);
    });
  }

  // --- Single Report Upload & Analysis (sync, kept for batch flow) ---
  async uploadAndAnalyze({ file, company }) {
    if (!file || !file.path) {
        throw new Error("File upload failed or missing.");
    }

    const companyRecord = await this.companyRepository.upsertCompany(company);

    const report = await this.reportRepository.createReport({
      companyId: companyRecord.id,
      filePath: file.path
    });

    const result = await this.pipelineEngine.execute({
      reportId: report.id,
      filePath: file.path
    });

    const latestReport = await this.reportRepository.getById(report.id);

    return {
      report: latestReport || report,
      generatedReport: result
    };
  }

  // --- Batch Upload & Analysis ---
  async batchUploadAndAnalyze({ batchId, files, company }) {
    // 1. Initiate tracking structure
    const initResult = await this.initiateBatch({ batchId, files, company });
    
    // 2. Start background processing
    this.processBatch({ batchId, reports: initResult.reports, company })
      .catch(err => console.error(`Batch processing background error for ${batchId}:`, err));

    return initResult;
  }

  async initiateBatch({ batchId, files, company }) {
    // Ensure upload directory structure (though multer likely handled saving)
    if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    const companyRecord = await this.companyRepository.upsertCompany(company);
    const reports = [];

    // 'files' array comes from multer. Files are already on disk.
    for (const file of files) {
      // Create DB entry for each report
      const report = await this.reportRepository.createReport({
        companyId: companyRecord.id,
        filePath: file.path // Should use the path provided by multer
      });

      reports.push({
        report,
        originalName: file.originalname,
        targetPath: file.path
      });
    }

    // Initialize batch status in Redis
    const initialStatus = {
      batchId,
      status: "processing",
      total: reports.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      lowConfidence: 0,
      reports: reports.map(r => ({
        fileName: r.originalName,
        status: "pending",
        reportId: r.report.id
      }))
    };

    await this.redisClient.setEx(
      `batch:${batchId}`, 
      3600, // Expires in 1 hour
      JSON.stringify(initialStatus)
    );

    return { 
      batchId, 
      message: "Batch upload initiated", 
      reports 
    };
  }

  async processBatch({ batchId, reports, company }) {
    const workerCount = this.batchPipelineConcurrency;
    let nextFileIndex = 0;
    
    // Tracking results for final output
    const reportResults = new Array(reports.length);
    const completedReportIds = new Array(reports.length);

    // Initial Progress Update helper
    const updateBatchProgress = async (index, status, result = null) => {
        const currentData = await this.redisClient.get(`batch:${batchId}`);
        if (!currentData) return;

        const batchState = JSON.parse(currentData);
        batchState.reports[index].status = status;
        
        if (status === 'completed') {
            batchState.succeeded++;
            batchState.processed++;
            // Optionally store result summary if needed, but keep redis object lean
        } else if (status === 'low_confidence') {
          batchState.lowConfidence++;
          batchState.processed++;
        } else if (status === 'failed') {
            batchState.failed++;
            batchState.processed++;
        }

        if (batchState.processed === batchState.total) {
            batchState.status = "completed";
            // Trigger PDF aggregation effectively at the end
        }
        
        await this.redisClient.setEx(`batch:${batchId}`, 3600, JSON.stringify(batchState));
    };


    const processFile = async (item, index) => {
      try {
        await updateBatchProgress(index, "processing", null);

        // Execute Pipeline
        const result = await this.pipelineEngine.execute({
          reportId: item.report.id,
          filePath: item.targetPath,
          strictAllBackends: false
        });

        const isLowConfidence = result?.status === "low_confidence";

        // Cleanup intermediate PDF if generated, to save space (since we make a big batch PDF later)
        this.cleanupSingleReportPdf(result);

        reportResults[index] = {
          report: item.report,
          generatedReport: result,
          status: isLowConfidence ? "low_confidence" : "completed",
          fileName: item.originalName
        };
        if (!isLowConfidence) {
          completedReportIds[index] = item.report.id;
        }
        
        await updateBatchProgress(index, isLowConfidence ? "low_confidence" : "completed", result);

      } catch (error) {
        console.error(`Error processing file ${item.originalName}:`, error);
        reportResults[index] = {
          report: item.report,
          generatedReport: null,
          status: "failed",
          fileName: item.originalName,
          error: error.message
        };
         await updateBatchProgress(index, "failed", null);
      }
    };

    // Worker Pool Implementation
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextFileIndex++; // Atomically increment
        if (currentIndex >= reports.length) {
          return;
        }
        await processFile(reports[currentIndex], currentIndex);
      }
    });

    // Wait for all workers to finish
    await Promise.all(workers);

    // Final Step: Generate Batched PDF Report
    await this.finalizeBatchReport(batchId, completedReportIds.filter(Boolean), company);
  }

  async finalizeBatchReport(batchId, completedReportIds, company) {
    if (completedReportIds.length === 0) return;

    // Call report_generator service to merge/create batch PDF
    const batchPdfPath = await this.buildBatchPdf({ batchId, company });

    // Update Redis with final link
    const currentData = await this.redisClient.get(`batch:${batchId}`);
    if (currentData) {
        const batchState = JSON.parse(currentData);
        batchState.pdfUrl = batchPdfPath; // or download link
        await this.redisClient.setEx(`batch:${batchId}`, 3600, JSON.stringify(batchState));
    }
  }

  // --- Helpers ---

  async buildBatchPdf({ batchId, company }) {
    try {
      // Assuming 'report_generator' service handles this route
      const pdfResult = await this.serviceClient.post(
        "report_generator",
        "/generate-batch-report",
        { batch_id: batchId, company },
        { timeoutMs: 300000 } // 5 min timeout
      );
      return pdfResult?.pdf_path || null;
    } catch (error) {
      console.error("Batch PDF generation failed:", error.message);
      return null;
    }
  }

  cleanupSingleReportPdf(generatedReport) {
    const pdfPath = generatedReport?.pdf_path;
    if (!pdfPath) return;

    try {
      if (fs.existsSync(pdfPath)) {
        // fs.unlinkSync(pdfPath); // Keep partial reports for download
        console.log(`Kept intermediate PDF for report: ${pdfPath}`);
      }
    } catch (error) {
      console.warn("Unable to remove single-report PDF during batch cleanup:", error.message);
    }
  }

  async getBatchResult(batchId) {
    const data = await this.redisClient.get(`batch:${batchId}`);
    return data ? JSON.parse(data) : null;
  }

  async getReport(reportId) {
      const report = await this.reportRepository.getById(reportId);
      if (!report) {
        return null;
      }

      const stageKeys = {
        raw: `report:${reportId}`,
        cleaned: `report:${reportId}:canonical_raw`,
        validated: `report:${reportId}:canonical_validated`,
        ratios: `report:${reportId}:ratios`,
        sectorKpis: `report:${reportId}:sector_kpis`,
        patterns: `report:${reportId}:patterns`,
        governance: `report:${reportId}:governance`,
        risk: `report:${reportId}:risk`,
        esg: `report:${reportId}:esg`,
        strategy: `report:${reportId}:strategy`,
        finalReport: `report:${reportId}:final_report`,
        chunks: `report:${reportId}:document_chunks`,
        structure: `report:${reportId}:structure`
      };

      const dataViews = {
        raw_data: await this.readRedisJson(stageKeys.raw),
        cleaned_data: await this.readRedisJson(stageKeys.cleaned),
        validated_data: await this.readRedisJson(stageKeys.validated)
      };

      const analytics = {
        ratios: await this.readRedisJson(stageKeys.ratios),
        sector_kpis: await this.readRedisJson(stageKeys.sectorKpis),
        patterns: await this.readRedisJson(stageKeys.patterns)
      };

      const narratives = {
        governance: await this.readRedisJson(stageKeys.governance),
        risk: await this.readRedisJson(stageKeys.risk),
        esg: await this.readRedisJson(stageKeys.esg),
        strategy: await this.readRedisJson(stageKeys.strategy)
      };

      const validated = dataViews.validated_data || {};
      const validationSummary = validated.validation_summary || validated.quality_gate || null;
      const overallDataQualityScore =
        validated.overall_data_quality_score ??
        validated.quality_gate?.overall_data_quality_score ??
        null;

      return {
        ...report,
        pipeline_tracker: this.buildPipelineTracker(report.workflow_state, {
          hasChunks: !!(await this.readRedisJson(stageKeys.chunks)),
          hasStructure: !!(await this.readRedisJson(stageKeys.structure)),
          hasRaw: !!dataViews.raw_data,
          hasCanonicalRaw: !!dataViews.cleaned_data,
          hasValidated: !!dataViews.validated_data,
          hasAnalytics: !!(analytics.ratios || analytics.sector_kpis || analytics.patterns),
          hasFinalReport: !!(await this.readRedisJson(stageKeys.finalReport)) || !!report.pdf_path
        }),
        data_views: dataViews,
        confidence: {
          overall_data_quality_score: overallDataQualityScore
        },
        validation: {
          summary: validationSummary,
          errors: validated.error_catalog || validated.validation_errors || [],
          missing_values: validated.missing_value_index || [],
          confidence_distribution: validated.confidence_distribution || null
        },
        analytics,
        narratives
      };
  }

  async getExtractions(reportId) {
    const report = await this.getReport(reportId);
    if (!report) return null;

    const sections = this.buildExtractionSections(report);
    return {
      report_id: reportId,
      workflow_state: report.workflow_state,
      sections,
      available_download_formats: ["json", "md", "csv", "xlsx", "docx", "pdf"]
    };
  }

  async getExtractionBySection(reportId, sectionKey) {
    const report = await this.getReport(reportId);
    if (!report) return null;

    const sections = this.buildExtractionSections(report);
    const section = sections.find((item) => item.key === sectionKey);
    if (!section) {
      return { error: "section_not_found" };
    }

    return {
      report_id: reportId,
      workflow_state: report.workflow_state,
      section,
      available_download_formats: ["json", "md", "csv", "xlsx", "docx", "pdf"]
    };
  }

  async downloadExtractionBySection({ reportId, sectionKey, format }) {
    const payload = await this.getExtractionBySection(reportId, sectionKey);
    if (!payload) return null;
    if (payload.error) return payload;

    const section = payload.section;
    const supportedFormats = ["json", "md", "csv", "xlsx", "docx", "pdf"];
    if (!supportedFormats.includes(format)) {
      return { error: "unsupported_format", supportedFormats };
    }

    const safeReportId = String(reportId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const baseName = `extraction_${section.key}_${safeReportId}`;

    if (format === "json") {
      return {
        fileName: `${baseName}.json`,
        contentType: "application/json",
        buffer: Buffer.from(JSON.stringify(section, null, 2), "utf-8")
      };
    }

    if (format === "md") {
      const markdown = this.sectionToMarkdown(section);
      return {
        fileName: `${baseName}.md`,
        contentType: "text/markdown; charset=utf-8",
        buffer: Buffer.from(markdown, "utf-8")
      };
    }

    if (format === "csv") {
      const csv = this.sectionToCsv(section);
      return {
        fileName: `${baseName}.csv`,
        contentType: "text/csv; charset=utf-8",
        buffer: Buffer.from(csv, "utf-8")
      };
    }

    if (format === "xlsx") {
      const xlsxBuffer = this.sectionToXlsx(section);
      return {
        fileName: `${baseName}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: xlsxBuffer
      };
    }

    if (format === "docx") {
      const docxBuffer = await this.sectionToDocx(section);
      return {
        fileName: `${baseName}.docx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: docxBuffer
      };
    }

    const pdfBuffer = await this.sectionToPdf(section);
    return {
      fileName: `${baseName}.pdf`,
      contentType: "application/pdf",
      buffer: pdfBuffer
    };
  }

  async getAnalyzerView(reportId) {
    const report = await this.getReport(reportId);
    if (!report) return null;

    return {
      report_id: reportId,
      workflow_state: report.workflow_state,
      pipeline_tracker: report.pipeline_tracker,
      accuracy: this.buildAccuracyPayload(report),
      analytics: report.analytics || {},
      validation: report.validation || {}
    };
  }

  async getAnalyzerAccuracy(reportId) {
    const report = await this.getReport(reportId);
    if (!report) return null;

    return {
      report_id: reportId,
      workflow_state: report.workflow_state,
      accuracy: this.buildAccuracyPayload(report)
    };
  }

  buildAccuracyPayload(report) {
    const score = report?.confidence?.overall_data_quality_score;
    const threshold = this.analyticsQualityThreshold;
    const validation = report?.validation || {};
    const errors = Array.isArray(validation.errors) ? validation.errors : [];
    const missingValues = Array.isArray(validation.missing_values) ? validation.missing_values : [];

    return {
      overall_data_quality_score: typeof score === "number" ? score : null,
      quality_threshold: threshold,
      passed:
        typeof score === "number"
          ? score >= threshold && report?.workflow_state !== "FAILED"
          : null,
      validation_errors_count: errors.length,
      missing_values_count: missingValues.length,
      confidence_distribution: validation.confidence_distribution || null,
      validation_summary: validation.summary || null
    };
  }

  buildExtractionSections(report) {
    const raw = report?.data_views?.raw_data || {};
    const narratives = report?.narratives || {};

    const sectionMappings = [
      { key: "income_statement", label: "Income Statement", value: raw.income_statement },
      { key: "balance_sheet", label: "Balance Sheet", value: raw.balance_sheet },
      {
        key: "cashflow_statement",
        label: "Cash Flow Statement",
        value: raw.cashflow_statement || raw.cashflow
      },
      { key: "segments", label: "Segment Analysis", value: raw.segments || raw.segment },
      { key: "oci_statement", label: "OCI Statement", value: raw.oci_statement },
      { key: "equity_statement", label: "Equity Statement", value: raw.equity_statement },
      { key: "governance", label: "Governance", value: narratives.governance || raw.governance },
      { key: "risk", label: "Risk", value: narratives.risk || raw.risk },
      { key: "esg", label: "ESG", value: narratives.esg || raw.esg },
      { key: "strategy", label: "Strategy", value: narratives.strategy || raw.strategy }
    ];

    return sectionMappings
      .map((section) => {
        const blocks = this.toContentBlocks(section.value);
        if (blocks.length === 0) {
          return null;
        }

        return {
          key: section.key,
          label: section.label,
          block_count: blocks.length,
          blocks
        };
      })
      .filter(Boolean);
  }

  toContentBlocks(value) {
    if (value === null || value === undefined) return [];

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      if (value.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
        const columns = this.collectColumns(value);
        return [
          {
            type: "table",
            title: "records",
            columns,
            rows: value
          }
        ];
      }

      return [
        {
          type: "statement",
          title: "content",
          text: value.map((item) => this.valueToString(item)).join("\n")
        }
      ];
    }

    if (typeof value === "object") {
      const blocks = [];
      const scalarRows = [];

      for (const [key, entry] of Object.entries(value)) {
        if (Array.isArray(entry)) {
          if (entry.length === 0) continue;

          if (entry.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
            blocks.push({
              type: "table",
              title: key,
              columns: this.collectColumns(entry),
              rows: entry
            });
            continue;
          }

          blocks.push({
            type: "statement",
            title: key,
            text: entry.map((item) => this.valueToString(item)).join("\n")
          });
          continue;
        }

        if (entry && typeof entry === "object") {
          blocks.push({
            type: "statement",
            title: key,
            text: this.valueToString(entry)
          });
          continue;
        }

        scalarRows.push(`${key}: ${this.valueToString(entry)}`);
      }

      if (scalarRows.length > 0) {
        blocks.unshift({
          type: "statement",
          title: "summary",
          text: scalarRows.join("\n")
        });
      }

      return blocks;
    }

    return [
      {
        type: "statement",
        title: "content",
        text: String(value)
      }
    ];
  }

  collectColumns(rows) {
    const keys = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }

  valueToString(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value, null, 2);
  }

  sectionToMarkdown(section) {
    const lines = [`# ${section.label}`, "", `Section Key: ${section.key}`, ""];

    for (const block of section.blocks || []) {
      lines.push(`## ${block.title || block.type}`);
      lines.push("");

      if (block.type === "statement") {
        lines.push(block.text || "");
        lines.push("");
        continue;
      }

      const columns = Array.isArray(block.columns) ? block.columns : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (columns.length === 0) {
        lines.push("No table columns available.");
        lines.push("");
        continue;
      }

      lines.push(`| ${columns.join(" | ")} |`);
      lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
      rows.forEach((row) => {
        const cells = columns.map((col) => this.escapeMarkdownCell(this.valueToString(row?.[col])));
        lines.push(`| ${cells.join(" | ")} |`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  sectionToCsv(section) {
    const tableBlocks = (section.blocks || []).filter((block) => block.type === "table");
    if (tableBlocks.length === 0) {
      const statementText = (section.blocks || [])
        .filter((block) => block.type === "statement")
        .map((block) => `${block.title}: ${block.text || ""}`)
        .join("\n");
      return `title,text\n${this.toCsvCell(section.label)},${this.toCsvCell(statementText)}\n`;
    }

    const firstTable = tableBlocks[0];
    const columns = Array.isArray(firstTable.columns) ? firstTable.columns : [];
    const rows = Array.isArray(firstTable.rows) ? firstTable.rows : [];

    const csvRows = [columns.map((col) => this.toCsvCell(col)).join(",")];
    rows.forEach((row) => {
      csvRows.push(columns.map((col) => this.toCsvCell(this.valueToString(row?.[col]))).join(","));
    });
    return `${csvRows.join("\n")}\n`;
  }

  sectionToXlsx(section) {
    const workbook = XLSX.utils.book_new();
    const blocks = section.blocks || [];

    const tableBlocks = blocks.filter((block) => block.type === "table");
    if (tableBlocks.length > 0) {
      tableBlocks.forEach((block, idx) => {
        const columns = Array.isArray(block.columns) ? block.columns : [];
        const rows = Array.isArray(block.rows) ? block.rows : [];
        const sheetRows = rows.map((row) => {
          const out = {};
          columns.forEach((col) => {
            out[col] = this.valueToString(row?.[col]);
          });
          return out;
        });

        const worksheet = XLSX.utils.json_to_sheet(sheetRows, {
          header: columns,
          skipHeader: false
        });
        const sheetName = this.normalizeSheetName(`${idx + 1}_${block.title || "table"}`);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
    } else {
      const statementRows = blocks
        .filter((block) => block.type === "statement")
        .map((block) => ({
          title: block.title || "statement",
          text: block.text || ""
        }));
      const worksheet = XLSX.utils.json_to_sheet(statementRows, {
        header: ["title", "text"],
        skipHeader: false
      });
      XLSX.utils.book_append_sheet(workbook, worksheet, "statements");
    }

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }

  async sectionToDocx(section) {
    const children = [
      new Paragraph({
        text: section.label,
        heading: HeadingLevel.HEADING_1
      }),
      new Paragraph({ text: `Section Key: ${section.key}` })
    ];

    for (const block of section.blocks || []) {
      children.push(
        new Paragraph({
          text: block.title || block.type,
          heading: HeadingLevel.HEADING_2
        })
      );

      if (block.type === "statement") {
        children.push(new Paragraph({ text: block.text || "" }));
        continue;
      }

      const columns = Array.isArray(block.columns) ? block.columns : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      const tableRows = [];

      if (columns.length > 0) {
        tableRows.push(
          new TableRow({
            children: columns.map(
              (col) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: col, bold: true })] })]
                })
            )
          })
        );
      }

      rows.forEach((row) => {
        tableRows.push(
          new TableRow({
            children: columns.map(
              (col) =>
                new TableCell({
                  children: [new Paragraph(this.valueToString(row?.[col]))]
                })
            )
          })
        );
      });

      if (tableRows.length > 0) {
        children.push(
          new Table({
            rows: tableRows
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          children
        }
      ]
    });

    return Packer.toBuffer(doc);
  }

  async sectionToPdf(section) {
    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({ margin: 40, size: "A4" });
      const chunks = [];

      pdf.on("data", (chunk) => chunks.push(chunk));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);

      pdf.fontSize(16).text(section.label, { underline: true });
      pdf.moveDown(0.5);
      pdf.fontSize(10).text(`Section Key: ${section.key}`);
      pdf.moveDown();

      for (const block of section.blocks || []) {
        pdf.fontSize(12).text(block.title || block.type, { continued: false });
        pdf.moveDown(0.3);

        if (block.type === "statement") {
          pdf.fontSize(10).text(block.text || "");
          pdf.moveDown();
          continue;
        }

        const columns = Array.isArray(block.columns) ? block.columns : [];
        const rows = Array.isArray(block.rows) ? block.rows : [];
        if (columns.length === 0) {
          pdf.fontSize(10).text("No table columns available.");
          pdf.moveDown();
          continue;
        }

        pdf.fontSize(10).text(columns.join(" | "));
        rows.slice(0, 100).forEach((row) => {
          const line = columns.map((col) => this.valueToString(row?.[col])).join(" | ");
          pdf.fontSize(9).text(line);
        });
        if (rows.length > 100) {
          pdf.fontSize(9).text(`... truncated ${rows.length - 100} rows`);
        }
        pdf.moveDown();
      }

      pdf.end();
    });
  }

  escapeMarkdownCell(value) {
    return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  }

  toCsvCell(value) {
    const str = String(value ?? "").replace(/"/g, '""');
    return `"${str}"`;
  }

  normalizeSheetName(name) {
    const normalized = String(name || "sheet")
      .replace(/[\\\/?*\[\]:]/g, "_")
      .slice(0, 31);
    return normalized || "sheet";
  }

  async readRedisJson(key) {
    const raw = await this.redisClient.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return { raw_value: raw };
    }
  }

  buildPipelineTracker(workflowState, dataPresence) {
    const stageOrder = [
      "UPLOAD",
      "PARSING",
      "STRUCTURE",
      "EXTRACTION",
      "AGGREGATION",
      "VALIDATION",
      "ANALYTICS",
      "REPORT"
    ];

    const stateIndex = {
      UPLOADED: 0,
      PARSING: 1,
      STRUCTURE_DETECTED: 2,
      EXTRACTING: 3,
      AGGREGATING: 4,
      VALIDATING: 5,
      LOW_CONFIDENCE: 5,
      ANALYZING: 6,
      GENERATING_REPORT: 7,
      COMPLETED: 7,
      FAILED: -1
    };

    const idx = stateIndex[workflowState] ?? 0;

    const statusFor = (targetIdx, hasData = false) => {
      if (workflowState === "FAILED" && targetIdx >= Math.max(0, idx)) return "failed";
      if (hasData || idx > targetIdx) return "completed";
      if (idx === targetIdx) return "running";
      return "pending";
    };

    return stageOrder.map((stage, targetIdx) => {
      let hasData = false;
      if (stage === "PARSING") hasData = dataPresence.hasChunks;
      if (stage === "STRUCTURE") hasData = dataPresence.hasStructure;
      if (stage === "EXTRACTION") hasData = dataPresence.hasRaw;
      if (stage === "AGGREGATION") hasData = dataPresence.hasCanonicalRaw;
      if (stage === "VALIDATION") hasData = dataPresence.hasValidated;
      if (stage === "ANALYTICS") hasData = dataPresence.hasAnalytics;
      if (stage === "REPORT") hasData = dataPresence.hasFinalReport;
      if (stage === "UPLOAD") hasData = true;

      let status = statusFor(targetIdx, hasData);
      if (workflowState === "LOW_CONFIDENCE" && (stage === "ANALYTICS" || stage === "REPORT")) {
        status = "skipped";
      }

      return {
        stage,
        status
      };
    });
  }
}

module.exports = { ReportService };

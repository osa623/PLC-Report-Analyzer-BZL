const { v4: uuidv4 } = require("uuid");

class ReportController {
  constructor({ reportService }) {
    this.reportService = reportService;
  }

  async create(req, res) {
    const { symbol, name, sector } = req.body;

    const result = await this.reportService.uploadAndAnalyze({
      file: req.file,
      company: { symbol, name, sector }
    });

    res.status(201).json(result);
  }

  async createBatch(req, res) {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    if (files.length > 10) {
      return res.status(400).json({ error: "Maximum 10 files allowed per batch" });
    }

    const { symbol, name, sector } = req.body;
    const batchId = uuidv4();

    const result = await this.reportService.batchUploadAndAnalyze({
      batchId,
      files,
      company: { symbol, name, sector }
    });

    res.status(201).json(result);
  }

  async getBatchResult(req, res) {
    const result = await this.reportService.getBatchResult(req.params.batchId);

    if (!result) {
      return res.status(404).json({ error: "Batch result not found" });
    }

    return res.status(200).json(result);
  }

  async getById(req, res) {
    const report = await this.reportService.getReport(req.params.reportId);

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json(report);
  }

  async getExtractions(req, res) {
    const payload = await this.reportService.getExtractions(req.params.reportId);
    if (!payload) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json(payload);
  }

  async getExtractionBySection(req, res) {
    const payload = await this.reportService.getExtractionBySection(
      req.params.reportId,
      req.params.sectionKey
    );

    if (!payload) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (payload.error === "section_not_found") {
      return res.status(404).json({ error: "Extraction section not found" });
    }

    return res.status(200).json(payload);
  }

  async downloadExtraction(req, res) {
    const format = String(req.query.format || "md").toLowerCase();
    const download = await this.reportService.downloadExtractionBySection({
      reportId: req.params.reportId,
      sectionKey: req.params.sectionKey,
      format
    });

    if (!download) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (download.error === "section_not_found") {
      return res.status(404).json({ error: "Extraction section not found" });
    }

    if (download.error === "unsupported_format") {
      return res.status(400).json({
        error: "Unsupported format",
        supported_formats: download.supportedFormats || []
      });
    }

    res.setHeader("Content-Type", download.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${download.fileName}"`
    );

    return res.status(200).send(download.buffer);
  }

  async getAnalyzerView(req, res) {
    const payload = await this.reportService.getAnalyzerView(req.params.reportId);
    if (!payload) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json(payload);
  }

  async getAnalyzerAccuracy(req, res) {
    const payload = await this.reportService.getAnalyzerAccuracy(req.params.reportId);
    if (!payload) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json(payload);
  }

  async download(req, res) {
    const report = await this.reportService.getReport(req.params.reportId);

    if (!report || !report.pdf_path) {
      return res.status(404).json({ error: "Report PDF not generated or not found" });
    }

    // Serve the file
    res.download(report.pdf_path, `Analysis_Report_${report.symbol}_${req.params.reportId.slice(0, 8)}.pdf`);
  }
}

module.exports = { ReportController };

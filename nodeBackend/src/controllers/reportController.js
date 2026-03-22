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
}

module.exports = { ReportController };

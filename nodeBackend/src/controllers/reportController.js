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

  async getById(req, res) {
    const report = await this.reportService.getReport(req.params.reportId);

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json(report);
  }
}

module.exports = { ReportController };

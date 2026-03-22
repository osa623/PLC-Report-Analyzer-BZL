const { env } = require("./env");
const { logger } = require("./logger");
const { serviceRegistry } = require("./serviceRegistry");
const { pool } = require("../repositories/db");
const { ReportRepository } = require("../repositories/reportRepository");
const { CompanyRepository } = require("../repositories/companyRepository");
const { ServiceClient } = require("../clients/serviceClient");
const { PipelineEngine } = require("../workflow/pipelineEngine");
const { ReportService } = require("../services/reportService");
const { ReportController } = require("../controllers/reportController");

function createContainer() {
  const reportRepository = new ReportRepository(pool);
  const companyRepository = new CompanyRepository(pool);
  const serviceClient = new ServiceClient({ serviceRegistry, logger });
  const pipelineEngine = new PipelineEngine({
    reportRepository,
    serviceClient,
    logger,
    strictAllBackends: env.pipelineStrictAllBackends
  });
  const reportService = new ReportService({
    reportRepository,
    companyRepository,
    pipelineEngine,
    uploadDir: env.uploadDir,
    serviceClient
  });
  const reportController = new ReportController({ reportService });

  return {
    env,
    logger,
    serviceRegistry,
    reportRepository,
    companyRepository,
    serviceClient,
    pipelineEngine,
    reportService,
    reportController
  };
}

module.exports = { createContainer };

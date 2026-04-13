const { env } = require("./env");
const { logger } = require("./logger");
const { serviceRegistry } = require("./serviceRegistry");
const { pool } = require("../repositories/db");
const { redisClient } = require("./redis");
const { ReportRepository } = require("../repositories/reportRepository");
const { CompanyRepository } = require("../repositories/companyRepository");
const { ServiceClient } = require("../clients/serviceClient");
const { PipelineEngine } = require("../workflow/pipelineEngine");
const { ReportService } = require("../services/reportService");
const { ReportController } = require("../controllers/reportController");
const { PipelineController } = require("../controllers/pipelineController");

function createContainer() {
  const reportRepository = new ReportRepository(pool);
  const companyRepository = new CompanyRepository(pool);
  const serviceClient = new ServiceClient({ serviceRegistry, logger });
  const pipelineEngine = new PipelineEngine({
    reportRepository,
    serviceClient,
    redisClient,
    logger,
    strictAllBackends: env.pipelineStrictAllBackends,
    analyticsQualityThreshold: env.analyticsQualityThreshold,
    consolidatedPipelineMode: env.consolidatedPipelineMode
  });
  const reportService = new ReportService({
    reportRepository,
    companyRepository,
    pipelineEngine,
    uploadDir: env.uploadDir,
    serviceClient,
    redisClient,
    batchPipelineConcurrency: env.batchPipelineConcurrency,
    analyticsQualityThreshold: env.analyticsQualityThreshold
  });
  const reportController = new ReportController({ reportService });
  const pipelineController = new PipelineController({ redisClient, reportRepository });

  return {
    env,
    logger,
    pool,
    redisClient,
    serviceRegistry,
    reportRepository,
    companyRepository,
    serviceClient,
    pipelineEngine,
    reportService,
    reportController,
    pipelineController
  };
}

module.exports = { createContainer };

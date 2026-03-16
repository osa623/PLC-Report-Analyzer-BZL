const express = require("express");
const pinoHttp = require("pino-http");
const { logger } = require("./config/logger");
const { createContainer } = require("./config/container");
const { createReportRoutes } = require("./routes/reportRoutes");
const { createHealthRoutes } = require("./routes/healthRoutes");
const { errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();
  const container = createContainer();

  app.use(express.json({ limit: "5mb" }));
  app.use(pinoHttp({ logger }));

  app.use("/health", createHealthRoutes(container));
  app.use("/reports", createReportRoutes(container));

  app.use(errorHandler(logger));

  return app;
}

module.exports = { createApp };

const express = require("express");
const cors = require("cors");
const pinoHttp = require("pino-http");
const { logger } = require("./config/logger");
const { createContainer } = require("./config/container");
const { createReportRoutes } = require("./routes/reportRoutes");
const { createPipelineRoutes } = require("./routes/pipelineRoutes");
const { createHealthRoutes } = require("./routes/healthRoutes");
const { errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();
  const container = createContainer();
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      // Keep local setup friction-free during development.
      if (container.env.nodeEnv !== "production") {
        return callback(null, true);
      }

      if (container.env.corsAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  };

  app.use(express.json({ limit: "5mb" }));
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(pinoHttp({ logger }));

  app.use("/health", createHealthRoutes(container));
  app.use("/reports", createReportRoutes(container));
  app.use("/pipeline", createPipelineRoutes(container));

  app.use(errorHandler(logger));

  return app;
}

module.exports = { createApp };

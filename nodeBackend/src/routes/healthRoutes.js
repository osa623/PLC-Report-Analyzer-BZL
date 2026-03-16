const express = require("express");

function createHealthRoutes(container) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "orchestrator",
      environment: container.env.nodeEnv
    });
  });

  return router;
}

module.exports = { createHealthRoutes };

const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");

function createPipelineRoutes(container) {
  const router = express.Router();
  const { pipelineController } = container;

  router.get(
    "/:reportId/stages",
    asyncHandler((req, res) => pipelineController.getStages(req, res))
  );

  router.get(
    "/:reportId/raw",
    asyncHandler((req, res) => pipelineController.getRaw(req, res))
  );

  router.get(
    "/:reportId/canonical",
    asyncHandler((req, res) => pipelineController.getCanonical(req, res))
  );

  router.get(
    "/:reportId/validated",
    asyncHandler((req, res) => pipelineController.getValidated(req, res))
  );

  router.get(
    "/:reportId/analytics",
    asyncHandler((req, res) => pipelineController.getAnalytics(req, res))
  );

  router.get(
    "/:reportId/errors",
    asyncHandler((req, res) => pipelineController.getErrors(req, res))
  );

  return router;
}

module.exports = { createPipelineRoutes };

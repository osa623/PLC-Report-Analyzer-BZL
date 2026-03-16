const express = require("express");
const multer = require("multer");
const { asyncHandler } = require("../utils/asyncHandler");

const upload = multer({ storage: multer.memoryStorage() });

function createReportRoutes(container) {
  const router = express.Router();
  const { reportController } = container;

  router.post(
    "/",
    upload.single("report"),
    asyncHandler((req, res) => reportController.create(req, res))
  );

  router.get(
    "/:reportId",
    asyncHandler((req, res) => reportController.getById(req, res))
  );

  return router;
}

module.exports = { createReportRoutes };

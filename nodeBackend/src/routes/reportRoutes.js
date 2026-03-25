const express = require("express");
const multer = require("multer");
const path = require("path");
const { asyncHandler } = require("../utils/asyncHandler");

// Configure disk storage for better handling of large files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

function createReportRoutes(container) {
  const router = express.Router();
  const { reportController } = container;

  router.post(
    "/",
    upload.single("report"),
    asyncHandler((req, res) => reportController.create(req, res))
  );

  router.post(
    "/batch",
    upload.array("reports", 10),
    asyncHandler((req, res) => reportController.createBatch(req, res))
  );

  router.get(
    "/batch/:batchId",
    asyncHandler((req, res) => reportController.getBatchResult(req, res))
  );

  router.get(
    "/:reportId",
    asyncHandler((req, res) => reportController.getById(req, res))
  );

  router.get(
    "/:reportId/download",
    asyncHandler((req, res) => reportController.download(req, res))
  );

  return router;
}

module.exports = { createReportRoutes };

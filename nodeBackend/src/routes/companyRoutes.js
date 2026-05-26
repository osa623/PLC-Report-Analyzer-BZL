const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const config = require("../config");
const { getDb } = require("../services/mongoClient");

const router = Router();

// GET /companies - List all companies
router.get("/companies", async (req, res, next) => {
  try {
    const db = await getDb();
    const list = await db
      .collection("companies")
      .find({}, { projection: { _id: 1, name: 1, sector: 1, updated_at: 1 } })
      .toArray();
      
    const result = list.map((doc) => ({
      id: doc._id,
      name: doc.name || "",
      sector: doc.sector || "General",
      updated_at: doc.updated_at,
    }));
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /company/:id/extracted - Fetch company financials
router.get("/company/:id/extracted", async (req, res, next) => {
  try {
    const db = await getDb();
    const company = await db.collection("companies").findOne({ _id: req.params.id });
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    
    res.json({
      company_id: company._id,
      name: company.name,
      sector: company.sector || "General",
      financials: company.financials || {},
      updated_at: company.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /company/:id/extracted - Update financials after user edits
router.put("/company/:id/extracted", async (req, res, next) => {
  try {
    const db = await getDb();
    const { financials } = req.body;
    if (!financials) {
      return res.status(400).json({ error: "Financials are required in request body" });
    }
    
    const result = await db.collection("companies").updateOne(
      { _id: req.params.id },
      {
        $set: {
          financials,
          updated_at: new Date(),
        },
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Company not found" });
    }
    
    res.json({ success: true, message: "Extracted data updated successfully" });
  } catch (err) {
    next(err);
  }
});

// POST /company/:id/reanalyse - Rerun calculations on updated financials
router.post("/company/:id/reanalyse", async (req, res, next) => {
  try {
    const db = await getDb();
    const company = await db.collection("companies").findOne({ _id: req.params.id });
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    
    // Build the extraction_dataset format
    const dataset = {
      company_name: company.name || "Unknown",
      company: company.name || "Unknown",
      currency: company.currency || "LKR_millions",
      years: company.financials || {},
      financial_graph: company.financials || {},
      metadata: company.metadata || {},
    };
    
    // POST to analysis microservice '/analyze-dataset'
    const response = await axios.post(`${config.analysisServiceUrl}/analyze-dataset`, dataset);
    const analysisResult = response.data;
    
    const reportId = uuidv4();
    
    // Save latest analysis result
    const analysisDoc = {
      company_id: req.params.id,
      report_id: reportId,
      analyzed_at: new Date(),
      ratios: analysisResult.yearly_ratios || {},
      patterns: analysisResult.growth_metrics || {},
      risk: analysisResult.validation_gates || {},
      scores: analysisResult.scores || {},
      evaluated_equations_by_year: analysisResult.evaluated_equations_by_year || {},
      sector_adjustments: analysisResult.sector_adjustments || {},
      version: "1.0",
    };
    await db.collection("analysis_results").insertOne(analysisDoc);
    
    // Append to analysis history
    const runEntry = {
      report_id: reportId,
      timestamp: new Date(),
      version: "v1.0",
      scores: analysisResult.scores || {},
    };
    
    await db.collection("analysis_history").updateOne(
      { company_id: req.params.id },
      {
        $push: {
          runs: {
            $each: [runEntry],
            $position: 0,
          },
        },
      },
      { upsert: true }
    );
    
    // Save key analysis and extraction datasets in Redis for downstream report generation
    try {
      const { getRedis } = require("../services/redisClient");
      const redisClient = await getRedis();
      const ttl = 86400; // 1 day TTL
      
      await redisClient.set(`report:${reportId}:strict_extraction`, JSON.stringify(dataset), "EX", ttl);
      await redisClient.set(`report:${reportId}:strict_analysis`, JSON.stringify(analysisResult), "EX", ttl);
      
      // Save other artifacts so pipeline can query them if needed
      await redisClient.set(`report:${reportId}:ratios`, JSON.stringify(analysisResult.yearly_ratios || {}), "EX", ttl);
      await redisClient.set(`report:${reportId}:patterns`, JSON.stringify(analysisResult.growth_metrics || {}), "EX", ttl);
      await redisClient.set(`report:${reportId}:validation_gates`, JSON.stringify(analysisResult.validation_gates || {}), "EX", ttl);
      await redisClient.set(`report:${reportId}:scores`, JSON.stringify(analysisResult.scores || {}), "EX", ttl);
    } catch (redisErr) {
      console.error("Failed to populate Redis for re-analysis (non-fatal):", redisErr.message);
    }
    
    res.json({ success: true, report_id: reportId, message: "Re-analysis complete" });
  } catch (err) {
    next(err);
  }
});

// GET /company/:id/analysis - Fetch latest analysis result
router.get("/company/:id/analysis", async (req, res, next) => {
  try {
    const db = await getDb();
    const latestAnalysis = await db
      .collection("analysis_results")
      .find({ company_id: req.params.id })
      .sort({ analyzed_at: -1 })
      .limit(1)
      .toArray();
      
    if (latestAnalysis.length === 0) {
      return res.status(404).json({ error: "No analysis results found for this company" });
    }
    
    const analysis = latestAnalysis[0];
    res.json({
      company_id: req.params.id,
      latest_run: {
        ratios: analysis.ratios || {},
        patterns: analysis.patterns || {},
        risk: analysis.risk || {},
        scores: analysis.scores || {},
        evaluated_equations_by_year: analysis.evaluated_equations_by_year || {},
        analyzed_at: analysis.analyzed_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /company/:id/history - Expose history of previous runs
router.get("/company/:id/history", async (req, res, next) => {
  try {
    const db = await getDb();
    const history = await db.collection("analysis_history").findOne({ company_id: req.params.id });
    res.json({
      company_id: req.params.id,
      runs: history ? history.runs || [] : [],
    });
  } catch (err) {
    next(err);
  }
});

// GET /company/:id/export - Generate and stream PDF report
router.get("/company/:id/export", async (req, res, next) => {
  try {
    const db = await getDb();
    const latestAnalysis = await db
      .collection("analysis_results")
      .find({ company_id: req.params.id })
      .sort({ analyzed_at: -1 })
      .limit(1)
      .toArray();
      
    if (latestAnalysis.length === 0) {
      return res.status(404).json({ error: "No analysis results found for this company" });
    }
    
    const reportId = latestAnalysis[0].report_id;
    
    // Attempt to invoke report generation before streaming the PDF
    try {
      const { getRedis } = require("../services/redisClient");
      const redisClient = await getRedis();
      const ttl = 86400;
      
      const company = await db.collection("companies").findOne({ _id: req.params.id });
      
      const dataset = {
        company_name: company.name || "Unknown",
        company: company.name || "Unknown",
        currency: company.currency || "LKR_millions",
        years: company.financials || {},
        financial_graph: company.financials || {},
        metadata: company.metadata || {},
      };
      
      const analysisResult = {
        status: "COMPLETED",
        yearly_ratios: latestAnalysis[0].ratios,
        growth_metrics: latestAnalysis[0].patterns,
        validation_gates: latestAnalysis[0].risk,
        scores: latestAnalysis[0].scores,
        evaluated_equations_by_year: latestAnalysis[0].evaluated_equations_by_year,
        sector_adjustments: latestAnalysis[0].sector_adjustments || {},
      };
      
      await redisClient.set(`report:${reportId}:strict_extraction`, JSON.stringify(dataset), "EX", ttl);
      await redisClient.set(`report:${reportId}:strict_analysis`, JSON.stringify(analysisResult), "EX", ttl);
      
      // Call /generate-report
      await axios.post(`${config.reportingServiceUrl}/generate-report`, {
        report_id: reportId,
        dataset_id: `dataset_${reportId}`,
        schema_version: "financial_statement_model_v1",
        calculation_version: "reporting_presentation_v1",
      });
    } catch (genErr) {
      console.error("Failed to pre-generate report (non-fatal):", genErr.message);
    }
    
    // Proxy the PDF file stream
    try {
      const response = await axios({
        method: "get",
        url: `${config.reportingServiceUrl}/report/${reportId}/pdf`,
        responseType: "stream",
      });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${req.params.id}_report.pdf`);
      response.data.pipe(res);
    } catch (streamErr) {
      console.error("Failed to stream report PDF:", streamErr.message);
      res.status(500).json({ error: "Failed to stream report file" });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;

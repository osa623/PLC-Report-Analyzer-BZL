const express = require('express');
const cors = require('cors');
const pipelineRoutes = require('./routes/pipelineRoutes');
const companyRoutes = require('./routes/companyRoutes');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'node-backend' }));
  app.use('/', pipelineRoutes);
  app.use('/', companyRoutes);

  app.use((err, _req, res, _next) => {
    const message = err.response?.data || err.message || 'Internal server error';
    res.status(err.response?.status || 500).json({ error: message });
  });

  return app;
}

module.exports = { createApp };

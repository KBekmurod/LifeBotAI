'use strict';

const express = require('express');
const cors = require('cors');
const { PORT } = require('./config/env');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Auth routes
app.use('/auth', require('./routes/auth'));

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

if (require.main === module) {
  start();
}

module.exports = app;

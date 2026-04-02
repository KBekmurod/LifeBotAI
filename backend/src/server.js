'use strict';

const express = require('express');
const cors = require('cors');
const { PORT, WEBHOOK_URL } = require('./config/env');
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

// Auth routes (Step 1.3)
app.use('/auth', require('./routes/auth'));

// Chat/AI routes (Step 1.4)
app.use('/chat', require('./routes/chat'));

// Telegram bot webhook (Step 1.4)
app.use('/bot', require('./routes/bot'));

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

  // Register Telegram webhook when a URL is configured
  if (WEBHOOK_URL) {
    const { setupWebhook } = require('./bot');
    await setupWebhook(WEBHOOK_URL).catch((err) =>
      logger.warn('Failed to register Telegram webhook:', err.message)
    );
  }
};

if (require.main === module) {
  start();
}

module.exports = app;

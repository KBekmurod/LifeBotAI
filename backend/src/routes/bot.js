'use strict';

/**
 * Bot Webhook Route — Step 1.4
 *
 * POST /bot/webhook
 *
 * Receives Telegram update objects and forwards them to the Telegraf bot
 * instance for processing.  This endpoint must be publicly accessible over
 * HTTPS and registered with Telegram via `bot.telegram.setWebhook()`.
 */

const express = require('express');
const { bot } = require('../bot');
const logger  = require('../utils/logger');

const router = express.Router();

/**
 * POST /bot/webhook
 *
 * Telegram calls this endpoint for every incoming update.
 * When the bot is not initialised (missing token) the handler responds with
 * 503 so that Telegram knows it should retry later.
 */
router.post('/webhook', (req, res) => {
  if (!bot) {
    logger.warn('POST /bot/webhook called but bot is not initialised');
    return res.status(503).json({ error: 'Bot is not initialised' });
  }

  // Telegraf's built-in webhook callback processes the update and calls res.end()
  return bot.handleUpdate(req.body, res);
});

module.exports = router;

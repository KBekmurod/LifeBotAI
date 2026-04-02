'use strict';

/**
 * Telegram Bot — Step 1.4
 *
 * Initialises a Telegraf bot instance with command and message handlers.
 * The bot is configured to run in webhook mode (suitable for production) and
 * in polling mode during local development when WEBHOOK_URL is not set.
 *
 * Exported:
 *   bot          — the Telegraf instance (for webhook integration)
 *   setupWebhook — registers the webhook with Telegram
 */

const { Telegraf } = require('telegraf');
const { TELEGRAM_BOT_TOKEN, WEBHOOK_URL, NODE_ENV } = require('../config/env');
const logger = require('../utils/logger');

if (!TELEGRAM_BOT_TOKEN) {
  // A missing token is not fatal during tests; the bot simply won't start.
  logger.warn('TELEGRAM_BOT_TOKEN is not set — Telegram bot will not start.');
}

const bot = TELEGRAM_BOT_TOKEN ? new Telegraf(TELEGRAM_BOT_TOKEN) : null;

// ─── Command handlers ─────────────────────────────────────────────────────────

if (bot) {
  /**
   * /start — greet the user and explain the bot.
   */
  bot.start((ctx) => {
    // Default greeting in Uzbek — the bot's primary language
    const name = ctx.from?.first_name || 'foydalanuvchi';
    return ctx.reply(
      `Salom, ${name}! 👋\n\n` +
      'Men LifeBotAI — sizning shaxsiy hayot arxivi yordamchingizman.\n\n' +
      '📝 Xotiralaringizni yozib qoldiring\n' +
      '💬 /newchat — yangi AI suhbat boshlash\n' +
      '❓ /help — barcha buyruqlar ro\'yxati'
    );
  });

  /**
   * /help — list available commands.
   */
  bot.help((ctx) =>
    ctx.reply(
      '🤖 LifeBotAI buyruqlari:\n\n' +
      '/start   — botni ishga tushirish\n' +
      '/newchat — yangi AI suhbat boshlash\n' +
      '/endchat — joriy suhbatni tugatish\n' +
      '/help    — ushbu yordam xabari'
    )
  );

  /**
   * /newchat — instruct the user how to start a session via the REST API.
   */
  bot.command('newchat', (ctx) =>
    ctx.reply(
      '💬 Yangi suhbat boshlash uchun:\n\n' +
      'REST API: POST /chat/sessions\n' +
      'Sizning JWT tokeningiz kerak bo\'ladi.\n\n' +
      'Token olish uchun: POST /auth/telegram'
    )
  );

  /**
   * /endchat — instruct the user how to close a session via the REST API.
   */
  bot.command('endchat', (ctx) =>
    ctx.reply(
      '🔚 Suhbatni yakunlash uchun:\n\n' +
      'REST API: PATCH /chat/sessions/:id/close\n' +
      'Sizning JWT tokeningiz va session ID kerak bo\'ladi.'
    )
  );

  /**
   * Plain text messages — acknowledge and guide the user to use the REST API
   * for a full AI chat experience.
   */
  bot.on('text', (ctx) => {
    const text = ctx.message?.text || '';
    if (text.startsWith('/')) return; // ignore unknown commands here
    return ctx.reply(
      '✍️ Xabaringizni qabul qildim!\n\n' +
      'To\'liq AI suhbat uchun REST API dan foydalaning:\n' +
      'POST /chat/sessions/:id/messages\n\n' +
      'Agar hali session ochmagan bo\'lsangiz, avval /newchat ni bajaring.'
    );
  });

  /**
   * Global error handler — log and silently swallow Telegraf errors so that
   * a single bad update does not crash the whole process.
   */
  bot.catch((err, ctx) => {
    logger.error(`Telegraf error for update ${ctx?.update?.update_id}:`, err.message);
  });
}

// ─── Webhook setup ────────────────────────────────────────────────────────────

/**
 * Register the webhook with Telegram and return the secret path used in the
 * webhook URL.  Call this once at server startup when WEBHOOK_URL is set.
 *
 * @param {string} webhookUrl  Full HTTPS URL, e.g. https://example.com/bot/webhook
 * @returns {Promise<void>}
 */
const setupWebhook = async (webhookUrl) => {
  if (!bot) return;
  await bot.telegram.setWebhook(webhookUrl);
  logger.info(`Telegram webhook set to: ${webhookUrl}`);
};

module.exports = { bot, setupWebhook };

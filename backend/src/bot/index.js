'use strict';

/**
 * Telegram Bot — Step 1.4 (enhanced)
 *
 * Initialises a Telegraf bot instance with command and message handlers.
 * The bot is configured to run in webhook mode (suitable for production) and
 * in polling mode during local development when WEBHOOK_URL is not set.
 *
 * Inline AI chat: plain text messages are handled directly — the bot
 * auto-registers the user, finds or creates an open chat session, and
 * replies with an AI-generated response.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find or create a User document from a Telegram context.
 * @param {import('telegraf').Context} ctx
 * @returns {Promise<import('mongoose').Document>}
 */
const findOrCreateUser = async (ctx) => {
  const { User } = require('../models');
  const from = ctx.from || {};
  const telegramId = String(from.id);

  return User.findOneAndUpdate(
    { telegramId },
    {
      $set: {
        firstName: from.first_name || 'foydalanuvchi',
        ...(from.last_name  && { lastName: from.last_name }),
        ...(from.username   && { username: from.username }),
        ...(from.language_code && { language: from.language_code }),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
};

/**
 * Find the user's most-recent open chat session, or create a new one.
 * @param {import('mongoose').Types.ObjectId} userId
 * @returns {Promise<import('mongoose').Document>}
 */
const findOrCreateSession = async (userId) => {
  const { AiChat } = require('../models');
  let session = await AiChat.findOne({ userId, status: 'open' }).sort({ createdAt: -1 });
  if (!session) {
    session = await AiChat.create({ userId, isLegacyMode: false });
  }
  return session;
};

// ─── Command handlers ─────────────────────────────────────────────────────────

if (bot) {
  /**
   * /start — greet the user, auto-register them, and explain the bot.
   */
  bot.start(async (ctx) => {
    try {
      await findOrCreateUser(ctx);
    } catch (err) {
      logger.warn('bot /start: could not register user:', err.message);
    }
    const name = ctx.from?.first_name || 'foydalanuvchi';
    return ctx.reply(
      `Salom, ${name}! 👋\n\n` +
      'Men LifeBotAI — sizning shaxsiy hayot arxivi yordamchingizman.\n\n' +
      '📝 Menga xabar yuboring — men AI yordamida javob beraman\n' +
      '💬 /newchat — yangi suhbat boshlash\n' +
      '🔚 /endchat — joriy suhbatni tugatish\n' +
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
      '/help    — ushbu yordam xabari\n\n' +
      'Yoki shunchaki menga xabar yuboring — AI javob beradi!'
    )
  );

  /**
   * /newchat — close any open session and start a new one.
   */
  bot.command('newchat', async (ctx) => {
    try {
      const { AiChat } = require('../models');
      const user = await findOrCreateUser(ctx);

      // Close any existing open session
      await AiChat.updateMany(
        { userId: user._id, status: 'open' },
        { $set: { status: 'closed', closedAt: new Date() } }
      );

      // Create a fresh session
      await AiChat.create({ userId: user._id, isLegacyMode: false });

      return ctx.reply(
        '💬 Yangi suhbat boshlandi!\n\n' +
        'Endi menga xabar yuboring — men AI yordamida javob beraman.'
      );
    } catch (err) {
      logger.error('bot /newchat error:', err.message);
      return ctx.reply('❌ Yangi suhbat boshlashda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  });

  /**
   * /endchat — close the current open session.
   */
  bot.command('endchat', async (ctx) => {
    try {
      const { AiChat } = require('../models');
      const user = await findOrCreateUser(ctx);

      const result = await AiChat.updateMany(
        { userId: user._id, status: 'open' },
        { $set: { status: 'closed', closedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return ctx.reply('ℹ️ Faol suhbat topilmadi.');
      }

      return ctx.reply(
        '🔚 Suhbat tugatildi.\n\n' +
        'Yangi suhbat boshlash uchun /newchat buyrug\'ini yuboring.'
      );
    } catch (err) {
      logger.error('bot /endchat error:', err.message);
      return ctx.reply('❌ Suhbatni tugatishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
    }
  });

  /**
   * Plain text messages — auto-register the user, find/create a session,
   * generate an AI reply and send it back.
   */
  bot.on('text', async (ctx) => {
    const text = ctx.message?.text || '';
    if (text.startsWith('/')) return; // ignore unknown commands here

    try {
      const { generateReply } = require('../services/aiService');

      // 1. Find or create the user
      const user = await findOrCreateUser(ctx);

      // 2. Find or create an open chat session
      const session = await findOrCreateSession(user._id);

      // 3. Build conversation history (last 20 messages to keep context lean)
      const history = session.messages
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));

      // 4. Generate AI reply
      const { content: aiContent, tokens } = await generateReply(history, text.trim());

      // 5. Persist both messages
      session.messages.push({ role: 'user', content: text.trim() });
      session.messages.push({ role: 'assistant', content: aiContent });
      session.totalTokens += tokens;
      await session.save();

      // 6. Reply to the user
      return ctx.reply(aiContent);
    } catch (err) {
      logger.error('bot text handler error:', err.message);
      return ctx.reply(
        '❌ Xatolik yuz berdi. Iltimos, bir oz kutib qayta urinib ko\'ring.'
      );
    }
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

module.exports = { bot, setupWebhook, findOrCreateUser, findOrCreateSession };

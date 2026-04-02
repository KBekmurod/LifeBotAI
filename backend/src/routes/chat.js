'use strict';

/**
 * Chat Routes — Step 1.4
 *
 * REST API for managing AI chat sessions.  All routes require a valid JWT
 * token (via the `authenticate` middleware).
 *
 * POST   /chat/sessions              — Create a new chat session
 * GET    /chat/sessions              — List the current user's chat sessions
 * GET    /chat/sessions/:id          — Get a specific session (with messages)
 * POST   /chat/sessions/:id/messages — Send a message and receive an AI reply
 * PATCH  /chat/sessions/:id/close    — Close (end) a chat session
 */

const express      = require('express');
const mongoose     = require('mongoose');
const rateLimit    = require('express-rate-limit');
const { AiChat }   = require('../models');
const authenticate = require('../middleware/auth');
const { generateReply } = require('../services/aiService');
const logger       = require('../utils/logger');

const router = express.Router();

// Allow up to 60 chat API requests per IP per minute
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Rate limiting must come before authentication so every request is throttled
router.use(chatLimiter);

// All chat routes require authentication
router.use(authenticate);

// ─── POST /chat/sessions ─────────────────────────────────────────────────────

/**
 * Create a new chat session.
 *
 * Body (all optional):
 *   isLegacyMode   {boolean} — true for heir/legacy conversations
 *   heirTelegramId {string}  — Telegram ID of the heir (legacy mode only)
 *
 * Response 201: { session: AiChat }
 */
router.post('/sessions', async (req, res) => {
  try {
    const { isLegacyMode = false, heirTelegramId = null } = req.body;

    const session = await AiChat.create({
      userId: req.user._id,
      isLegacyMode: Boolean(isLegacyMode),
      heirTelegramId: heirTelegramId ? String(heirTelegramId) : null,
    });

    return res.status(201).json({ session });
  } catch (err) {
    logger.error('POST /chat/sessions error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /chat/sessions ──────────────────────────────────────────────────────

/**
 * List the current user's chat sessions (most recent first).
 *
 * Query params:
 *   limit  {number} — max results (default 20, max 100)
 *   skip   {number} — offset for pagination (default 0)
 *   status {string} — filter by 'open' or 'closed'
 *
 * Response 200: { sessions: AiChat[], total: number }
 */
router.get('/sessions', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit, 10)  || 20, 100);
    const skip   = Math.max(parseInt(req.query.skip,  10)  || 0,  0);
    const filter = { userId: req.user._id };

    if (req.query.status === 'open' || req.query.status === 'closed') {
      // Allowlist check — only these two literal strings are accepted
      filter.status = req.query.status === 'open' ? 'open' : 'closed';
    }

    const [sessions, total] = await Promise.all([
      AiChat.find(filter, { messages: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AiChat.countDocuments(filter),
    ]);

    return res.status(200).json({ sessions, total });
  } catch (err) {
    logger.error('GET /chat/sessions error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /chat/sessions/:id ──────────────────────────────────────────────────

/**
 * Get a specific chat session including its full message history.
 *
 * Response 200: { session: AiChat }
 * Response 404: { error: 'Session not found' }
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = await AiChat.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json({ session });
  } catch (err) {
    logger.error('GET /chat/sessions/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /chat/sessions/:id/messages ────────────────────────────────────────

/**
 * Send a user message to a chat session and receive an AI reply.
 *
 * Body:
 *   content {string} — the user's message (required)
 *
 * Response 200: { userMessage: object, assistantMessage: object }
 * Response 400: { error: string }
 * Response 404: { error: 'Session not found' }
 * Response 409: { error: 'Session is closed' }
 */
router.post('/sessions/:id/messages', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { content } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const session = await AiChat.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'closed') {
      return res.status(409).json({ error: 'Session is closed' });
    }

    // Build conversation history for the AI (exclude memoryRefs to keep it lean)
    const history = session.messages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));

    // Generate AI reply
    const { content: aiContent, tokens } = await generateReply(history, content.trim());

    // Persist both the user message and the AI reply atomically
    const userMsg = { role: 'user',      content: content.trim() };
    const aiMsg   = { role: 'assistant', content: aiContent };

    session.messages.push(userMsg, aiMsg);
    session.totalTokens += tokens;
    await session.save();

    const savedMessages = session.messages;
    const userMessage      = savedMessages[savedMessages.length - 2];
    const assistantMessage = savedMessages[savedMessages.length - 1];

    return res.status(200).json({ userMessage, assistantMessage });
  } catch (err) {
    logger.error('POST /chat/sessions/:id/messages error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /chat/sessions/:id/close ─────────────────────────────────────────

/**
 * Close a chat session.  Closed sessions are read-only.
 *
 * Response 200: { session: AiChat }
 * Response 404: { error: 'Session not found' }
 * Response 409: { error: 'Session is already closed' }
 */
router.patch('/sessions/:id/close', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = await AiChat.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'closed') {
      return res.status(409).json({ error: 'Session is already closed' });
    }

    session.status   = 'closed';
    session.closedAt = new Date();
    await session.save();

    return res.status(200).json({ session });
  } catch (err) {
    logger.error('PATCH /chat/sessions/:id/close error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

'use strict';

/**
 * Memory Routes — Step 1.5
 *
 * REST API for managing user memories (life archive entries).
 * All routes require a valid JWT token (via the `authenticate` middleware).
 *
 * POST   /memories          — Save a new memory
 * GET    /memories          — List the current user's memories (paginated)
 * GET    /memories/:id      — Get a specific memory
 * DELETE /memories/:id      — Delete a specific memory
 */

const express      = require('express');
const mongoose     = require('mongoose');
const rateLimit    = require('express-rate-limit');
const { Memory }   = require('../models');
const authenticate = require('../middleware/auth');
const logger       = require('../utils/logger');

const router = express.Router();

// Allow up to 60 memory API requests per IP per minute
const memoryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

router.use(memoryLimiter);
router.use(authenticate);

// ─── POST /memories ──────────────────────────────────────────────────────────

/**
 * Save a new memory entry.
 *
 * Body:
 *   type        {string}   — required; one of: voice, text, photo, video, document
 *   content     {string}   — text content (required for type=text)
 *   tags        {string[]} — optional list of tags
 *   memorizedAt {string}   — ISO date of when the event happened (optional)
 *
 * Response 201: { memory: Memory }
 */
router.post('/', async (req, res) => {
  try {
    const { type, content, tags, memorizedAt } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    const VALID_TYPES = ['voice', 'text', 'photo', 'video', 'document'];
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    if (type === 'text' && (!content || typeof content !== 'string' || !content.trim())) {
      return res.status(400).json({ error: 'content is required for text memories' });
    }

    const memoryData = {
      userId: req.user._id,
      type,
      content: content ? String(content).trim() : null,
      tags:    Array.isArray(tags) ? tags.map(String) : [],
    };

    if (memorizedAt) {
      const date = new Date(memorizedAt);
      if (!isNaN(date.getTime())) {
        memoryData.memorizedAt = date;
      }
    }

    const memory = await Memory.create(memoryData);
    return res.status(201).json({ memory });
  } catch (err) {
    logger.error('POST /memories error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /memories ───────────────────────────────────────────────────────────

/**
 * List the current user's memories (most recent first).
 *
 * Query params:
 *   limit  {number} — max results (default 20, max 100)
 *   skip   {number} — offset for pagination (default 0)
 *   type   {string} — filter by memory type
 *   tags   {string} — comma-separated list of tags to filter by
 *
 * Response 200: { memories: Memory[], total: number }
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip  = Math.max(parseInt(req.query.skip,  10) || 0,  0);

    const filter = { userId: req.user._id, isArchived: false };

    const VALID_TYPES = ['voice', 'text', 'photo', 'video', 'document'];
    if (req.query.type && VALID_TYPES.includes(req.query.type)) {
      filter.type = req.query.type;
    }

    if (req.query.tags) {
      const rawTags = String(req.query.tags).split(',');
      const tags = rawTags
        // Sanitize each tag: allow only alphanumeric, hyphen, underscore, spaces
        .map((t) => t.trim().replace(/[^a-zA-Z0-9_\- ]/g, ''))
        .filter(Boolean)
        .slice(0, 20); // limit to 20 tags per query
      if (tags.length > 0) {
        filter.tags = { $in: tags };
      }
    }

    const [memories, total] = await Promise.all([
      Memory.find(filter, { embedding: 0 })
        .sort({ memorizedAt: -1 })
        .skip(skip)
        .limit(limit),
      Memory.countDocuments(filter),
    ]);

    return res.status(200).json({ memories, total });
  } catch (err) {
    logger.error('GET /memories error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /memories/:id ───────────────────────────────────────────────────────

/**
 * Get a specific memory by ID.
 *
 * Response 200: { memory: Memory }
 * Response 404: { error: 'Memory not found' }
 */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    const memory = await Memory.findOne(
      { _id: req.params.id, userId: req.user._id },
      { embedding: 0 }
    );

    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    return res.status(200).json({ memory });
  } catch (err) {
    logger.error('GET /memories/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /memories/:id ────────────────────────────────────────────────────

/**
 * Delete a specific memory (soft-delete via isArchived flag).
 * Idempotent: returns 200 even if the memory is already archived.
 *
 * Response 200: { ok: true }
 * Response 404: { error: 'Memory not found' }
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    const memory = await Memory.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isArchived: true } },
      { new: true }
    );

    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('DELETE /memories/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

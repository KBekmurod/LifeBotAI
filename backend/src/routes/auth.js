'use strict';

const express   = require('express');
const rateLimit = require('express-rate-limit');
const { User }  = require('../models');
const { signToken } = require('../utils/jwt');
const logger = require('../utils/logger');

const router = express.Router();

// Allow at most 20 Telegram auth requests per IP per 15 minutes to guard
// against brute-force and enumeration attacks.
const telegramAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * POST /auth/telegram
 *
 * Registers a new Telegram user or updates an existing one, then returns a
 * signed JWT token.
 *
 * Body: { telegramId, firstName, username?, lastName?, language? }
 * Response: { token: string, user: object }
 */
router.post('/telegram', telegramAuthLimiter, async (req, res) => {
  try {
    const { telegramId, firstName, username, lastName, language } = req.body;

    if (!telegramId || !firstName) {
      return res
        .status(400)
        .json({ error: 'telegramId and firstName are required' });
    }

    const updateFields = { firstName };
    if (username  !== undefined) updateFields.username  = username;
    if (lastName  !== undefined) updateFields.lastName  = lastName;
    if (language  !== undefined) updateFields.language  = language;

    const user = await User.findOneAndUpdate(
      { telegramId: String(telegramId) },
      { $set: updateFields },
      { upsert: true, new: true, runValidators: true }
    );

    const token = signToken(user._id);
    return res.status(200).json({ token, user });
  } catch (err) {
    logger.error('POST /auth/telegram error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

'use strict';

const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Express middleware that verifies the Bearer JWT token in the Authorization
 * header and attaches the authenticated User document to `req.user`.
 *
 * Returns 401 if the token is missing, invalid, expired, or belongs to an
 * inactive / deleted user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: missing token' });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized: user not found or inactive' });
    }

    req.user = user;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
};

module.exports = authenticate;

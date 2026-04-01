'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

/**
 * Signs a JWT token with the given user ID as the subject.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {string} signed JWT
 */
const signToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * Verifies a JWT token and returns the decoded payload.
 * Throws if the token is invalid or expired.
 * @param {string} token
 * @returns {{ sub: string, iat: number, exp: number }}
 */
const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

module.exports = { signToken, verifyToken };

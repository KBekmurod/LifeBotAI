'use strict';

const dotenv = require('dotenv');
dotenv.config();

const DEFAULT_JWT_SECRET = 'changeme_jwt_secret_for_dev';

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/lifebotai',
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  // Telegram Bot (Step 1.4)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  // AI provider (Step 1.4) — leave blank to use built-in mock AI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
};

// Guard: refuse to start with the default (insecure) secret outside development
if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test' &&
    env.JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set to a strong random value in non-development environments.'
  );
}

module.exports = env;

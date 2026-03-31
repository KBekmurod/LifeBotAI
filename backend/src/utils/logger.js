'use strict';

const levels = ['error', 'warn', 'info', 'debug'];

const logger = {
  error: (...args) => console.error(`[ERROR] ${new Date().toISOString()}`, ...args),
  warn:  (...args) => console.warn(`[WARN]  ${new Date().toISOString()}`, ...args),
  info:  (...args) => console.info(`[INFO]  ${new Date().toISOString()}`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${new Date().toISOString()}`, ...args);
    }
  },
};

module.exports = logger;

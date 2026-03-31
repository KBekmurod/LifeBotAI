'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { MONGODB_URI } = require('./env');

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected!');
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = connectDB;

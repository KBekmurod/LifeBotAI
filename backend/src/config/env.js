'use strict';

const dotenv = require('dotenv');
dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/lifebotai',
};

module.exports = env;

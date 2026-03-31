'use strict';

const mongoose = require('mongoose');

const SUBSCRIPTION_PLANS = ['free', 'memory', 'legacy', 'eternal'];

// Storage limits in bytes per plan
const STORAGE_LIMITS = {
  free:    100 * 1024 * 1024,        // 100 MB
  memory:    5 * 1024 * 1024 * 1024, //   5 GB
  legacy:   50 * 1024 * 1024 * 1024, //  50 GB
  eternal: Infinity,
};

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      default: null,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    language: {
      type: String,
      trim: true,
      default: 'en',
    },
    subscription: {
      plan: {
        type: String,
        enum: SUBSCRIPTION_PLANS,
        default: 'free',
      },
      stripeCustomerId: {
        type: String,
        default: null,
      },
      stripeSubscriptionId: {
        type: String,
        default: null,
      },
      currentPeriodEnd: {
        type: Date,
        default: null,
      },
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Virtual: storage limit based on current plan
userSchema.virtual('storageLimit').get(function () {
  return STORAGE_LIMITS[this.subscription.plan] ?? STORAGE_LIMITS.free;
});

// Instance method: check if user has exceeded their storage quota
userSchema.methods.hasStorageSpace = function (bytesToAdd = 0) {
  const limit = STORAGE_LIMITS[this.subscription.plan] ?? STORAGE_LIMITS.free;
  if (limit === Infinity) return true;
  return this.storageUsed + bytesToAdd <= limit;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

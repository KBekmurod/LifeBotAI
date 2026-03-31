'use strict';

const mongoose = require('mongoose');

const SUBSCRIPTION_PLANS   = ['free', 'memory', 'legacy', 'eternal'];
const SUBSCRIPTION_STATUSES = ['active', 'inactive', 'canceled', 'past_due', 'trialing'];

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: SUBSCRIPTION_PLANS,
      required: true,
      default: 'free',
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      required: true,
      default: 'active',
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    // Auto-cancel at period end when set to true (Stripe cancel_at_period_end)
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index: list a user's subscription history ordered by creation date
subscriptionSchema.index({ userId: 1, createdAt: -1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;

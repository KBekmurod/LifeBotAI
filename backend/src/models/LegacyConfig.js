'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const heirSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // What the heir is allowed to do after activation
    permissions: {
      viewMemories: { type: Boolean, default: true },
      aiChat:       { type: Boolean, default: false },
      downloadMedia:{ type: Boolean, default: false },
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const futureLetterSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    content: { type: String, required: true },
    // Condition types: 'date' | 'age' | 'event'
    conditionType: {
      type: String,
      enum: ['date', 'age', 'event'],
      required: true,
    },
    // ISO date string (conditionType === 'date')
    releaseDate: { type: Date, default: null },
    // Heir's age when the letter unlocks (conditionType === 'age')
    releaseAge: { type: Number, default: null, min: 0 },
    // Free-text event description (conditionType === 'event')
    releaseEvent: { type: String, default: null },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
  },
  { _id: true }
);

const deathSignalSchema = new mongoose.Schema(
  {
    // 'inactive' → 'pending' → 'confirmed' → 'activated'
    status: {
      type: String,
      enum: ['inactive', 'pending', 'confirmed', 'activated'],
      default: 'inactive',
    },
    // Telegram IDs of heirs who have confirmed
    confirmations: {
      type: [String],
      default: [],
    },
    // Minimum number of confirmations required before activation
    requiredConfirmations: {
      type: Number,
      default: 2,
      min: 1,
    },
    triggeredAt:  { type: Date, default: null },
    confirmedAt:  { type: Date, default: null },
    activatedAt:  { type: Date, default: null },
  },
  { _id: false }
);

// ─── Main schema ─────────────────────────────────────────────────────────────

const legacyConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    heirs: {
      type: [heirSchema],
      default: [],
    },
    futureLetters: {
      type: [futureLetterSchema],
      default: [],
    },
    deathSignal: {
      type: deathSignalSchema,
      default: () => ({}),
    },
    voiceClone: {
      status: {
        type: String,
        enum: ['none', 'pending', 'training', 'ready', 'failed'],
        default: 'none',
      },
      // Fish.audio voice model ID
      modelId: { type: String, default: null },
      trainedAt: { type: Date, default: null },
    },
    aiPersonality: {
      status: {
        type: String,
        enum: ['none', 'building', 'ready'],
        default: 'none',
      },
      builtAt: { type: Date, default: null },
      // Summary generated from 50+ memories used to represent personality
      summary: { type: String, default: null },
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const LegacyConfig = mongoose.model('LegacyConfig', legacyConfigSchema);

module.exports = LegacyConfig;

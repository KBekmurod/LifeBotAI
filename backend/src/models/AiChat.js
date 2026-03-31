'use strict';

const mongoose = require('mongoose');

// ─── Sub-schema: individual chat message ─────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    // 'user' = human / heir, 'assistant' = AI response
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    // IDs of Memory documents retrieved as context for this turn
    memoryRefs: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Memory',
      default: [],
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ─── Main schema ─────────────────────────────────────────────────────────────

const aiChatSchema = new mongoose.Schema(
  {
    // Owner of the life archive being queried
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // When true this session is a legacy (post-mortem) heir conversation
    isLegacyMode: {
      type: Boolean,
      default: false,
    },
    // Telegram ID of the heir initiating a legacy chat (null for owner sessions)
    heirTelegramId: {
      type: String,
      default: null,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    // Total token usage for cost tracking (approximate)
    totalTokens: {
      type: Number,
      default: 0,
      min: 0,
    },
    // 'open' while the session is active; 'closed' when ended
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index: retrieve a user's chats ordered by most recent
aiChatSchema.index({ userId: 1, createdAt: -1 });
// Compound index aligned with spec (deceased_user_id + heir_telegram_id):
// efficiently query legacy chats for a specific heir
aiChatSchema.index({ userId: 1, heirTelegramId: 1 });
// Index for legacy mode queries per user
aiChatSchema.index({ userId: 1, isLegacyMode: 1 });

const AiChat = mongoose.model('AiChat', aiChatSchema);

module.exports = AiChat;

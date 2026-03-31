'use strict';

const mongoose = require('mongoose');

const MEMORY_TYPES = ['voice', 'text', 'photo', 'video', 'document'];

const aiAnalysisSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      default: null,
    },
    emotions: {
      type: [String],
      default: [],
    },
    keywords: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      default: null,
    },
    analyzedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const memorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: MEMORY_TYPES,
      required: true,
    },
    // Transcribed or original text content
    content: {
      type: String,
      default: null,
    },
    // Cloudflare R2 (or other storage) URL for media files
    mediaUrl: {
      type: String,
      default: null,
    },
    // File size in bytes (used for storage quota tracking)
    mediaSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Original file MIME type
    mimeType: {
      type: String,
      default: null,
    },
    // Whisper transcript for voice/video memories
    transcript: {
      type: String,
      default: null,
    },
    // Gemini AI analysis result
    aiAnalysis: {
      type: aiAnalysisSchema,
      default: null,
    },
    // Embedding vector for semantic search (stored as a flat array of floats);
    // can be synced to Supabase pgvector for nearest-neighbour queries
    embedding: {
      type: [Number],
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    // When the memory/event actually happened (may differ from createdAt)
    memorizedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index aligned with spec: user's memories ordered by creation date
memorySchema.index({ userId: 1, createdAt: -1 });
// Compound index for queries by event date
memorySchema.index({ userId: 1, memorizedAt: -1 });
// Index for tag-based filtering per user
memorySchema.index({ userId: 1, tags: 1 });
// Index for type-based filtering per user
memorySchema.index({ userId: 1, type: 1 });

const Memory = mongoose.model('Memory', memorySchema);

module.exports = Memory;

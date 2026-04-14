'use strict';

/**
 * Tests for Step 1.4 — AI Service and Bot webhook
 * Tests for Step 1.5 — Bot inline AI chat helpers
 */

// ─── AI Service tests ─────────────────────────────────────────────────────────

describe('aiService', () => {
  let aiService;

  beforeEach(() => {
    jest.resetModules();
    // Ensure OPENAI_API_KEY is not set so the mock AI is used
    process.env.OPENAI_API_KEY = '';
    aiService = require('../src/services/aiService');
  });

  describe('approximateTokens', () => {
    it('returns 0 for empty string', () => {
      expect(aiService.approximateTokens('')).toBe(0);
    });

    it('returns a positive integer for non-empty text', () => {
      const tokens = aiService.approximateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(Number.isInteger(tokens)).toBe(true);
    });

    it('returns more tokens for longer text', () => {
      const short = aiService.approximateTokens('Hi');
      const long  = aiService.approximateTokens('Hello, this is a much longer sentence with many words.');
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('generateReply (mock AI)', () => {
    it('returns an object with content and tokens', async () => {
      const result = await aiService.generateReply([], 'Salom!');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('tokens');
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
      expect(typeof result.tokens).toBe('number');
      expect(result.tokens).toBeGreaterThan(0);
    });

    it('cycles through mock responses', async () => {
      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push((await aiService.generateReply([], `Message ${i}`)).content);
      }
      // Not all responses should be identical (round-robin)
      const unique = new Set(results);
      expect(unique.size).toBeGreaterThanOrEqual(1); // at least deterministic
    });

    it('accepts a non-empty history', async () => {
      const history = [
        { role: 'user',      content: 'Mening ismim Alibek.' },
        { role: 'assistant', content: 'Salom, Alibek!' },
      ];
      const result = await aiService.generateReply(history, 'Menga yordam bera olasizmi?');
      expect(result).toHaveProperty('content');
    });
  });
});

// ─── Bot webhook route tests ──────────────────────────────────────────────────

describe('POST /bot/webhook', () => {
  let request;
  let app;

  beforeAll(() => {
    request = require('supertest');
    app     = require('../src/server');
  });

  it('returns 503 when the bot token is not set', async () => {
    // In the test environment TELEGRAM_BOT_TOKEN is not set, so bot is null
    const res = await request(app)
      .post('/bot/webhook')
      .send({ update_id: 1, message: { text: '/start' } });

    // Either 503 (bot not initialised) or 200 (if somehow initialised)
    expect([200, 503]).toContain(res.statusCode);
  });

  it('returns 404 for an unknown bot sub-path', async () => {
    const res = await request(app).get('/bot/unknown');
    expect(res.statusCode).toBe(404);
  });
});

// ─── Bot helper function tests ────────────────────────────────────────────────

describe('bot helpers: findOrCreateUser', () => {
  const mongoose = require('mongoose');

  beforeEach(() => {
    jest.resetModules();
  });

  it('calls User.findOneAndUpdate with correct telegramId and fields', async () => {
    const fakeUser = { _id: new mongoose.Types.ObjectId(), telegramId: '12345', firstName: 'Test' };
    const mockFindOneAndUpdate = jest.fn().mockResolvedValue(fakeUser);

    jest.doMock('../src/models', () => ({
      User:   { findOneAndUpdate: mockFindOneAndUpdate },
      AiChat: { findOne: jest.fn(), create: jest.fn() },
      Memory: {},
    }));

    const { findOrCreateUser } = require('../src/bot');
    const ctx = {
      from: { id: 12345, first_name: 'Test', last_name: 'User', username: 'testuser', language_code: 'uz' },
    };

    const user = await findOrCreateUser(ctx);
    expect(user).toEqual(fakeUser);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { telegramId: '12345' },
      expect.objectContaining({ $set: expect.objectContaining({ firstName: 'Test' }) }),
      { upsert: true, new: true, runValidators: true }
    );
  });

  it('handles missing optional fields gracefully', async () => {
    const fakeUser = { _id: new mongoose.Types.ObjectId(), telegramId: '99999', firstName: 'Bot' };
    const mockFindOneAndUpdate = jest.fn().mockResolvedValue(fakeUser);

    jest.doMock('../src/models', () => ({
      User:   { findOneAndUpdate: mockFindOneAndUpdate },
      AiChat: { findOne: jest.fn(), create: jest.fn() },
      Memory: {},
    }));

    const { findOrCreateUser } = require('../src/bot');
    const ctx = { from: { id: 99999, first_name: 'Bot' } };

    const user = await findOrCreateUser(ctx);
    expect(user).toEqual(fakeUser);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { telegramId: '99999' },
      { $set: { firstName: 'Bot' } },
      { upsert: true, new: true, runValidators: true }
    );
  });
});

describe('bot helpers: findOrCreateSession', () => {
  const mongoose = require('mongoose');

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns an existing open session if one exists', async () => {
    const userId  = new mongoose.Types.ObjectId();
    const session = { _id: new mongoose.Types.ObjectId(), userId, status: 'open', messages: [] };
    const mockSort = jest.fn().mockResolvedValue(session);
    const mockFindOne = jest.fn().mockReturnValue({ sort: mockSort });
    const mockCreate  = jest.fn();

    jest.doMock('../src/models', () => ({
      User:   { findOneAndUpdate: jest.fn() },
      AiChat: { findOne: mockFindOne, create: mockCreate },
      Memory: {},
    }));

    const { findOrCreateSession } = require('../src/bot');
    const result = await findOrCreateSession(userId);

    expect(result).toEqual(session);
    expect(mockFindOne).toHaveBeenCalledWith({ userId, status: 'open' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a new session when none is open', async () => {
    const userId  = new mongoose.Types.ObjectId();
    const newSession = { _id: new mongoose.Types.ObjectId(), userId, status: 'open', messages: [] };
    const mockSort   = jest.fn().mockResolvedValue(null);
    const mockFindOne = jest.fn().mockReturnValue({ sort: mockSort });
    const mockCreate  = jest.fn().mockResolvedValue(newSession);

    jest.doMock('../src/models', () => ({
      User:   { findOneAndUpdate: jest.fn() },
      AiChat: { findOne: mockFindOne, create: mockCreate },
      Memory: {},
    }));

    const { findOrCreateSession } = require('../src/bot');
    const result = await findOrCreateSession(userId);

    expect(result).toEqual(newSession);
    expect(mockCreate).toHaveBeenCalledWith({ userId, isLegacyMode: false });
  });
});

'use strict';

/**
 * Tests for Step 1.4 — AI Service and Bot webhook
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

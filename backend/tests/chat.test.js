'use strict';

/**
 * Tests for Step 1.4 — Chat API routes (/chat/sessions/*)
 *
 * All Mongoose model calls are mocked so no live database is required.
 * The AI service is also mocked to return deterministic responses.
 */

// ─── Mocks (must come before any module that imports them) ────────────────────

jest.mock('../src/models', () => ({
  User:   { findById: jest.fn() },
  AiChat: {
    create:         jest.fn(),
    find:           jest.fn(),
    findOne:        jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('../src/services/aiService', () => ({
  generateReply:    jest.fn(),
  approximateTokens: jest.fn((text) => Math.ceil((text || '').length / 4)),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/server');
const { User, AiChat }  = require('../src/models');
const { generateReply } = require('../src/services/aiService');
const { signToken }     = require('../src/utils/jwt');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const userId    = new mongoose.Types.ObjectId();
const sessionId = new mongoose.Types.ObjectId();
const fakeUser  = { _id: userId, telegramId: '111', firstName: 'Test', isActive: true };

const authHeader = () => `Bearer ${signToken(userId)}`;

/** Build a minimal AiChat-like object */
const makeSession = (overrides = {}) => ({
  _id:            sessionId,
  userId,
  isLegacyMode:   false,
  heirTelegramId: null,
  messages:       [],
  totalTokens:    0,
  status:         'open',
  createdAt:      new Date(),
  save:           jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ─── Suite setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authenticated user found
  User.findById.mockResolvedValue(fakeUser);
});

// ─── POST /chat/sessions ──────────────────────────────────────────────────────

describe('POST /chat/sessions', () => {
  it('creates a session and returns 201', async () => {
    const session = makeSession();
    AiChat.create.mockResolvedValue(session);

    const res = await request(app)
      .post('/chat/sessions')
      .set('Authorization', authHeader())
      .send({});

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('session');
    expect(AiChat.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId, isLegacyMode: false })
    );
  });

  it('creates a legacy session when isLegacyMode is true', async () => {
    const session = makeSession({ isLegacyMode: true, heirTelegramId: '999' });
    AiChat.create.mockResolvedValue(session);

    const res = await request(app)
      .post('/chat/sessions')
      .set('Authorization', authHeader())
      .send({ isLegacyMode: true, heirTelegramId: '999' });

    expect(res.statusCode).toBe(201);
    expect(AiChat.create).toHaveBeenCalledWith(
      expect.objectContaining({ isLegacyMode: true, heirTelegramId: '999' })
    );
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/chat/sessions').send({});
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 when create throws', async () => {
    AiChat.create.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/chat/sessions')
      .set('Authorization', authHeader())
      .send({});
    expect(res.statusCode).toBe(500);
  });
});

// ─── GET /chat/sessions ───────────────────────────────────────────────────────

describe('GET /chat/sessions', () => {
  it('returns a list of sessions and total', async () => {
    const sessions = [makeSession(), makeSession()];
    AiChat.find.mockReturnValue({
      sort:  jest.fn().mockReturnThis(),
      skip:  jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(sessions),
    });
    AiChat.countDocuments.mockResolvedValue(2);

    const res = await request(app)
      .get('/chat/sessions')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(res.body).toHaveProperty('total', 2);
  });

  it('accepts a status filter', async () => {
    AiChat.find.mockReturnValue({
      sort:  jest.fn().mockReturnThis(),
      skip:  jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });
    AiChat.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .get('/chat/sessions?status=open')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(AiChat.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' }),
      expect.anything()
    );
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/chat/sessions');
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /chat/sessions/:id ───────────────────────────────────────────────────

describe('GET /chat/sessions/:id', () => {
  it('returns the session when found', async () => {
    const session = makeSession();
    AiChat.findOne.mockResolvedValue(session);

    const res = await request(app)
      .get(`/chat/sessions/${sessionId}`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('session');
  });

  it('returns 404 when session does not exist', async () => {
    AiChat.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get(`/chat/sessions/${sessionId}`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for an invalid ObjectId', async () => {
    const res = await request(app)
      .get('/chat/sessions/not-an-id')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });
});

// ─── POST /chat/sessions/:id/messages ────────────────────────────────────────

describe('POST /chat/sessions/:id/messages', () => {
  it('returns userMessage and assistantMessage on success', async () => {
    const session = makeSession();
    AiChat.findOne.mockResolvedValue(session);
    generateReply.mockResolvedValue({ content: 'Ajoyib!', tokens: 10 });

    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .set('Authorization', authHeader())
      .send({ content: 'Salom!' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('userMessage');
    expect(res.body).toHaveProperty('assistantMessage');
    expect(res.body.assistantMessage.content).toBe('Ajoyib!');
    expect(session.save).toHaveBeenCalled();
  });

  it('returns 400 when content is missing', async () => {
    AiChat.findOne.mockResolvedValue(makeSession());
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .set('Authorization', authHeader())
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/content/);
  });

  it('returns 400 when content is an empty string', async () => {
    AiChat.findOne.mockResolvedValue(makeSession());
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .set('Authorization', authHeader())
      .send({ content: '   ' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    AiChat.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .set('Authorization', authHeader())
      .send({ content: 'Hey' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 409 when session is closed', async () => {
    AiChat.findOne.mockResolvedValue(makeSession({ status: 'closed' }));
    const res = await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .set('Authorization', authHeader())
      .send({ content: 'Hey' });
    expect(res.statusCode).toBe(409);
  });

  it('returns 404 for an invalid ObjectId', async () => {
    const res = await request(app)
      .post('/chat/sessions/bad-id/messages')
      .set('Authorization', authHeader())
      .send({ content: 'Hey' });
    expect(res.statusCode).toBe(404);
  });

  it('accumulates totalTokens', async () => {
    const session = makeSession({ totalTokens: 50 });
    AiChat.findOne.mockResolvedValue(session);
    generateReply.mockResolvedValue({ content: 'Reply', tokens: 20 });

    await request(app)
      .post(`/chat/sessions/${sessionId}/messages`)
      .set('Authorization', authHeader())
      .send({ content: 'Hello' });

    expect(session.totalTokens).toBe(70);
  });
});

// ─── PATCH /chat/sessions/:id/close ──────────────────────────────────────────

describe('PATCH /chat/sessions/:id/close', () => {
  it('closes an open session and returns 200', async () => {
    const session = makeSession();
    AiChat.findOne.mockResolvedValue(session);

    const res = await request(app)
      .patch(`/chat/sessions/${sessionId}/close`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(session.status).toBe('closed');
    expect(session.closedAt).toBeInstanceOf(Date);
    expect(session.save).toHaveBeenCalled();
  });

  it('returns 409 when session is already closed', async () => {
    AiChat.findOne.mockResolvedValue(makeSession({ status: 'closed' }));

    const res = await request(app)
      .patch(`/chat/sessions/${sessionId}/close`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(409);
  });

  it('returns 404 when session not found', async () => {
    AiChat.findOne.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/chat/sessions/${sessionId}/close`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for an invalid ObjectId', async () => {
    const res = await request(app)
      .patch('/chat/sessions/bad/close')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });
});

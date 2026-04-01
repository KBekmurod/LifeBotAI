'use strict';

// ─── Mock the User model before any module that imports it is loaded ──────────
jest.mock('../src/models', () => ({
  User: {
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
  },
}));

const request    = require('supertest');
const mongoose   = require('mongoose');
const app        = require('../src/server');
const { User }   = require('../src/models');
const { signToken, verifyToken } = require('../src/utils/jwt');

// ─── JWT utility ──────────────────────────────────────────────────────────────

describe('JWT utilities', () => {
  const fakeId = new mongoose.Types.ObjectId().toString();

  it('signToken returns a non-empty string', () => {
    const token = signToken(fakeId);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('verifyToken decodes the correct sub claim', () => {
    const token   = signToken(fakeId);
    const payload = verifyToken(token);
    expect(payload.sub).toBe(fakeId);
  });

  it('verifyToken throws on a tampered token', () => {
    const token = signToken(fakeId);
    expect(() => verifyToken(token + 'x')).toThrow();
  });

  it('verifyToken throws on a completely invalid string', () => {
    expect(() => verifyToken('not.a.jwt')).toThrow();
  });
});

// ─── POST /auth/telegram ──────────────────────────────────────────────────────

describe('POST /auth/telegram', () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const fakeUser   = {
    _id:       fakeUserId,
    telegramId: '123456789',
    firstName:  'Alibek',
    username:   null,
    isActive:   true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with token and user on success', async () => {
    User.findOneAndUpdate.mockResolvedValue(fakeUser);

    const res = await request(app)
      .post('/auth/telegram')
      .send({ telegramId: '123456789', firstName: 'Alibek' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(typeof res.body.token).toBe('string');
  });

  it('returns 400 when telegramId is missing', async () => {
    const res = await request(app)
      .post('/auth/telegram')
      .send({ firstName: 'Alibek' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/telegramId/);
  });

  it('returns 400 when firstName is missing', async () => {
    const res = await request(app)
      .post('/auth/telegram')
      .send({ telegramId: '123456789' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/firstName/);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/auth/telegram')
      .send({});

    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when database throws', async () => {
    User.findOneAndUpdate.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/auth/telegram')
      .send({ telegramId: '999', firstName: 'Err' });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/internal server error/i);
  });

  it('token returned by /auth/telegram is verifiable', async () => {
    User.findOneAndUpdate.mockResolvedValue(fakeUser);

    const res = await request(app)
      .post('/auth/telegram')
      .send({ telegramId: '123456789', firstName: 'Alibek' });

    const payload = verifyToken(res.body.token);
    expect(payload.sub).toBe(fakeUserId.toString());
  });

  it('accepts optional fields (username, lastName, language)', async () => {
    User.findOneAndUpdate.mockResolvedValue({ ...fakeUser, username: 'alibekdev' });

    const res = await request(app)
      .post('/auth/telegram')
      .send({
        telegramId: '123456789',
        firstName:  'Alibek',
        username:   'alibekdev',
        lastName:   'Yusupov',
        language:   'uz',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe('alibekdev');
  });
});

// ─── authenticate middleware (via a dedicated test Express app) ───────────────

describe('authenticate middleware', () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const fakeUser   = { _id: fakeUserId, isActive: true };

  // Build a minimal Express app that only hosts the protected route so that
  // the 404 catch-all in server.js does not shadow the middleware under test.
  const express      = require('express');
  const authenticate = require('../src/middleware/auth');
  const testApp      = express();
  testApp.use(express.json());
  testApp.get('/test-protected', authenticate, (_req, res) =>
    res.status(200).json({ ok: true })
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when Authorization header is absent', async () => {
    const res = await request(testApp).get('/test-protected');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when Authorization header has wrong format', async () => {
    const res = await request(testApp)
      .get('/test-protected')
      .set('Authorization', 'Basic abc123');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(testApp)
      .get('/test-protected')
      .set('Authorization', 'Bearer not.a.valid.jwt');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when user is not found in DB', async () => {
    User.findById.mockResolvedValue(null);
    const token = signToken(fakeUserId);

    const res = await request(testApp)
      .get('/test-protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when user is inactive', async () => {
    User.findById.mockResolvedValue({ ...fakeUser, isActive: false });
    const token = signToken(fakeUserId);

    const res = await request(testApp)
      .get('/test-protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });

  it('calls next() and returns 200 for a valid token and active user', async () => {
    User.findById.mockResolvedValue(fakeUser);
    const token = signToken(fakeUserId);

    const res = await request(testApp)
      .get('/test-protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  const fakeUserId = new mongoose.Types.ObjectId();
  const fakeUser   = { _id: fakeUserId, telegramId: '111', firstName: 'Test', isActive: true };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer bad.token.here');
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with user for a valid token and active user', async () => {
    User.findById.mockResolvedValue(fakeUser);
    const token = signToken(fakeUserId);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.telegramId).toBe('111');
  });

  it('returns 401 when user is inactive', async () => {
    User.findById.mockResolvedValue({ ...fakeUser, isActive: false });
    const token = signToken(fakeUserId);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });
});

'use strict';

/**
 * Tests for Step 1.5 — Memory API routes (/memories/*)
 *
 * All Mongoose model calls are mocked so no live database is required.
 */

// ─── Mocks (must come before any module that imports them) ────────────────────

jest.mock('../src/models', () => ({
  User:   { findById: jest.fn() },
  AiChat: {
    create:         jest.fn(),
    find:           jest.fn(),
    findOne:        jest.fn(),
    countDocuments: jest.fn(),
    updateMany:     jest.fn(),
  },
  Memory: {
    create:         jest.fn(),
    find:           jest.fn(),
    findOne:        jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/server');
const { User, Memory } = require('../src/models');
const { signToken }    = require('../src/utils/jwt');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const userId   = new mongoose.Types.ObjectId();
const memoryId = new mongoose.Types.ObjectId();
const fakeUser = { _id: userId, telegramId: '111', firstName: 'Test', isActive: true };

const authHeader = () => `Bearer ${signToken(userId)}`;

const makeMemory = (overrides = {}) => ({
  _id:         memoryId,
  userId,
  type:        'text',
  content:     'Bu mening birinchi xotiram.',
  tags:        [],
  isArchived:  false,
  memorizedAt: new Date(),
  createdAt:   new Date(),
  ...overrides,
});

// ─── Suite setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue(fakeUser);
});

// ─── POST /memories ───────────────────────────────────────────────────────────

describe('POST /memories', () => {
  it('creates a text memory and returns 201', async () => {
    const memory = makeMemory();
    Memory.create.mockResolvedValue(memory);

    const res = await request(app)
      .post('/memories')
      .set('Authorization', authHeader())
      .send({ type: 'text', content: 'Bu mening birinchi xotiram.' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('memory');
    expect(Memory.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId, type: 'text', content: 'Bu mening birinchi xotiram.' })
    );
  });

  it('creates a memory with tags', async () => {
    const memory = makeMemory({ tags: ['bolalilik', 'oila'] });
    Memory.create.mockResolvedValue(memory);

    const res = await request(app)
      .post('/memories')
      .set('Authorization', authHeader())
      .send({ type: 'text', content: 'Bolaligimdagi xotira.', tags: ['bolalilik', 'oila'] });

    expect(res.statusCode).toBe(201);
    expect(Memory.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['bolalilik', 'oila'] })
    );
  });

  it('creates a memory with a custom memorizedAt date', async () => {
    const pastDate = '2020-01-15T10:00:00.000Z';
    const memory = makeMemory({ memorizedAt: new Date(pastDate) });
    Memory.create.mockResolvedValue(memory);

    const res = await request(app)
      .post('/memories')
      .set('Authorization', authHeader())
      .send({ type: 'text', content: 'Eski xotira.', memorizedAt: pastDate });

    expect(res.statusCode).toBe(201);
    expect(Memory.create).toHaveBeenCalledWith(
      expect.objectContaining({ memorizedAt: new Date(pastDate) })
    );
  });

  it('allows non-text types without content', async () => {
    const memory = makeMemory({ type: 'photo', content: null });
    Memory.create.mockResolvedValue(memory);

    const res = await request(app)
      .post('/memories')
      .set('Authorization', authHeader())
      .send({ type: 'photo' });

    expect(res.statusCode).toBe(201);
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .post('/memories')
      .set('Authorization', authHeader())
      .send({ content: 'No type provided.' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for an invalid type', async () => {
    const res = await request(app)
      .post('/memories')
      .set('Authorization', authHeader())
      .send({ type: 'invalid_type', content: 'test' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when text memory has no content', async () => {
    const res = await request(app)
      .post('/memories')
      .set('Authorization', authHeader())
      .send({ type: 'text' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/memories')
      .send({ type: 'text', content: 'test' });

    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /memories ────────────────────────────────────────────────────────────

describe('GET /memories', () => {
  it('returns a list of memories and total', async () => {
    const memories = [makeMemory(), makeMemory({ _id: new mongoose.Types.ObjectId() })];
    const sortMock = { skip: jest.fn().mockReturnThis() };
    sortMock.skip.mockReturnValue({ limit: jest.fn().mockResolvedValue(memories) });
    Memory.find.mockReturnValue({ sort: jest.fn().mockReturnValue(sortMock) });
    Memory.countDocuments.mockResolvedValue(2);

    const res = await request(app)
      .get('/memories')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('memories');
    expect(res.body).toHaveProperty('total', 2);
  });

  it('filters by type', async () => {
    const memories = [makeMemory({ type: 'photo' })];
    const sortMock = { skip: jest.fn().mockReturnThis() };
    sortMock.skip.mockReturnValue({ limit: jest.fn().mockResolvedValue(memories) });
    Memory.find.mockReturnValue({ sort: jest.fn().mockReturnValue(sortMock) });
    Memory.countDocuments.mockResolvedValue(1);

    const res = await request(app)
      .get('/memories?type=photo')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(Memory.find).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo' }),
      expect.anything()
    );
  });

  it('ignores invalid type filters', async () => {
    const sortMock = { skip: jest.fn().mockReturnThis() };
    sortMock.skip.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
    Memory.find.mockReturnValue({ sort: jest.fn().mockReturnValue(sortMock) });
    Memory.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .get('/memories?type=bad_type')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(Memory.find).toHaveBeenCalledWith(
      expect.not.objectContaining({ type: 'bad_type' }),
      expect.anything()
    );
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/memories');
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /memories/:id ────────────────────────────────────────────────────────

describe('GET /memories/:id', () => {
  it('returns a memory for a valid id', async () => {
    const memory = makeMemory();
    Memory.findOne.mockResolvedValue(memory);

    const res = await request(app)
      .get(`/memories/${memoryId}`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('memory');
  });

  it('returns 404 for a non-existent memory', async () => {
    Memory.findOne.mockResolvedValue(null);

    const res = await request(app)
      .get(`/memories/${memoryId}`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for an invalid ObjectId', async () => {
    const res = await request(app)
      .get('/memories/not-valid-id')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/memories/${memoryId}`);
    expect(res.statusCode).toBe(401);
  });
});

// ─── DELETE /memories/:id ─────────────────────────────────────────────────────

describe('DELETE /memories/:id', () => {
  it('soft-deletes a memory and returns ok', async () => {
    const memory = makeMemory({ isArchived: true });
    Memory.findOneAndUpdate.mockResolvedValue(memory);

    const res = await request(app)
      .delete(`/memories/${memoryId}`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(Memory.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: memoryId.toString(), userId }),
      { $set: { isArchived: true } },
      { new: true }
    );
  });

  it('is idempotent — returns ok even if already archived', async () => {
    // Already-archived memory is still returned from the DB (filter has no isArchived check)
    const memory = makeMemory({ isArchived: true });
    Memory.findOneAndUpdate.mockResolvedValue(memory);

    const res = await request(app)
      .delete(`/memories/${memoryId}`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
  });

  it('returns 404 for a non-existent memory', async () => {
    Memory.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/memories/${memoryId}`)
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for an invalid ObjectId', async () => {
    const res = await request(app)
      .delete('/memories/bad-id')
      .set('Authorization', authHeader());

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`/memories/${memoryId}`);
    expect(res.statusCode).toBe(401);
  });
});

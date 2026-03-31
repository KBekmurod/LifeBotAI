'use strict';

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Memory = require('../src/models/Memory');
const LegacyConfig = require('../src/models/LegacyConfig');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a model instance and run Mongoose schema validation (no DB needed). */
const validate = (Model, data) => new Model(data).validate();

/** Build a model instance and assert validation passes (no DB needed). */
const assertValid = (Model, data) => expect(validate(Model, data)).resolves.toBeUndefined();

/** Build a model instance and assert validation fails (no DB needed). */
const assertInvalid = (Model, data) => expect(validate(Model, data)).rejects.toThrow();

// ─── User ─────────────────────────────────────────────────────────────────────

describe('User model', () => {
  it('is valid with required fields', () =>
    assertValid(User, { telegramId: '123456', firstName: 'Alibek' }));

  it('applies default values correctly', () => {
    const user = new User({ telegramId: '123456', firstName: 'Alibek' });
    expect(user.subscription.plan).toBe('free');
    expect(user.storageUsed).toBe(0);
    expect(user.isActive).toBe(true);
    expect(user.language).toBe('en');
  });

  it('is invalid without telegramId', () =>
    assertInvalid(User, { firstName: 'Noname' }));

  it('is invalid without firstName', () =>
    assertInvalid(User, { telegramId: '999' }));

  it('rejects an unknown subscription plan', () =>
    assertInvalid(User, {
      telegramId: '1',
      firstName: 'A',
      subscription: { plan: 'premium' },
    }));

  it('accepts all valid subscription plans', async () => {
    for (const plan of ['free', 'memory', 'legacy', 'eternal']) {
      await assertValid(User, {
        telegramId: '1',
        firstName: 'A',
        subscription: { plan },
      });
    }
  });

  it('hasStorageSpace returns true when under free-plan limit', () => {
    const user = new User({ telegramId: '1', firstName: 'T', storageUsed: 0 });
    expect(user.hasStorageSpace(1024)).toBe(true);
  });

  it('hasStorageSpace returns false when over free-plan limit', () => {
    const limit = 100 * 1024 * 1024; // 100 MB
    const user = new User({ telegramId: '1', firstName: 'T', storageUsed: limit });
    expect(user.hasStorageSpace(1)).toBe(false);
  });

  it('hasStorageSpace always returns true for eternal plan', () => {
    const user = new User({
      telegramId: '1',
      firstName: 'E',
      storageUsed: Number.MAX_SAFE_INTEGER,
      subscription: { plan: 'eternal' },
    });
    expect(user.hasStorageSpace(9_999_999)).toBe(true);
  });
});

// ─── Memory ───────────────────────────────────────────────────────────────────

describe('Memory model', () => {
  const fakeUserId = new mongoose.Types.ObjectId();

  it('is valid for a text memory', () =>
    assertValid(Memory, { userId: fakeUserId, type: 'text', content: 'Great day.' }));

  it('is valid for a voice memory', () =>
    assertValid(Memory, {
      userId: fakeUserId,
      type: 'voice',
      mediaUrl: 'https://r2.example.com/audio/test.ogg',
      mediaSize: 204800,
      mimeType: 'audio/ogg',
      transcript: 'Hello from the past.',
    }));

  it('is valid for all memory types', async () => {
    for (const type of ['voice', 'text', 'photo', 'video', 'document']) {
      await assertValid(Memory, { userId: fakeUserId, type });
    }
  });

  it('is invalid without userId', () =>
    assertInvalid(Memory, { type: 'text', content: 'hi' }));

  it('is invalid without type', () =>
    assertInvalid(Memory, { userId: fakeUserId }));

  it('is invalid with an unknown type', () =>
    assertInvalid(Memory, { userId: fakeUserId, type: 'unknown' }));

  it('applies default values correctly', () => {
    const mem = new Memory({ userId: fakeUserId, type: 'text' });
    expect(mem.isArchived).toBe(false);
    expect(mem.tags).toEqual([]);
    expect(mem.mediaSize).toBe(0);
  });

  it('stores aiAnalysis sub-document correctly', () => {
    const mem = new Memory({
      userId: fakeUserId,
      type: 'text',
      content: 'Feeling happy.',
      aiAnalysis: {
        summary: 'Positive mood',
        emotions: ['happy', 'calm'],
        keywords: ['happy', 'today'],
        language: 'en',
        analyzedAt: new Date(),
      },
    });
    expect(mem.aiAnalysis.summary).toBe('Positive mood');
    expect(mem.aiAnalysis.emotions).toContain('happy');
  });
});

// ─── LegacyConfig ─────────────────────────────────────────────────────────────

describe('LegacyConfig model', () => {
  const fakeUserId = new mongoose.Types.ObjectId();

  it('is valid with only userId', () =>
    assertValid(LegacyConfig, { userId: fakeUserId }));

  it('is invalid without userId', () =>
    assertInvalid(LegacyConfig, {}));

  it('applies default values correctly', () => {
    const cfg = new LegacyConfig({ userId: fakeUserId });
    expect(cfg.isEnabled).toBe(false);
    expect(cfg.heirs).toHaveLength(0);
    expect(cfg.futureLetters).toHaveLength(0);
    expect(cfg.deathSignal.status).toBe('inactive');
    expect(cfg.deathSignal.requiredConfirmations).toBe(2);
    expect(cfg.voiceClone.status).toBe('none');
    expect(cfg.aiPersonality.status).toBe('none');
  });

  it('is valid with a complete heir', () =>
    assertValid(LegacyConfig, {
      userId: fakeUserId,
      heirs: [{
        telegramId: 'heir-1',
        name: 'Dilnoza',
        permissions: { viewMemories: true, aiChat: true, downloadMedia: false },
      }],
    }));

  it('is invalid if heir is missing required name', () =>
    assertInvalid(LegacyConfig, {
      userId: fakeUserId,
      heirs: [{ telegramId: 'heir-1' }],
    }));

  it('is valid for a future letter with conditionType date', () =>
    assertValid(LegacyConfig, {
      userId: fakeUserId,
      futureLetters: [{
        title: 'To my children',
        content: 'I love you all.',
        conditionType: 'date',
        releaseDate: new Date('2040-01-01'),
      }],
    }));

  it('is valid for a future letter with conditionType age', () =>
    assertValid(LegacyConfig, {
      userId: fakeUserId,
      futureLetters: [{
        title: 'At 18',
        content: 'Read this at 18.',
        conditionType: 'age',
        releaseAge: 18,
      }],
    }));

  it('is invalid for a future letter with unknown conditionType', () =>
    assertInvalid(LegacyConfig, {
      userId: fakeUserId,
      futureLetters: [{ title: 'X', content: 'Y', conditionType: 'unknown' }],
    }));

  it('stores deathSignal status change in memory', () => {
    const cfg = new LegacyConfig({ userId: fakeUserId });
    cfg.deathSignal.status = 'pending';
    expect(cfg.deathSignal.status).toBe('pending');
  });

  it('rejects an invalid deathSignal status', () =>
    assertInvalid(LegacyConfig, {
      userId: fakeUserId,
      deathSignal: { status: 'zombie' },
    }));
});

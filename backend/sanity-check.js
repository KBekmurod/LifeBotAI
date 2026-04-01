'use strict';

/**
 * Sanity check — verifies that all Mongoose models load correctly and produce
 * valid document instances without a running MongoDB connection.
 *
 * Run: node sanity-check.js
 */

const mongoose = require('mongoose');

// Import the unified model registry
const { User, Memory, LegacyConfig, Subscription, AiChat } = require('./src/models');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

// ─── User ────────────────────────────────────────────────────────────────────
console.log('\nUser');
const user = new User({ telegramId: '100001', firstName: 'Alibek' });
assert(user.telegramId === '100001',                'telegramId stored');
assert(user.firstName === 'Alibek',                 'firstName stored');
assert(user.subscription.plan === 'free',           'default plan = free');
assert(user.storageUsed === 0,                      'default storageUsed = 0');
assert(user.isActive === true,                      'default isActive = true');
assert(user.language === 'en',                      'default language = en');
assert(user.hasStorageSpace(1024) === true,         'hasStorageSpace(1024) = true on free plan');
assert(user.storageLimit === 100 * 1024 * 1024,     'storageLimit virtual = 100 MB on free plan');

// ─── Memory ──────────────────────────────────────────────────────────────────
console.log('\nMemory');
const mem = new Memory({
  userId: new mongoose.Types.ObjectId(),
  type: 'voice',
  transcript: 'Hello from the past.',
  aiAnalysis: { summary: 'Positive', emotions: ['happy'] },
});
assert(mem.type === 'voice',                        'type stored');
assert(mem.isArchived === false,                    'default isArchived = false');
assert(Array.isArray(mem.tags),                     'tags is array');
assert(mem.aiAnalysis.summary === 'Positive',       'aiAnalysis.summary stored');
assert(mem.aiAnalysis.emotions[0] === 'happy',      'aiAnalysis.emotions stored');

// ─── LegacyConfig ────────────────────────────────────────────────────────────
console.log('\nLegacyConfig');
const cfg = new LegacyConfig({
  userId: new mongoose.Types.ObjectId(),
  heirs: [{ telegramId: 'heir-1', name: 'Dilnoza' }],
});
assert(cfg.isEnabled === false,                     'default isEnabled = false');
assert(cfg.deathSignal.status === 'inactive',       'default deathSignal.status = inactive');
assert(cfg.voiceClone.status === 'none',            'default voiceClone.status = none');
assert(cfg.aiPersonality.status === 'none',         'default aiPersonality.status = none');
assert(cfg.heirs[0].name === 'Dilnoza',             'heir name stored');
assert(cfg.heirs[0].permissions.viewMemories === true, 'heir default viewMemories = true');

// ─── Subscription ────────────────────────────────────────────────────────────
console.log('\nSubscription');
const sub = new Subscription({
  userId: new mongoose.Types.ObjectId(),
  plan: 'memory',
  status: 'active',
  stripeCustomerId: 'cus_test',
});
assert(sub.plan === 'memory',                       'plan stored');
assert(sub.status === 'active',                     'status stored');
assert(sub.cancelAtPeriodEnd === false,             'default cancelAtPeriodEnd = false');
assert(sub.stripeCustomerId === 'cus_test',         'stripeCustomerId stored');

// ─── AiChat ──────────────────────────────────────────────────────────────────
console.log('\nAiChat');
const chat = new AiChat({
  userId: new mongoose.Types.ObjectId(),
  isLegacyMode: true,
  heirTelegramId: 'heir_42',
  messages: [
    { role: 'user', content: 'Tell me about dad.' },
    { role: 'assistant', content: 'He loved mountains.' },
  ],
});
assert(chat.isLegacyMode === true,                  'isLegacyMode stored');
assert(chat.heirTelegramId === 'heir_42',           'heirTelegramId stored');
assert(chat.messages.length === 2,                  'messages count = 2');
assert(chat.messages[0].role === 'user',            'first message role = user');
assert(chat.status === 'open',                      'default status = open');
assert(chat.totalTokens === 0,                      'default totalTokens = 0');

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

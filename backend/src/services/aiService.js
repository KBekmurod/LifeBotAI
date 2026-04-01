'use strict';

/**
 * AI Service — Step 1.4
 *
 * Provides AI-powered responses for the LifeBotAI chat module.
 * The service exposes a single `generateReply` function that accepts the
 * conversation history and returns an assistant message.
 *
 * When OPENAI_API_KEY is set the service delegates to the OpenAI Chat
 * Completions API (gpt-4o-mini by default).  Otherwise it falls back to a
 * built-in rule-based mock that is deterministic and requires no network
 * access — ideal for tests and local development.
 */

const { OPENAI_API_KEY } = require('../config/env');
const logger = require('../utils/logger');

// ─── Token approximation ─────────────────────────────────────────────────────

/**
 * Very rough token estimator (≈ 4 chars per token).
 * @param {string} text
 * @returns {number}
 */
const approximateTokens = (text) => Math.ceil((text || '').length / 4);

// ─── Mock AI ─────────────────────────────────────────────────────────────────

const MOCK_RESPONSES = [
  "Bu ajoyib xotira! Menga ko'proq gapiring — qachon va qayerda bo'lgan?",
  "Sizning hayotingiz haqidagi bu voqea juda qimmatli. Davom eting, men eshitaman.",
  "Bu xotirani saqlab qoldim. Boshqa biror narsani ulashmoqchimisiz?",
  "Hayot arxivingizni boyitayotganimiz uchun minnatdorman. Bu sizning merosxo'rlaringiz uchun bebaho bo'ladi.",
  "Tushundim. Bu voqea sizga qanday his-tuyg'u berdi?",
  "Bu hikoya sizning shaxsiyatingizni yaxshi aks ettiradi. Davom eting.",
  "Ajoyib! Ushbu xotirani teglar bilan belgilashni xohlaysizmi?",
];

let _mockIndex = 0;

/**
 * Returns the next mock response in a round-robin fashion.
 * @returns {string}
 */
const mockReply = () => {
  const reply = MOCK_RESPONSES[_mockIndex % MOCK_RESPONSES.length];
  _mockIndex++;
  return reply;
};

// ─── OpenAI integration ───────────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL   = 'gpt-4o-mini';

const SYSTEM_PROMPT =
  'Siz LifeBotAI yordamchisisiz. Foydalanuvchining hayot arxivini yaratishda yordam berasiz. ' +
  'Foydalanuvchi bilan o\'zbek yoki ingliz tilida muloqot qiling (ular qaysi tilda yozsalar, shunda javob bering). ' +
  'Xotiralar, hayot voqealari va shaxsiy hikoyalar haqida savollar bering. ' +
  'Har doim mehribon, sabr-toqatli va qo\'llab-quvvatlovchi bo\'ling.';

/**
 * Calls the OpenAI Chat Completions endpoint.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<{content: string, tokens: number}>}
 */
const openAiReply = async (messages) => {
  const body = {
    model: OPENAI_MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 512,
    temperature: 0.7,
  };

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  const tokens  = data.usage?.total_tokens ?? approximateTokens(content);
  return { content, tokens };
};

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Generate an AI reply for the given conversation history.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 *   The full conversation history, **excluding** the latest user message.
 * @param {string} userMessage  The new message from the user.
 * @returns {Promise<{content: string, tokens: number}>}
 */
const generateReply = async (history, userMessage) => {
  const messages = [
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: userMessage },
  ];

  if (OPENAI_API_KEY) {
    try {
      return await openAiReply(messages);
    } catch (err) {
      logger.warn('OpenAI API call failed, falling back to mock AI:', err.message);
    }
  }

  // Built-in mock — always available
  const content = mockReply();
  const tokens  = approximateTokens(userMessage) + approximateTokens(content);
  return { content, tokens };
};

module.exports = { generateReply, approximateTokens };

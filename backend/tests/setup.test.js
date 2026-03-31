'use strict';

const request = require('supertest');
const app = require('../src/server');

describe('GET /health', () => {
  it('should return 200 OK with { ok: true }', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

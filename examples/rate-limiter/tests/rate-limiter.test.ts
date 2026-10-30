import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import { rateLimitConfig } from '../src/config/rate-limit';

describe('Rate Limiter Middleware', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.useFakeTimers();
    app = Fastify();

    // Use factory to create store internally (no need to pass store explicitly)
    const rateLimiterHook = createRateLimiter({ config: rateLimitConfig });
    app.addHook('onRequest', rateLimiterHook);

    app.get('/test', async () => ({ ok: true }));
    app.get('/health', async () => ({ status: 'ok' }));
    app.get('/healthz', async () => ({ status: 'ok' }));
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('should allow requests under limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(res.headers['x-ratelimit-remaining']).toBe('9');
  });

  it('should return 429 when limit exceeded', async () => {
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'GET', url: '/test' });
    }
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.json()).toEqual({ error: 'Too Many Requests', retryAfter: expect.any(Number) });
  });

  it('should include rate limit headers on all responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should skip configured paths', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('should isolate limits per IP', async () => {
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.1' } });
    }
    const res = await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.2' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-remaining']).toBe('9');
  });

  it('should handle concurrent requests correctly', async () => {
    const promises = Array(15).fill(null).map(() => 
      app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.3' } })
    );
    const results = await Promise.all(promises);
    const allowed = results.filter(r => r.statusCode === 200).length;
    expect(allowed).toBe(10);
  });

  it('should refill after window', async () => {
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.4' } });
    }
    vi.advanceTimersByTime(60_000);
    const res = await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.4' } });
    expect(res.statusCode).toBe(200);
  });

  it('should skip paths with query params (prefix match)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health?x=1' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('should NOT skip similar paths (prefix boundary)', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('10');
  });
});
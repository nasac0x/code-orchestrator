import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import { createMetricsCollector } from '../src/metrics';
import { rateLimitConfig } from '../src/config/rate-limit';

describe('Metrics Endpoint', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.useFakeTimers();
    app = Fastify();
    
    // Create shared metrics collector
    const metrics = createMetricsCollector(rateLimitConfig);
    
    // Create rate limiter with the SAME metrics instance
    const rateLimiterHook = createRateLimiter({ config: rateLimitConfig, metrics });
    app.addHook('onRequest', rateLimiterHook);
    
    // Add metrics endpoint using the same collector
    app.get('/api/metrics', async () => {
      return metrics.getSnapshot();
    });
    
    app.get('/test', async () => ({ ok: true }));
    app.get('/health', async () => ({ status: 'ok' }));
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('should return metrics snapshot with zeros initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.requests.total).toBe(0);
    expect(data.requests.allowed).toBe(0);
    expect(data.requests.blocked).toBe(0);
    expect(data.redis.connected).toBe(false); // memory backend
  });

  it('should track requests after hitting rate limited endpoint', async () => {
    await app.inject({ method: 'GET', url: '/test' });
    await app.inject({ method: 'GET', url: '/test' });
    
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    const data = res.json();
    expect(data.requests.total).toBe(2);
    expect(data.requests.allowed).toBe(2);
  });

  it('should track blocked requests', async () => {
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'GET', url: '/test' });
    }
    await app.inject({ method: 'GET', url: '/test' }); // 11th = blocked
    
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    const data = res.json();
    expect(data.requests.total).toBe(11);
    expect(data.requests.allowed).toBe(10);
    expect(data.requests.blocked).toBe(1);
    expect(data.requests.blockRate).toBeCloseTo(1/11, 2);
  });

  it('should include latency metrics', async () => {
    await app.inject({ method: 'GET', url: '/test' });
    
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    const data = res.json();
    expect(data.latency.avg).toBeGreaterThanOrEqual(0);
    expect(data.latency.p50).toBeGreaterThanOrEqual(0);
  });

  it('should track top IPs', async () => {
    await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.1' } });
    await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.1' } });
    await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.2' } });
    
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    const data = res.json();
    expect(data.topIPs.byRequests[0]).toEqual({ ip: '10.0.0.1', count: 2 });
  });
});
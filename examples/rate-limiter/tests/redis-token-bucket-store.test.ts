import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { RedisTokenBucketStore } from '../src/utils/redis-token-bucket-store';
import { rateLimitConfig } from '../src/config/rate-limit';

const REDIS_AVAILABLE = !!process.env.REDIS_URL;

(REDIS_AVAILABLE ? describe : describe.skip)('RedisTokenBucketStore (integration)', () => {
  let store: RedisTokenBucketStore;
  const testConfig = { ...rateLimitConfig, capacity: 10, refillRate: 10 / 60_000, redisKeyPrefix: 'test:ratelimit' };

  beforeAll(() => {
    if (!REDIS_AVAILABLE) console.log('Skipping Redis tests - REDIS_URL not set');
  });

  beforeEach(() => {
    store = new RedisTokenBucketStore(testConfig);
  });

  afterEach(async () => {
    await store.shutdown();
  });

  it('should allow first request', async () => {
    const result = await store.take('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should allow up to capacity requests', async () => {
    for (let i = 0; i < 10; i++) {
      const result = await store.take('192.168.1.2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9 - i);
    }
  });

  it('should reject 11th request with 429 info', async () => {
    for (let i = 0; i < 10; i++) {
      await store.take('192.168.1.3');
    }
    const result = await store.take('192.168.1.3');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.remaining).toBe(0);
  });

  it('should isolate buckets per IP', async () => {
    for (let i = 0; i < 10; i++) {
      await store.take('192.168.1.4');
    }
    const result = await store.take('192.168.1.5');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should handle concurrent requests for same IP without race condition', async () => {
    const promises = Array(15).fill(null).map(() => store.take('192.168.1.6'));
    const results = await Promise.all(promises);
    const allowed = results.filter(r => r.allowed).length;
    expect(allowed).toBe(10);
  });

  it('should return correct reset timestamp', async () => {
    const result = await store.take('192.168.1.7');
    expect(result.reset).toBeGreaterThan(Date.now());
    expect(result.reset).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it('healthCheck should return true when connected', async () => {
    expect(await store.healthCheck()).toBe(true);
  });
});
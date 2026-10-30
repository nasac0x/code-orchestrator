import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryTokenBucketStore } from '../src/utils/token-bucket-store';
import { rateLimitConfig } from '../src/config/rate-limit';

describe('MemoryTokenBucketStore', () => {
  let store: MemoryTokenBucketStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MemoryTokenBucketStore(rateLimitConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    store.shutdown();
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

  it('should refill tokens over time', async () => {
    for (let i = 0; i < 10; i++) {
      await store.take('192.168.1.4');
    }
    vi.advanceTimersByTime(60_000);
    const result = await store.take('192.168.1.4');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should isolate buckets per IP', async () => {
    for (let i = 0; i < 10; i++) {
      await store.take('192.168.1.5');
    }
    const result = await store.take('192.168.1.6');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should handle concurrent requests for same IP without race condition', async () => {
    const promises = Array(15).fill(null).map(() => store.take('192.168.1.7'));
    const results = await Promise.all(promises);
    const allowed = results.filter(r => r.allowed).length;
    expect(allowed).toBe(10);
  });

  it('should return correct reset timestamp', async () => {
    const result = await store.take('192.168.1.8');
    expect(result.reset).toBeGreaterThan(Date.now());
    expect(result.reset).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});
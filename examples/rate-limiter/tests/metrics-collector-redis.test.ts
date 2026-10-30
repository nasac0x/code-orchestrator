import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { RedisMetricsCollector } from '../src/metrics/collector-redis';
import { rateLimitConfig } from '../src/config/rate-limit';

const REDIS_AVAILABLE = !!process.env.REDIS_URL;

(REDIS_AVAILABLE ? describe : describe.skip)('RedisMetricsCollector (integration)', () => {
  let collector: RedisMetricsCollector;
  const testConfig = { 
    ...rateLimitConfig, 
    redisKeyPrefix: 'test:metrics',
    metricsEnabled: true,
    metricsTopIpsLimit: 10,
    metricsLatencySamples: 1000,
  };

  beforeAll(() => {
    if (!REDIS_AVAILABLE) console.log('Skipping Redis metrics tests - REDIS_URL not set');
  });

  beforeEach(() => {
    collector = new RedisMetricsCollector(testConfig);
  });

  afterEach(async () => {
    await collector.shutdown();
  });

  it('should return zero snapshot initially', async () => {
    const snap = await collector.getSnapshot();
    expect(snap.requests.total).toBe(0);
    expect(snap.redis.connected).toBe(true);
  });

  it('should record allowed request and persist to Redis', async () => {
    await collector.recordRequest('192.168.1.1', true, 5);
    const snap = await collector.getSnapshot();
    expect(snap.requests.total).toBe(1);
    expect(snap.requests.allowed).toBe(1);
    expect(snap.redis.keyPrefix).toBe('test:metrics');
  });

  it('should record blocked request', async () => {
    await collector.recordRequest('192.168.1.2', false, 3);
    const snap = await collector.getSnapshot();
    expect(snap.requests.blocked).toBe(1);
  });

  it('should track top IPs in Redis sorted sets', async () => {
    await collector.recordRequest('10.0.0.1', true, 1);
    await collector.recordRequest('10.0.0.1', true, 1);
    await collector.recordRequest('10.0.0.2', false, 1);
    const snap = await collector.getSnapshot();
    expect(snap.topIPs.byRequests[0]).toEqual({ ip: '10.0.0.1', count: 2 });
    expect(snap.topIPs.byBlocks[0]).toEqual({ ip: '10.0.0.2', count: 1 });
  });

  it('should calculate latency percentiles from Redis sorted set', async () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300];
    for (const l of latencies) {
      await collector.recordRequest('10.0.0.3', true, l);
    }
    const snap = await collector.getSnapshot();
    expect(snap.latency.p50).toBeGreaterThan(0);
    expect(snap.latency.p95).toBeGreaterThanOrEqual(snap.latency.p50);
  });
});
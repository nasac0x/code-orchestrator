import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryMetricsCollector } from '../src/metrics/collector-memory';

describe('MemoryMetricsCollector', () => {
  let collector: MemoryMetricsCollector;

  beforeEach(() => {
    collector = new MemoryMetricsCollector({ 
      keyPrefix: 'test', 
      topIpsLimit: 10,
      latencySamples: 1000 
    });
  });

  afterEach(async () => {
    await collector.shutdown();
  });

  it('should return zero snapshot initially', async () => {
    const snap = await collector.getSnapshot();
    expect(snap.requests.total).toBe(0);
    expect(snap.requests.allowed).toBe(0);
    expect(snap.requests.blocked).toBe(0);
    expect(snap.latency.avg).toBe(0);
  });

  it('should record allowed request and increment counters', async () => {
    await collector.recordRequest('192.168.1.1', true, 5);
    const snap = await collector.getSnapshot();
    expect(snap.requests.total).toBe(1);
    expect(snap.requests.allowed).toBe(1);
    expect(snap.requests.blocked).toBe(0);
    expect(snap.latency.avg).toBe(5);
  });

  it('should record blocked request and increment blocked counter', async () => {
    await collector.recordRequest('192.168.1.2', false, 3);
    const snap = await collector.getSnapshot();
    expect(snap.requests.total).toBe(1);
    expect(snap.requests.allowed).toBe(0);
    expect(snap.requests.blocked).toBe(1);
  });

  it('should track top IPs by requests and blocks', async () => {
    await collector.recordRequest('10.0.0.1', true, 1);
    await collector.recordRequest('10.0.0.1', true, 1);
    await collector.recordRequest('10.0.0.2', false, 1);
    const snap = await collector.getSnapshot();
    expect(snap.topIPs.byRequests[0]).toEqual({ ip: '10.0.0.1', count: 2 });
    expect(snap.topIPs.byBlocks[0]).toEqual({ ip: '10.0.0.2', count: 1 });
  });

  it('should calculate latency percentiles', async () => {
    // Use more samples to get distinct percentiles
    const latencies = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300];
    for (const l of latencies) {
      await collector.recordRequest('10.0.0.3', true, l);
    }
    const snap = await collector.getSnapshot();
    expect(snap.latency.p50).toBeGreaterThan(0);
    expect(snap.latency.p95).toBeGreaterThanOrEqual(snap.latency.p50);
    expect(snap.latency.p99).toBeGreaterThanOrEqual(snap.latency.p95);
  });

  it('should track active buckets', async () => {
    await collector.recordRequest('10.0.0.4', true, 1);
    const snap = await collector.getSnapshot();
    expect(snap.activeBuckets).toBe(1);
  });

  it('should return redis connected false for memory', async () => {
    const snap = await collector.getSnapshot();
    expect(snap.redis.connected).toBe(false);
  });
});
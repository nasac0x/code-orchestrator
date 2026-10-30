import { MetricsCollector } from './types.js';
import { MemoryMetricsCollector } from './collector-memory.js';
import { RedisMetricsCollector } from './collector-redis.js';
import { RateLimitConfig } from '../config/rate-limit.js';

export function createMetricsCollector(config: RateLimitConfig): MetricsCollector {
  if (config.metricsEnabled === false) {
    // Return no-op collector
    return {
      recordRequest: async () => {},
      getSnapshot: async () => ({
        timestamp: Date.now(),
        requests: { total: 0, allowed: 0, blocked: 0, blockRate: 0 },
        latency: { p50: 0, p95: 0, p99: 0, avg: 0 },
        topIPs: { byRequests: [], byBlocks: [] },
        activeBuckets: 0,
        redis: { connected: false, keyPrefix: 'disabled' },
      }),
      shutdown: async () => {},
    };
  }
  
  if (config.redisUrl) {
    return new RedisMetricsCollector(config);
  }
  return new MemoryMetricsCollector({
    keyPrefix: config.redisKeyPrefix || 'ratelimit',
    topIpsLimit: config.metricsTopIpsLimit || 10,
    latencySamples: config.metricsLatencySamples || 1000,
  });
}
import Redis from 'ioredis';
import { MetricsCollector, MetricsSnapshot } from './types.js';
import { RateLimitConfig } from '../config/rate-limit.js';

// Lua script for atomic metrics recording - reduces 14 commands to 1 round trip
const METRICS_LUA_SCRIPT = `
local keyPrefix = KEYS[1]
local key = KEYS[2]
local allowed = tonumber(ARGV[1])
local latencyMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttlMs = tonumber(ARGV[4])
local topIpsLimit = tonumber(ARGV[5])
local latencySamples = tonumber(ARGV[6])
local ttlSec = math.ceil(ttlMs / 1000)

-- Helper to set TTL only if not already set
local function setTtlIfNeeded(k)
  local ttl = redis.call('TTL', k)
  if ttl == -1 then
    redis.call('PEXPIRE', k, ttlMs)
  end
end

local totalKey = keyPrefix .. ':requests:total'
local allowedKey = keyPrefix .. ':requests:allowed'
local blockedKey = keyPrefix .. ':requests:blocked'
local ipReqKey = keyPrefix .. ':ips:requests'
local ipBlockKey = keyPrefix .. ':ips:blocked'
local latencyKey = keyPrefix .. ':latency:all'
local activeKey = keyPrefix .. ':buckets:active'

-- Increment total counter
redis.call('INCR', totalKey)
setTtlIfNeeded(totalKey)

if allowed == 1 then
  redis.call('INCR', allowedKey)
  redis.call('ZINCRBY', ipReqKey, 1, KEYS[2])
  setTtlIfNeeded(allowedKey)
  setTtlIfNeeded(ipReqKey)
else
  redis.call('INCR', blockedKey)
  redis.call('ZINCRBY', ipBlockKey, 1, KEYS[2])
  setTtlIfNeeded(blockedKey)
  setTtlIfNeeded(ipBlockKey)
end

-- Track active IP
redis.call('SADD', activeKey, KEYS[2])
setTtlIfNeeded(activeKey)

-- Latency sorted set
local latencyMember = now .. ':' .. ARGV[2]
redis.call('ZADD', latencyKey, now, latencyMember)
redis.call('ZREMRANGEBYRANK', latencyKey, 0, -(tonumber(ARGV[6]) + 1))
setTtlIfNeeded(latencyKey)

return {1}
`;

export interface RedisMetricsCollectorConfig {
  redisUrl?: string;
  redisKeyPrefix?: string;
  metricsTtlHours?: number;
  metricsTopIpsLimit?: number;
  metricsLatencySamples?: number;
  failOpen?: boolean;
  commandTimeoutMs?: number;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number;
  lazyConnect?: boolean;
}

export class RedisMetricsCollector implements MetricsCollector {
  private readonly client: Redis;
  private readonly keyPrefix: string;
  private readonly ttlMs: number;
  private readonly topIpsLimit: number;
  private readonly latencySamples: number;
  private readonly failOpen: boolean;
  private readonly commandTimeoutMs: number;
  private readonly connected: Promise<boolean>;
  private metricsScriptSha: string;

  constructor(config: RedisMetricsCollectorConfig) {
    this.keyPrefix = `${config.redisKeyPrefix || 'ratelimit'}:metrics`;
    this.ttlMs = (config.metricsTtlHours || 24) * 60 * 60 * 1000;
    this.topIpsLimit = config.metricsTopIpsLimit || 10;
    this.latencySamples = config.metricsLatencySamples || 1000;
    this.failOpen = config.failOpen ?? false;
    this.commandTimeoutMs = config.commandTimeoutMs ?? 200;

    const redisUrl = config.redisUrl || 'redis://localhost:6379';
    this.client = new Redis(config.redisUrl || 'redis://localhost:6379', {
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 1,
      retryStrategy: config.retryStrategy ?? ((times: number) => Math.min(times * 50, 200)),
      lazyConnect: config.lazyConnect ?? true,
      commandTimeout: this.commandTimeoutMs,
      connectTimeout: 5000,
    });

    this.client.on('error', (err: Error) => {
      console.error('[RedisMetricsCollector] Redis error:', err.message);
    });

    // Load Lua script for atomic metrics recording
    this.metricsScriptSha = '';
    this.connected = this.client.connect()
      .then(async () => {
        this.metricsScriptSha = await this.client.script('LOAD', METRICS_LUA_SCRIPT) as string;
        return true;
      })
      .catch((err: Error) => {
        console.error('[RedisMetricsCollector] Initial connection failed:', err.message);
        return false;
      });
  }

  private key(suffix: string): string {
    return `${this.keyPrefix}:${suffix}`;
  }

  async recordRequest(key: string, allowed: boolean, latencyMs: number): Promise<void> {
    const isConnected = await this.connected;
    if (!isConnected) {
      if (!this.failOpen) {
        console.error('[RedisMetricsCollector] Redis unavailable, request not recorded (fail-closed)');
      }
      return;
    }

    try {
      // Single Lua script call - atomic, ~6 commands in 1 round trip
      await this.client.evalsha(
        this.metricsScriptSha,
        2, // number of keys: keyPrefix, key
        this.keyPrefix,
        key,
        allowed ? 1 : 0,
        latencyMs,
        Date.now(),
        this.ttlMs,
        this.topIpsLimit,
        this.latencySamples
      );
    } catch (err) {
      const error = err as Error;
      // Handle NOSCRIPT error - reload script and retry once
      if (error.message.includes('NOSCRIPT')) {
        try {
          this.metricsScriptSha = await this.client.script('LOAD', METRICS_LUA_SCRIPT) as string;
          await this.client.evalsha(
            this.metricsScriptSha,
            2,
            this.keyPrefix,
            key,
            allowed ? 1 : 0,
            latencyMs,
            Date.now(),
            this.ttlMs,
            this.topIpsLimit,
            this.latencySamples
          );
          return;
        } catch (retryErr) {
          console.error('[RedisMetricsCollector] recordRequest retry failed:', (retryErr as Error).message);
        }
      }
      console.error('[RedisMetricsCollector] recordRequest failed:', (err as Error).message);

      if (!this.failOpen) {
        console.error('[RedisMetricsCollector] Metric lost (fail-closed)');
      }
    }
  }

  async getSnapshot(): Promise<MetricsSnapshot> {
    const isConnected = await this.connected;
    if (!isConnected) {
      if (!this.failOpen) {
        console.error('[RedisMetricsCollector] Redis unavailable for snapshot (fail-closed)');
      }
      return this.emptySnapshot();
    }

    try {
      const [
        total,
        allowed,
        blocked,
        topRequests,
        topBlocks,
        latencies,
        activeCount,
      ] = await Promise.all([
        this.client.get(this.key('requests:total')).then((v: string | null) => parseInt(v || '0', 10)),
        this.client.get(this.key('requests:allowed')).then((v: string | null) => parseInt(v || '0', 10)),
        this.client.get(this.key('requests:blocked')).then((v: string | null) => parseInt(v || '0', 10)),
        this.client.zrevrange(this.key('ips:requests'), 0, this.topIpsLimit - 1, 'WITHSCORES'),
        this.client.zrevrange(this.key('ips:blocked'), 0, this.topIpsLimit - 1, 'WITHSCORES'),
        this.client.zrange(this.key('latency:all'), 0, -1),
        this.client.scard(this.key('buckets:active')),
      ]);

      const totalNum = total || 0;
      const allowedNum = allowed || 0;
      const blockedNum = blocked || 0;

      // Parse sorted set results: [ip1, score1, ip2, score2, ...]
      const parseZRevRange = (arr: string[]) => {
        const result: Array<{ ip: string; count: number }> = [];
        for (let i = 0; i < arr.length; i += 2) {
          result.push({ ip: arr[i], count: parseInt(arr[i + 1], 10) });
        }
        return result;
      };

      // Parse latencies: member = "timestamp:latencyMs"
      const latencyValues = latencies
        .map((m: string) => parseInt(m.split(':')[1], 10))
        .filter((v: number) => !isNaN(v))
        .sort((a: number, b: number) => a - b);

      const percentile = (p: number) => {
        if (latencyValues.length === 0) return 0;
        const idx = Math.ceil(latencyValues.length * p / 100) - 1;
        return latencyValues[Math.max(0, idx)];
      };

      const avg = latencyValues.length > 0
        ? latencyValues.reduce((s: number, v: number) => s + v, 0) / latencyValues.length
        : 0;

      return {
        timestamp: Date.now(),
        requests: {
          total: totalNum,
          allowed: allowedNum,
          blocked: blockedNum,
          blockRate: totalNum > 0 ? blockedNum / totalNum : 0,
        },
        latency: {
          p50: percentile(50),
          p95: percentile(95),
          p99: percentile(99),
          avg,
        },
        topIPs: {
          byRequests: parseZRevRange(topRequests),
          byBlocks: parseZRevRange(topBlocks),
        },
        activeBuckets: activeCount,
        redis: {
          connected: true,
          keyPrefix: this.keyPrefix.replace(':metrics', ''),
        },
      };
    } catch (err) {
      const error = err as Error;
      console.error('[RedisMetricsCollector] getSnapshot failed:', error.message);

      if (this.failOpen) {
        return this.emptySnapshot();
      }
      return this.emptySnapshot();
    }
  }

  private emptySnapshot(): MetricsSnapshot {
    return {
      timestamp: Date.now(),
      requests: { total: 0, allowed: 0, blocked: 0, blockRate: 0 },
      latency: { p50: 0, p95: 0, p99: 0, avg: 0 },
      topIPs: { byRequests: [], byBlocks: [] },
      activeBuckets: 0,
      redis: { connected: false, keyPrefix: this.keyPrefix.replace(':metrics', '') },
    };
  }

  async shutdown(): Promise<void> {
    await this.client.quit();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

export interface RedisMetricsCollectorConfig {
  redisUrl?: string;
  redisKeyPrefix?: string;
  metricsTtlHours?: number;
  metricsTopIpsLimit?: number;
  metricsLatencySamples?: number;
  failOpen?: boolean;
  commandTimeoutMs?: number;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number;
  lazyConnect?: boolean;
}
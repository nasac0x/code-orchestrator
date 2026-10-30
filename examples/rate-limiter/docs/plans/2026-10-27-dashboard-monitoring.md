# Implementation Plan: Dashboard de Monitoramento com Métricas Redis

**Goal:** Add real-time monitoring dashboard to Fastify server with `/api/metrics` endpoint, `/dashboard` HTML page served via @fastify/static, and metrics collection integrated into rate limiter.

**Architecture:** Fastify middleware wraps `store.take()` with metrics collection → Redis keys (INCR, ZINCRBY, SORTED SET) store telemetry → `/api/metrics` endpoint reads snapshot → `@fastify/static` serves `public/dashboard.html` → vanilla JS polls `/api/metrics` every 2s.

**Global Constraints:**
- Must maintain backward compatibility with existing rate limiter
- Metrics work with both Memory and Redis backends
- Dashboard HTML served at `/dashboard` with polling to `/api/metrics`
- TypeScript strict mode, Vitest for TDD
- All existing tests must continue passing

---

### Task 1: Add Dependencies & Config

**Files:**
- Modify: `package.json`
- Modify: `src/config/rate-limit.ts`

**Interfaces:**
- Produces: Extended `RateLimitConfig` with metrics options

**Steps:**
- [ ] Step 1.1: Add `@fastify/static` and `chart.js` (for dashboard) to `package.json`:
```json
"dependencies": {
  "fastify": "^4.28.1",
  "dotenv": "^16.4.5",
  "ioredis": "^5.4.1",
  "@fastify/static": "^7.0.4"
}
```

- [ ] Step 1.2: Run `npm install`
- [ ] Step 1.3: Extend `src/config/rate-limit.ts` with metrics options:
```typescript
import { FastifyRequest } from 'fastify';

export interface RateLimitConfig {
  capacity: number;
  refillRate: number;
  keyGenerator?: (req: FastifyRequest) => string;
  skip?: (req: FastifyRequest) => boolean;
  redisUrl?: string;
  redisKeyPrefix?: string;
  redisConnectionOptions?: Record<string, unknown>;
  // NEW Metrics options
  metricsEnabled?: boolean;
  metricsTtlHours?: number;
  metricsTopIpsLimit?: number;
  metricsLatencySamples?: number;
}

export const rateLimitConfig: RateLimitConfig = {
  capacity: Number(process.env.RATE_LIMIT_CAPACITY) || 10,
  refillRate: (Number(process.env.RATE_LIMIT_CAPACITY) || 10) / (Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000),
  skip: (req) => {
    const skipPaths = (process.env.RATE_LIMIT_SKIP_PATHS || '/health,/ready').split(',');
    return skipPaths.includes(req.url);
  },
  redisUrl: process.env.REDIS_URL,
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'ratelimit',
  redisConnectionOptions: {},
  metricsEnabled: process.env.METRICS_ENABLED !== 'false',
  metricsTtlHours: Number(process.env.METRICS_TTL_HOURS) || 24,
  metricsTopIpsLimit: Number(process.env.METRICS_TOP_IPS_LIMIT) || 10,
  metricsLatencySamples: Number(process.env.METRICS_LATENCY_SAMPLES) || 1000,
};
```

---

### Task 2: Create Metrics Types & Interface

**Files:**
- Create: `src/metrics/types.ts`
- Create: `src/metrics/index.ts`

**Interfaces:**
- Produces: `MetricsSnapshot`, `MetricsCollector` interface

**Steps:**
- [ ] Step 2.1: Create `src/metrics/types.ts`:
```typescript
export interface MetricsSnapshot {
  timestamp: number;
  requests: {
    total: number;
    allowed: number;
    blocked: number;
    blockRate: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  topIPs: {
    byRequests: Array<{ ip: string; count: number }>;
    byBlocks: Array<{ ip: string; count: number }>;
  };
  activeBuckets: number;
  redis: {
    connected: boolean;
    keyPrefix: string;
  };
}

export interface MetricsCollector {
  recordRequest(key: string, allowed: boolean, latencyMs: number): Promise<void>;
  getSnapshot(): Promise<MetricsSnapshot>;
  shutdown(): Promise<void>;
}
```

- [ ] Step 2.2: Create `src/metrics/index.ts` (barrel export):
```typescript
export * from './types';
export * from './collector';
```

---

### Task 3: Memory Metrics Collector (TDD - Failing Tests First)

**Files:**
- Create: `tests/metrics-collector-memory.test.ts`
- Create: `src/metrics/collector-memory.ts`

**Interfaces:**
- Consumes: `MetricsCollector` interface from Task 2
- Produces: `MemoryMetricsCollector` class

**Steps:**
- [ ] Step 3.1: Write failing test `tests/metrics-collector-memory.test.ts`:
```typescript
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
    const latencies = [1, 2, 3, 4, 5, 10, 20, 50, 100, 200];
    for (const l of latencies) {
      await collector.recordRequest('10.0.0.3', true, l);
    }
    const snap = await collector.getSnapshot();
    expect(snap.latency.p50).toBeGreaterThan(0);
    expect(snap.latency.p95).toBeGreaterThan(snap.latency.p50);
    expect(snap.latency.p99).toBeGreaterThan(snap.latency.p95);
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
```

- [ ] Step 3.2: Run test → confirm RED
- [ ] Step 3.3: Implement `src/metrics/collector-memory.ts`:
```typescript
import { MetricsCollector, MetricsSnapshot } from './types';

interface LatencySample {
  value: number;
  timestamp: number;
}

export class MemoryMetricsCollector implements MetricsCollector {
  private totalRequests = 0;
  private allowedRequests = 0;
  private blockedRequests = 0;
  private ipRequests = new Map<string, number>();
  private ipBlocks = new Map<string, number>();
  private latencies: LatencySample[] = [];
  private activeIps = new Set<string>();
  private readonly topIpsLimit: number;
  private readonly latencySamples: number;

  constructor(config: { keyPrefix: string; topIpsLimit: number; latencySamples: number }) {
    this.topIpsLimit = config.topIpsLimit;
    this.latencySamples = config.latencySamples;
  }

  async recordRequest(key: string, allowed: boolean, latencyMs: number): Promise<void> {
    this.totalRequests++;
    this.activeIps.add(key);
    
    if (allowed) {
      this.allowedRequests++;
      this.ipRequests.set(key, (this.ipRequests.get(key) || 0) + 1);
    } else {
      this.blockedRequests++;
      this.ipBlocks.set(key, (this.ipBlocks.get(key) || 0) + 1);
    }

    this.latencies.push({ value: latencyMs, timestamp: Date.now() });
    if (this.latencies.length > this.latencySamples) {
      this.latencies.shift();
    }
  }

  async getSnapshot(): Promise<MetricsSnapshot> {
    const now = Date.now();
    const sortedLatencies = [...this.latencies].sort((a, b) => a.value - b.value);
    
    const percentile = (p: number) => {
      if (sortedLatencies.length === 0) return 0;
      const idx = Math.ceil(sortedLatencies.length * p / 100) - 1;
      return sortedLatencies[Math.max(0, idx)].value;
    };

    const avg = sortedLatencies.length > 0 
      ? sortedLatencies.reduce((s, l) => s + l.value, 0) / sortedLatencies.length 
      : 0;

    const topByRequests = [...this.ipRequests.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.topIpsLimit)
      .map(([ip, count]) => ({ ip, count }));

    const topByBlocks = [...this.ipBlocks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.topIpsLimit)
      .map(([ip, count]) => ({ ip, count }));

    return {
      timestamp: now,
      requests: {
        total: this.totalRequests,
        allowed: this.allowedRequests,
        blocked: this.blockedRequests,
        blockRate: this.totalRequests > 0 ? this.blockedRequests / this.totalRequests : 0,
      },
      latency: {
        p50: percentile(50),
        p95: percentile(95),
        p99: percentile(99),
        avg,
      },
      topIPs: {
        byRequests: topByRequests,
        byBlocks: topByBlocks,
      },
      activeBuckets: this.activeIps.size,
      redis: {
        connected: false,
        keyPrefix: 'memory',
      },
    };
  }

  async shutdown(): Promise<void> {
    this.totalRequests = 0;
    this.allowedRequests = 0;
    this.blockedRequests = 0;
    this.ipRequests.clear();
    this.ipBlocks.clear();
    this.latencies = [];
    this.activeIps.clear();
  }
}
```

- [ ] Step 3.4: Run test → confirm GREEN

---

### Task 4: Redis Metrics Collector (TDD - Failing Tests First)

**Files:**
- Create: `tests/metrics-collector-redis.test.ts`
- Create: `src/metrics/collector-redis.ts`

**Interfaces:**
- Consumes: `MetricsCollector` interface, `RateLimitConfig`, ioredis
- Produces: `RedisMetricsCollector` class

**Steps:**
- [ ] Step 4.1: Write failing test `tests/metrics-collector-redis.test.ts` (skipped without REDIS_URL):
```typescript
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
    const latencies = [10, 20, 30, 40, 50, 100, 200];
    for (const l of latencies) {
      await collector.recordRequest('10.0.0.3', true, l);
    }
    const snap = await collector.getSnapshot();
    expect(snap.latency.p50).toBeGreaterThan(0);
    expect(snap.latency.p95).toBeGreaterThan(snap.latency.p50);
  });
});
```

- [ ] Step 4.2: Run test → confirm RED (needs Redis)
- [ ] Step 4.3: Implement `src/metrics/collector-redis.ts`:
```typescript
import Redis from 'ioredis';
import { MetricsCollector, MetricsSnapshot } from './types';
import { RateLimitConfig } from '../config/rate-limit';

export class RedisMetricsCollector implements MetricsCollector {
  private client: Redis;
  private readonly keyPrefix: string;
  private readonly ttlMs: number;
  private readonly topIpsLimit: number;
  private readonly latencySamples: number;
  private readonly connected: Promise<boolean>;

  constructor(config: RateLimitConfig) {
    this.keyPrefix = `${config.redisKeyPrefix || 'ratelimit'}:metrics`;
    this.ttlMs = (config.metricsTtlHours || 24) * 60 * 60 * 1000;
    this.topIpsLimit = config.metricsTopIpsLimit || 10;
    this.latencySamples = config.metricsLatencySamples || 1000;

    const redisUrl = config.redisUrl || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
      ...config.redisConnectionOptions,
    });

    this.client.on('error', (err) => {
      console.error('[RedisMetricsCollector] Redis error:', err);
    });

    this.connected = this.client.connect().then(() => true).catch(() => false);
  }

  private key(suffix: string): string {
    return `${this.keyPrefix}:${suffix}`;
  }

  async recordRequest(key: string, allowed: boolean, latencyMs: number): Promise<void> {
    const isConnected = await this.connected;
    if (!isConnected) return;

    const now = Date.now();
    const pipeline = this.client.pipeline();

    // Increment counters
    pipeline.incr(this.key('requests:total'));
    if (allowed) {
      pipeline.incr(this.key('requests:allowed'));
      pipeline.zincrby(this.key('ips:requests'), 1, key);
    } else {
      pipeline.incr(this.key('requests:blocked'));
      pipeline.zincrby(this.key('ips:blocked'), 1, key);
    }

    // Track active IP
    pipeline.sadd(this.key('buckets:active'), key);
    pipeline.pexpire(this.key('buckets:active'), this.ttlMs);

    // Latency sorted set (score = timestamp, member = latency)
    const latencyMember = `${now}:${latencyMs}`;
    pipeline.zadd(this.key('latency:all'), now, latencyMember);
    // Trim to max samples (keep newest)
    pipeline.zremrangebyrank(this.key('latency:all'), 0, -(this.latencySamples + 1));

    // Set TTL on all metric keys
    const metricKeys = [
      'requests:total', 'requests:allowed', 'requests:blocked',
      'ips:requests', 'ips:blocked', 'latency:all'
    ];
    for (const k of metricKeys) {
      pipeline.pexpire(this.key(k), this.ttlMs);
    }

    await pipeline.exec();
  }

  async getSnapshot(): Promise<MetricsSnapshot> {
    const isConnected = await this.connected;
    if (!isConnected) {
      return this.emptySnapshot();
    }

    const [
      total,
      allowed,
      blocked,
      topRequests,
      topBlocks,
      latencies,
      activeCount,
    ] = await Promise.all([
      this.client.get(this.key('requests:total')).then(v => parseInt(v || '0', 10)),
      this.client.get(this.key('requests:allowed')).then(v => parseInt(v || '0', 10)),
      this.client.get(this.key('requests:blocked')).then(v => parseInt(v || '0', 10)),
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
      .map(m => parseInt(m.split(':')[1], 10))
      .filter(v => !isNaN(v))
      .sort((a, b) => a - b);

    const percentile = (p: number) => {
      if (latencyValues.length === 0) return 0;
      const idx = Math.ceil(latencyValues.length * p / 100) - 1;
      return latencyValues[Math.max(0, idx)];
    };

    const avg = latencyValues.length > 0
      ? latencyValues.reduce((s, v) => s + v, 0) / latencyValues.length
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
}
```

- [ ] Step 4.4: Run test with Redis → confirm GREEN

---

### Task 5: Metrics Factory & Integration

**Files:**
- Modify: `src/metrics/collector.ts` (factory)
- Modify: `src/metrics/index.ts`

**Interfaces:**
- Consumes: `MemoryMetricsCollector`, `RedisMetricsCollector`, `RateLimitConfig`
- Produces: `createMetricsCollector(config)` factory

**Steps:**
- [ ] Step 5.1: Create `src/metrics/collector.ts`:
```typescript
import { MetricsCollector } from './types';
import { MemoryMetricsCollector } from './collector-memory';
import { RedisMetricsCollector } from './collector-redis';
import { RateLimitConfig } from '../config/rate-limit';

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
```

- [ ] Step 5.2: Update `src/metrics/index.ts`:
```typescript
export * from './types';
export * from './collector';
export * from './collector-memory';
export * from './collector-redis';
```

---

### Task 6: Integrate Metrics into Rate Limiter Middleware

**Files:**
- Modify: `src/middleware/rate-limiter.ts`

**Interfaces:**
- Consumes: `createMetricsCollector`, `createTokenBucketStore`
- Produces: Updated `createRateLimiter` with metrics wrapper

**Steps:**
- [ ] Step 6.1: Update `src/middleware/rate-limiter.ts`:
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createTokenBucketStore, TokenBucketStoreInterface } from '../utils/token-bucket-store';
import { createMetricsCollector, MetricsCollector } from '../metrics';
import { RateLimitConfig } from '../config/rate-limit';

interface RateLimiterOptions {
  store?: TokenBucketStoreInterface;
  metrics?: MetricsCollector;
  config?: Partial<RateLimitConfig>;
}

const defaultKeyGenerator = (req: FastifyRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    return ips;
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export function createRateLimiter(options: RateLimiterOptions) {
  const { 
    store: providedStore, 
    metrics: providedMetrics,
    config = {} 
  } = options;
  
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;
  const skip = config.skip || (() => false);
  const capacity = config.capacity ?? 10;

  // Use provided store or create one from config (factory)
  const store = providedStore || createTokenBucketStore(config as RateLimitConfig);
  // Use provided metrics or create one from config (factory)
  const metrics = providedMetrics || createMetricsCollector(config as RateLimitConfig);

  return async function rateLimiterHook(req: FastifyRequest, reply: FastifyReply) {
    if (skip(req)) return;

    const key = keyGenerator(req);
    const start = Date.now();
    
    try {
      const result = await store.take(key);
      const latency = Date.now() - start;
      
      // Record metrics (fire-and-forget, don't block response)
      metrics.recordRequest(key, result.allowed, latency).catch(err => {
        console.error('[RateLimiter] Metrics error:', err);
      });

      reply.header('X-RateLimit-Limit', String(capacity));
      reply.header('X-RateLimit-Remaining', String(result.remaining));
      reply.header('X-RateLimit-Reset', String(result.reset));

      if (!result.allowed) {
        reply.header('Retry-After', String(result.retryAfter));
        reply.code(429);
        return reply.send({ error: 'Too Many Requests', retryAfter: result.retryAfter });
      }
    } catch (err) {
      const latency = Date.now() - start;
      metrics.recordRequest(key, false, latency).catch(() => {});
      throw err;
    }
  };
}

// Also export as a plugin for convenience
import { FastifyPluginAsync } from 'fastify';

export const rateLimiter: FastifyPluginAsync<RateLimiterOptions> = async (app, options) => {
  const hook = createRateLimiter(options);
  app.addHook('onRequest', hook);
};
```

---

### Task 7: Metrics Endpoint `/api/metrics`

**Files:**
- Create: `tests/metrics-endpoint.test.ts`
- Modify: `src/app.ts` (add route)

**Interfaces:**
- Consumes: `createMetricsCollector`, `rateLimitConfig`
- Produces: GET `/api/metrics` route

**Steps:**
- [ ] Step 7.1: Write failing test `tests/metrics-endpoint.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import { rateLimitConfig } from '../src/config/rate-limit';

describe('Metrics Endpoint', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.useFakeTimers();
    app = Fastify();
    const rateLimiterHook = createRateLimiter({ config: rateLimitConfig });
    app.addHook('onRequest', rateLimiterHook);
    
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
```

- [ ] Step 7.2: Run test → confirm RED
- [ ] Step 7.3: Add `/api/metrics` route to `src/app.ts`:
```typescript
import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRateLimiter } from './middleware/rate-limiter';
import { createMetricsCollector } from './metrics';
import { rateLimitConfig } from './config/rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

// Create shared metrics collector
const metrics = createMetricsCollector(rateLimitConfig);

// Register rate limiter hook
const rateLimiterHook = createRateLimiter({ config: rateLimitConfig, metrics });
app.addHook('onRequest', rateLimiterHook);

// Register static files for dashboard
await app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/dashboard/',
  decorateReply: false,
});

// Routes
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/ready', async () => ({ status: 'ready' }));
app.get('/api/test', async () => ({ message: 'Hello from rate-limited endpoint!' }));

// Metrics endpoint
app.get('/api/metrics', async () => {
  const snapshot = await metrics.getSnapshot();
  return snapshot;
});

// Dashboard HTML
app.get('/dashboard', async (req, reply) => {
  return reply.sendFile('dashboard.html');
});

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down...');
  await metrics.shutdown();
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    app.log.info(`Server listening on http://localhost:3000`);
    app.log.info(`Dashboard available at http://localhost:3000/dashboard`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

- [ ] Step 7.4: Run test → confirm GREEN

---

### Task 8: Dashboard HTML (`public/dashboard.html`)

**Files:**
- Create: `public/dashboard.html`
- Create: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `/api/metrics` endpoint
- Produces: Self-contained HTML with vanilla JS dashboard

**Steps:**
- [ ] Step 8.1: Create `public/dashboard.html`:
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rate Limiter Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { background: #1a1a2e; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 16px; }
    h1 { font-size: 1.5rem; font-weight: 600; }
    .status { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; }
    .status-dot.connected { background: #22c55e; }
    .status-dot.disconnected { background: #ef4444; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h3 { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; font-weight: 600; }
    .card .value { font-size: 2.5rem; font-weight: 700; color: #111827; line-height: 1; }
    .card .value.blocked { color: #ef4444; }
    .card .value.allowed { color: #22c55e; }
    .chart-container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; height: 300px; }
    .table-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 0.875rem; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: #f9fafb; }
    .ip-cell { font-family: monospace; font-size: 0.875rem; }
    .count-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .count-badge.requests { background: #dbeafe; color: #1e40af; }
    .count-badge.blocks { background: #fee2e2; color: #991b1b; }
    .loading { text-align: center; padding: 40px; color: #6b7280; }
    .error { color: #ef4444; text-align: center; padding: 20px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } header { flex-direction: column; align-items: flex-start; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Rate Limiter Dashboard</h1>
      <div class="status">
        <span id="redis-status-text">Conectando...</span>
        <span id="redis-status-dot" class="status-dot"></span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <h3>Total de Requisições</h3>
        <div class="value" id="total-requests">0</div>
      </div>
      <div class="card">
        <h3>Permitidas (200)</h3>
        <div class="value allowed" id="allowed-requests">0</div>
      </div>
      <div class="card">
        <h3>Bloqueadas (429)</h3>
        <div class="value blocked" id="blocked-requests">0</div>
      </div>
      <div class="card">
        <h3>Taxa de Bloqueio</h3>
        <div class="value" id="block-rate">0%</div>
      </div>
      <div class="card">
        <h3>Buckets Ativos</h3>
        <div class="value" id="active-buckets">0</div>
      </div>
      <div class="card">
        <h3>Latência Média</h3>
        <div class="value" id="avg-latency">0ms</div>
      </div>
    </div>

    <div class="chart-container">
      <canvas id="latency-chart"></canvas>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="table-container">
        <table>
          <thead>
            <tr><th colspan="2">Top IPs por Requisições</th></tr>
            <tr><th>IP</th><th>Count</th></tr>
          </thead>
          <tbody id="top-requests-body"></tbody>
        </table>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr><th colspan="2">Top IPs por Bloqueios</th></tr>
            <tr><th>IP</th><th>Count</th></tr>
          </thead>
          <tbody id="top-blocks-body"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let latencyChart = null;

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/metrics');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
        document.getElementById('redis-status-text').textContent = 'Erro na conexão';
        document.getElementById('redis-status-dot').className = 'status-dot disconnected';
        return null;
      }
    }

    function updateDashboard(data) {
      if (!data) return;

      // Update cards
      document.getElementById('total-requests').textContent = data.requests.total.toLocaleString();
      document.getElementById('allowed-requests').textContent = data.requests.allowed.toLocaleString();
      document.getElementById('blocked-requests').textContent = data.requests.blocked.toLocaleString();
      document.getElementById('block-rate').textContent = (data.requests.blockRate * 100).toFixed(1) + '%';
      document.getElementById('active-buckets').textContent = data.activeBuckets.toLocaleString();
      document.getElementById('avg-latency').textContent = Math.round(data.latency.avg) + 'ms';

      // Redis status
      const dot = document.getElementById('redis-status-dot');
      const text = document.getElementById('redis-status-text');
      if (data.redis.connected) {
        dot.className = 'status-dot connected';
        text.textContent = 'Redis Conectado';
      } else {
        dot.className = 'status-dot disconnected';
        text.textContent = 'Memória (sem Redis)';
      }

      // Latency chart
      updateLatencyChart(data.latency);

      // Top IPs tables
      updateTopIPsTable('top-requests-body', data.topIPs.byRequests, 'requests');
      updateTopIPsTable('top-blocks-body', data.topIPs.byBlocks, 'blocks');
    }

    function updateLatencyChart(latency) {
      const ctx = document.getElementById('latency-chart').getContext('2d');
      const labels = ['p50', 'p95', 'p99', 'Média'];
      const values = [latency.p50, latency.p95, latency.p99, latency.avg];

      if (!latencyChart) {
        latencyChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Latência (ms)',
              data: values,
              backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#6b7280'],
              borderRadius: 4,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, title: { display: true, text: 'ms' } }
            }
          }
        });
      } else {
        latencyChart.data.datasets[0].data = values;
        latencyChart.update();
      }
    }

    function updateTopIPsTable(tbodyId, ips, type) {
      const tbody = document.getElementById(tbodyId);
      if (ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#6b7280">Nenhum dado</td></tr>';
        return;
      }
      tbody.innerHTML = ips.map(({ ip, count }) => `
        <tr>
          <td class="ip-cell">${escapeHtml(ip)}</td>
          <td><span class="count-badge ${type === 'requests' ? 'requests' : 'blocks'}">${count}</span></td>
        </tr>
      `).join('');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function refresh() {
      const data = await fetchMetrics();
      updateDashboard(data);
    }

    // Initial load
    refresh();

    // Poll every 2 seconds
    setInterval(refresh, 2000);
  </script>
</body>
</html>
```

- [ ] Step 8.2: Write test `tests/dashboard.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import { rateLimitConfig } from '../src/config/rate-limit';

describe('Dashboard HTML', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    const rateLimiterHook = createRateLimiter({ config: rateLimitConfig });
    app.addHook('onRequest', rateLimiterHook);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should serve dashboard HTML at /dashboard', async () => {
    const res = await app.inject({ method: 'GET', url: '/dashboard' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.payload).toContain('Rate Limiter Dashboard');
    expect(res.payload).toContain('/api/metrics');
  });

  it('should serve static assets under /dashboard/', async () => {
    // This tests @fastify/static registration
    const res = await app.inject({ method: 'GET', url: '/dashboard/dashboard.html' });
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] Step 8.3: Run test → confirm GREEN

---

### Task 9: Update .env.example & Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Steps:**
- [ ] Step 9.1: Update `.env.example`:
```env
# Rate Limit Settings
RATE_LIMIT_CAPACITY=10
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_SKIP_PATHS=/health,/ready

# Redis Backend (Optional)
# REDIS_URL=redis://localhost:6379
# REDIS_KEY_PREFIX=myapp

# Metrics & Dashboard
METRICS_ENABLED=true
METRICS_TTL_HOURS=24
METRICS_TOP_IPS_LIMIT=10
METRICS_LATENCY_SAMPLES=1000
```

- [ ] Step 9.2: Update `README.md` with Dashboard section:
```markdown
## Dashboard de Monitoramento

Acesse o painel em tempo real: **http://localhost:3000/dashboard**

### Métricas Disponíveis (`/api/metrics`)
- Total / Permitidas / Bloqueadas
- Taxa de bloqueio
- Latência p50/p95/p99/avg
- Top 10 IPs por requests e blocks
- Buckets ativos
- Status Redis

### Configuração
```env
METRICS_ENABLED=true
METRICS_TTL_HOURS=24
METRICS_TOP_IPS_LIMIT=10
METRICS_LATENCY_SAMPLES=1000
```
```

---

### Task 10: Run All Tests & Verify

**Files:** (none new)

**Steps:**
- [ ] Step 10.1: Run `npm test` → all tests pass (Memory + existing)
- [ ] Step 10.2: Run `REDIS_URL=redis://localhost:6379 npm test` → Redis integration tests pass
- [ ] Step 10.3: Run `npm run build` → TypeScript compiles
- [ ] Step 10.4: Manual test:
```bash
npm run dev
# Abrir http://localhost:3000/dashboard no navegador
# Fazer requisições: curl http://localhost:3000/api/test
# Verificar dashboard atualiza em tempo real
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Endpoint `/api/metrics` com telemetria real | Task 7 |
| Dashboard HTML servido nativamente em `/dashboard` | Task 8 |
| Interface consome endpoint real via fetch/polling | Task 8 |
| @fastify/static para servir HTML | Task 7, 8 |
| TDD com testes falhando primeiro | Tasks 3, 4, 7, 8 |
| Funciona com Memory e Redis | Tasks 3, 4 |
| Backward compatibility | Task 6 (factory pattern) |

---

## Next Actions

1. Execute Task 1 → Add deps + config
2. Execute Task 2 → Types
3. Execute Task 3 → Memory collector (TDD)
4. Execute Task 4 → Redis collector (TDD)
5. Execute Task 5 → Factory
6. Execute Task 6 → Middleware integration
7. Execute Task 7 → Metrics endpoint (TDD)
8. Execute Task 8 → Dashboard HTML (TDD)
9. Execute Task 9 → Config + docs
10. Execute Task 10 → Verify all
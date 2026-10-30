# Implementation Plan: Rate Limiter Token Bucket Middleware

**Goal:** Implement a resilient, thread-safe Token Bucket rate limiter middleware for Fastify (TypeScript) with 10 req/min per IP, returning 429 + Retry-After on limit exceeded.

**Architecture:** Fastify middleware → TokenBucketStore (singleton with Map<IP, TokenBucket> + Map<IP, Mutex>) → Mutex per IP ensures atomic take()+refill(). Cleanup interval prevents memory leaks. Config via .env.

**Global Constraints:**
- Language: TypeScript + Fastify
- Test framework: Vitest
- Token Bucket algorithm
- 10 requests/minute per IP
- HTTP 429 + Retry-After header
- Thread-safe (Mutex per IP)
- In-memory storage with cleanup
- Skip paths: /health, /ready

---

### Task 1: Project Scaffold & Config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env`
- Create: `src/config/rate-limit.ts`

**Interfaces:**
- Produces: `RateLimitConfig` for all later tasks

**Steps:**
- [ ] Step 1.1: Create `package.json` with dependencies:
```json
{
  "name": "rate-limiter-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fastify": "^4.28.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "tsx": "^4.19.0"
  }
}
```

- [ ] Step 1.2: Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] Step 1.3: Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

- [ ] Step 1.4: Create `.env`:
```env
RATE_LIMIT_CAPACITY=10
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_SKIP_PATHS=/health,/ready
```

- [ ] Step 1.5: Create `src/config/rate-limit.ts`:
```typescript
export interface RateLimitConfig {
  capacity: number;
  refillRate: number; // tokens per ms
  keyGenerator?: (req: FastifyRequest) => string;
  skip?: (req: FastifyRequest) => boolean;
}

import { FastifyRequest } from 'fastify';

export const rateLimitConfig: RateLimitConfig = {
  capacity: Number(process.env.RATE_LIMIT_CAPACITY) || 10,
  refillRate: (Number(process.env.RATE_LIMIT_CAPACITY) || 10) / (Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000),
  skip: (req) => {
    const skipPaths = (process.env.RATE_LIMIT_SKIP_PATHS || '/health,/ready').split(',');
    return skipPaths.includes(req.url);
  },
};
```

---

### Task 2: Mutex Implementation (Thread-Safety Primitive)

**Files:**
- Create: `src/utils/mutex.ts`
- Create: `tests/mutex.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `Mutex` class with `runExclusive<T>(fn: () => Promise<T>): Promise<T>`

**Steps:**
- [ ] Step 2.1: Write failing test `tests/mutex.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mutex } from '../src/utils/mutex';

describe('Mutex', () => {
  let mutex: Mutex;

  beforeEach(() => {
    mutex = new Mutex();
  });

  it('should serialize concurrent executions', async () => {
    const order: number[] = [];
    const promises = [
      mutex.runExclusive(async () => { await new Promise(r => setTimeout(r, 10)); order.push(1); }),
      mutex.runExclusive(async () => { await new Promise(r => setTimeout(r, 5)); order.push(2); }),
      mutex.runExclusive(async () => { order.push(3); }),
    ];
    await Promise.all(promises);
    expect(order).toEqual([1, 2, 3]);
  });

  it('should propagate resolved value', async () => {
    const result = await mutex.runExclusive(async () => 42);
    expect(result).toBe(42);
  });

  it('should propagate rejected error', async () => {
    await expect(mutex.runExclusive(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
  });

  it('should allow concurrent executions on different mutex instances', async () => {
    const mutex2 = new Mutex();
    const order: number[] = [];
    await Promise.all([
      mutex.runExclusive(async () => { await new Promise(r => setTimeout(r, 10)); order.push(1); }),
      mutex2.runExclusive(async () => { order.push(2); }),
    ]);
    expect(order).toEqual([2, 1]); // mutex2 finishes first
  });
});
```

- [ ] Step 2.2: Run test → confirm it fails (RED)
- [ ] Step 2.3: Implement `src/utils/mutex.ts`:
```typescript
export class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.locked = true;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.locked = false;
          this.next();
        }
      };

      if (!this.locked) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private next() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
  }
}
```

- [ ] Step 2.4: Run test → confirm it passes (GREEN)
- [ ] Step 2.5: Refactor if needed

---

### Task 3: TokenBucketStore (Core Logic)

**Files:**
- Create: `src/utils/token-bucket-store.ts`
- Create: `tests/token-bucket-store.test.ts`

**Interfaces:**
- Consumes: `Mutex` from Task 2, `RateLimitConfig` from Task 1
- Produces: `TokenBucketStore` class with `take(key: string): Promise<{ allowed: boolean; retryAfter?: number; remaining: number; reset: number }>`

**Steps:**
- [ ] Step 3.1: Write failing test `tests/token-bucket-store.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenBucketStore } from '../src/utils/token-bucket-store';
import { rateLimitConfig } from '../src/config/rate-limit';

describe('TokenBucketStore', () => {
  let store: TokenBucketStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new TokenBucketStore(rateLimitConfig);
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
    vi.advanceTimersByTime(60_000); // advance 1 minute
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
    expect(allowed).toBe(10); // exactly capacity allowed
  });

  it('should return correct reset timestamp', async () => {
    const result = await store.take('192.168.1.8');
    expect(result.reset).toBeGreaterThan(Date.now());
    expect(result.reset).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});
```

- [ ] Step 3.2: Run test → confirm it fails (RED)
- [ ] Step 3.3: Implement `src/utils/token-bucket-store.ts`:
```typescript
import { Mutex } from './mutex';
import { RateLimitConfig } from '../config/rate-limit';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketStore {
  private buckets = new Map<string, TokenBucket>();
  private mutexes = new Map<string, Mutex>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per ms
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 min
  private readonly bucketTtlMs = 10 * 60 * 1000; // 10 min

  constructor(config: RateLimitConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.startCleanup();
  }

  private getMutex(key: string): Mutex {
    let mutex = this.mutexes.get(key);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexes.set(key, mutex);
    }
    return mutex;
  }

  private refill(bucket: TokenBucket, now: number): void {
    const elapsed = now - bucket.lastRefill;
    const newTokens = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + newTokens);
    bucket.lastRefill = now;
  }

  async take(key: string): Promise<{ allowed: boolean; retryAfter?: number; remaining: number; reset: number }> {
    const mutex = this.getMutex(key);
    return mutex.runExclusive(async () => {
      const now = Date.now();
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = { tokens: this.capacity, lastRefill: now };
        this.buckets.set(key, bucket);
      }
      this.refill(bucket, now);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        const reset = bucket.lastRefill + Math.ceil((this.capacity - bucket.tokens) / this.refillRate);
        return {
          allowed: true,
          remaining: Math.floor(bucket.tokens),
          reset,
        };
      }

      // bucket empty - calculate retryAfter
      const tokensNeeded = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil(tokensNeeded / this.refillRate);
      const reset = bucket.lastRefill + Math.ceil((this.capacity - bucket.tokens) / this.refillRate);
      return {
        allowed: false,
        retryAfter: Math.ceil(retryAfterMs / 1000),
        remaining: 0,
        reset,
      };
    });
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > this.bucketTtlMs) {
          this.buckets.delete(key);
          this.mutexes.delete(key);
        }
      }
    }, this.cleanupIntervalMs);
    // Prevent interval from keeping process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
    this.mutexes.clear();
  }
}
```

- [ ] Step 3.4: Run test → confirm it passes (GREEN)
- [ ] Step 3.5: Refactor if needed

---

### Task 4: Rate Limiter Middleware (Fastify Integration)

**Files:**
- Create: `src/middleware/rate-limiter.ts`
- Create: `tests/rate-limiter.test.ts`

**Interfaces:**
- Consumes: `TokenBucketStore` from Task 3, `RateLimitConfig` from Task 1
- Produces: `rateLimiter` Fastify plugin/middleware

**Steps:**
- [ ] Step 4.1: Write failing test `tests/rate-limiter.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { rateLimiter } from '../src/middleware/rate-limiter';
import { TokenBucketStore } from '../src/utils/token-bucket-store';
import { rateLimitConfig } from '../src/config/rate-limit';

describe('Rate Limiter Middleware', () => {
  let app: ReturnType<typeof Fastify>;
  let store: TokenBucketStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    store = new TokenBucketStore(rateLimitConfig);
    app = Fastify();
    await app.register(rateLimiter, { store });
    app.get('/test', async () => ({ ok: true }));
    app.get('/health', async () => ({ status: 'ok' }));
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
    store.shutdown();
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
    // IP 1 makes 10 requests
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: 'GET', url: '/test', headers: { 'x-forwarded-for': '10.0.0.1' } });
    }
    // IP 2 should still have full quota
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
});
```

- [ ] Step 4.2: Run test → confirm it fails (RED)
- [ ] Step 4.3: Implement `src/middleware/rate-limiter.ts`:
```typescript
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { TokenBucketStore } from '../utils/token-bucket-store';
import { RateLimitConfig } from '../config/rate-limit';

interface RateLimiterOptions {
  store: TokenBucketStore;
  config?: Partial<RateLimitConfig>;
}

const defaultKeyGenerator = (req: FastifyRequest): string => {
  // Prefer x-forwarded-for (first IP) for proxied requests, fallback to socket remoteAddress
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    return ips;
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export const rateLimiter: FastifyPluginAsync<RateLimiterOptions> = async (app, options) => {
  const { store, config = {} } = options;
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;
  const skip = config.skip || (() => false);

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (skip(req)) return;

    const key = keyGenerator(req);
    const result = await store.take(key);

    // Always set rate limit headers
    reply.header('X-RateLimit-Limit', String(config.capacity || 10));
    reply.header('X-RateLimit-Remaining', String(result.remaining));
    reply.header('X-RateLimit-Reset', String(result.reset));

    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfter));
      reply.code(429);
      return { error: 'Too Many Requests', retryAfter: result.retryAfter };
    }
  });
};
```

- [ ] Step 4.4: Run test → confirm it passes (GREEN)
- [ ] Step 4.5: Refactor if needed

---

### Task 5: Fastify App Bootstrap

**Files:**
- Create: `src/app.ts`

**Interfaces:**
- Consumes: `rateLimiter` from Task 4, `TokenBucketStore` from Task 3, `rateLimitConfig` from Task 1
- Produces: Runnable Fastify server

**Steps:**
- [ ] Step 5.1: Create `src/app.ts`:
```typescript
import 'dotenv/config';
import Fastify from 'fastify';
import { rateLimiter } from './middleware/rate-limiter';
import { TokenBucketStore } from './utils/token-bucket-store';
import { rateLimitConfig } from './config/rate-limit';

const app = Fastify({ logger: true });

// Initialize store
const store = new TokenBucketStore(rateLimitConfig);

// Register rate limiter
await app.register(rateLimiter, { store, config: rateLimitConfig });

// Routes
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/ready', async () => ({ status: 'ready' }));
app.get('/api/test', async () => ({ message: 'Hello from rate-limited endpoint!' }));

// Graceful shutdown
const shutdown = async () => {
  app.log.info('Shutting down...');
  store.shutdown();
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
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

- [ ] Step 5.2: Run `npm run dev` → verify server starts
- [ ] Step 5.3: Manual test with `curl`:
```bash
curl -i http://localhost:3000/api/test
# Should return 200 with X-RateLimit-* headers

for i in {1..11}; do curl -i http://localhost:3000/api/test; done
# 11th should return 429 with Retry-After

curl -i http://localhost:3000/health
# Should return 200 WITHOUT rate limit headers
```

---

### Task 6: Run Full Test Suite & Verify

**Files:** (none new)

**Steps:**
- [ ] Step 6.1: Run `npm test` → all tests pass
- [ ] Step 6.2: Run `npm run build` → TypeScript compiles without errors
- [ ] Step 6.3: Run `npm start` → production build works
- [ ] Step 6.4: Verify coverage (optional): `npm test -- --coverage`

---

### Task 7: Documentation & Handoff

**Files:**
- Create: `README.md`

**Steps:**
- [ ] Step 7.1: Create `README.md` with:
  - Project description
  - Installation (`npm install`)
  - Configuration (`.env` variables)
  - Usage (how to register middleware)
  - API (headers, response codes)
  - Testing (`npm test`)
  - Architecture overview

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Token Bucket algorithm | Task 3 |
| 10 req/min per IP | Task 1 (config), Task 3 (capacity/refillRate) |
| HTTP 429 + Retry-After | Task 4 |
| Thread-safe (race condition) | Task 2 (Mutex), Task 3 (mutex.runExclusive) |
| Fastify middleware | Task 4 |
| Skip paths (/health, /ready) | Task 1 (config.skip), Task 4 |
| Headers: X-RateLimit-Limit, Remaining, Reset | Task 4 |
| Cleanup (memory leak prevention) | Task 3 (startCleanup) |
| Tests (TDD) | Tasks 2, 3, 4 |

---

## Next Actions

1. Execute Task 1 → scaffold project
2. Execute Task 2 → Mutex (TDD)
3. Execute Task 3 → TokenBucketStore (TDD)
4. Execute Task 4 → Middleware (TDD)
5. Execute Task 5 → App bootstrap
6. Execute Task 6 → Full verification
7. Execute Task 7 → README
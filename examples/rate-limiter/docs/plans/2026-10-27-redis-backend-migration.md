# Implementation Plan: Redis Backend Migration for Rate Limiter

**Goal:** Replace in-memory TokenBucketStore with Redis backend using ioredis + atomic Lua script, maintaining full backward compatibility with existing middleware and tests.

**Architecture:** Fastify middleware → RedisTokenBucketStore (factory-selected) → ioredis client + Lua script (EVALSHA) → Redis Server. Factory in `token-bucket-store.ts` chooses implementation based on `redisUrl` config. Same public interface `take()` preserved.

**Global Constraints:**
- Must maintain exact same `take()` interface: `{ allowed, retryAfter?, remaining, reset }`
- Lua script must be atomic (single EVALSHA call)
- No Mutex needed in Redis implementation (atomicity via Redis)
- TTL-based cleanup via Redis PEXPIRE (no background interval)
- Configuration via `.env`: `REDIS_URL`, `REDIS_KEY_PREFIX`
- All existing tests must pass with both implementations
- TypeScript strict mode, Vitest for testing

---

### Task 1: Add Redis Dependencies & Config

**Files:**
- Modify: `package.json`
- Modify: `src/config/rate-limit.ts`

**Interfaces:**
- Produces: Extended `RateLimitConfig` with Redis options

**Steps:**
- [ ] Step 1.1: Add `ioredis` to `package.json` dependencies
```json
"dependencies": {
  "fastify": "^4.28.1",
  "dotenv": "^16.4.5",
  "ioredis": "^5.4.1"
}
```

- [ ] Step 1.2: Run `npm install`
- [ ] Step 1.3: Extend `src/config/rate-limit.ts` with Redis options:
```typescript
import { FastifyRequest } from 'fastify';

export interface RateLimitConfig {
  capacity: number;
  refillRate: number;
  keyGenerator?: (req: FastifyRequest) => string;
  skip?: (req: FastifyRequest) => boolean;
  // NEW Redis options
  redisUrl?: string;
  redisKeyPrefix?: string;
  redisConnectionOptions?: Record<string, unknown>;
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
};
```

---

### Task 2: Create Lua Script File

**Files:**
- Create: `src/utils/lua/token_bucket_take.lua`

**Interfaces:**
- Produces: Lua script string loaded at startup

**Steps:**
- [ ] Step 2.1: Create `src/utils/lua/token_bucket_take.lua`:
```lua
-- KEYS[1] = bucket key (e.g., "ratelimit:myapp:192.168.1.1")
-- ARGV[1] = capacity (number)
-- ARGV[2] = refillRate (tokens per ms)
-- ARGV[3] = now (timestamp ms)
-- ARGV[4] = ttlMs (bucket TTL in ms)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttlMs = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  lastRefill = now
end

local elapsed = now - lastRefill
local newTokens = elapsed * refillRate
tokens = math.min(capacity, tokens + newTokens)
lastRefill = now

local allowed = false
local remaining = 0
local retryAfter = 0
local reset = 0

if tokens >= 1 then
  tokens = tokens - 1
  allowed = true
  remaining = math.floor(tokens)
  reset = lastRefill + math.ceil((capacity - tokens) / refillRate)
else
  allowed = false
  remaining = 0
  local tokensNeeded = 1 - tokens
  local retryAfterMs = math.ceil(tokensNeeded / refillRate)
  retryAfter = math.ceil(retryAfterMs / 1000)
  reset = lastRefill + math.ceil((capacity - tokens) / refillRate)
end

redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill, 'capacity', capacity, 'refillRate', refillRate)
redis.call('PEXPIRE', key, ttlMs)

return {allowed and 1 or 0, remaining, reset, retryAfter}
```

---

### Task 3: RedisTokenBucketStore Implementation (TDD)

**Files:**
- Create: `tests/redis-token-bucket-store.test.ts`
- Create: `src/utils/redis-token-bucket-store.ts`
- Create: `src/utils/lua/index.ts` (script loader)

**Interfaces:**
- Consumes: `RateLimitConfig` (with Redis options), Lua script
- Produces: `RedisTokenBucketStore` class with `take()`, `shutdown()`, `healthCheck()`

**Steps:**
- [ ] Step 3.1: Write failing test `tests/redis-token-bucket-store.test.ts` (requires Redis):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { RedisTokenBucketStore } from '../src/utils/redis-token-bucket-store';
import { rateLimitConfig } from '../src/config/rate-limit';

// Integration test - requires Redis running
// Skip if REDIS_URL not set
const REDIS_AVAILABLE = !!process.env.REDIS_URL;

(REDIS_AVAILABLE ? describe : describe.skip)('RedisTokenBucketStore (integration)', () => {
  let store: RedisTokenBucketStore;
  const testConfig = { ...rateLimitConfig, capacity: 10, refillRate: 10 / 60_000, redisKeyPrefix: 'test' };

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
```

- [ ] Step 3.2: Run test → confirm it fails (RED) - needs Redis
- [ ] Step 3.3: Create `src/utils/lua/index.ts` to load script:
```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LUA_SCRIPT = fs.readFileSync(path.join(__dirname, 'token_bucket_take.lua'), 'utf-8');
export const SCRIPT_SHA = ''; // Will be set after SCRIPT LOAD
```

- [ ] Step 3.4: Implement `src/utils/redis-token-bucket-store.ts`:
```typescript
import Redis from 'ioredis';
import { RateLimitConfig } from '../config/rate-limit';
import { LUA_SCRIPT } from './lua';

export interface TokenBucketResult {
  allowed: boolean;
  retryAfter?: number;
  remaining: number;
  reset: number;
}

export class RedisTokenBucketStore {
  private client: Redis;
  private scriptSha: string = '';
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly keyPrefix: string;
  private readonly ttlMs: number;
  private readonly scriptLoaded: Promise<void>;

  constructor(config: RateLimitConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.keyPrefix = config.redisKeyPrefix || 'ratelimit';
    this.ttlMs = 10 * 60 * 1000; // 10 min bucket TTL

    const redisUrl = config.redisUrl || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
      ...config.redisConnectionOptions,
    });

    this.client.on('error', (err) => {
      console.error('[RedisTokenBucketStore] Redis error:', err);
    });

    this.scriptLoaded = this.loadScript();
  }

  private async loadScript(): Promise<void> {
    await this.client.connect();
    this.scriptSha = await this.client.script('LOAD', LUA_SCRIPT);
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  async take(key: string): Promise<TokenBucketResult> {
    await this.scriptLoaded;
    const fullKey = this.getKey(key);
    const now = Date.now();

    const result = await this.client.evalsha(
      this.scriptSha,
      1,
      fullKey,
      this.capacity,
      this.refillRate,
      now,
      this.ttlMs
    ) as [number, number, number, number]; // [allowed, remaining, reset, retryAfter]

    const [allowed, remaining, reset, retryAfter] = result;
    return {
      allowed: allowed === 1,
      remaining,
      reset,
      retryAfter: retryAfter > 0 ? retryAfter : undefined,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.scriptLoaded;
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    await this.client.quit();
  }
}
```

- [ ] Step 3.5: Run test with Redis → confirm it passes (GREEN)
- [ ] Step 3.6: If Redis not available locally, use Testcontainers or mock for CI

---

### Task 4: Factory & Backward Compatibility

**Files:**
- Modify: `src/utils/token-bucket-store.ts` (convert to factory + keep Memory implementation)

**Interfaces:**
- Consumes: `RedisTokenBucketStore`, existing `TokenBucketStore` (Memory)
- Produces: `createTokenBucketStore(config)` factory function

**Steps:**
- [ ] Step 4.1: Rename current `TokenBucketStore` → `MemoryTokenBucketStore` (keep for tests/no-Redis)
- [ ] Step 4.2: Create common interface `TokenBucketStoreInterface`
- [ ] Step 4.3: Add factory function `createTokenBucketStore(config)`
- [ ] Step 4.4: Export both implementations + factory

```typescript
// src/utils/token-bucket-store.ts (refactored)
export interface TokenBucketStoreInterface {
  take(key: string): Promise<TokenBucketResult>;
  shutdown(): void | Promise<void>;
}

export { MemoryTokenBucketStore } from './memory-token-bucket-store';
export { RedisTokenBucketStore } from './redis-token-bucket-store';

export function createTokenBucketStore(config: RateLimitConfig): TokenBucketStoreInterface {
  if (config.redisUrl) {
    return new RedisTokenBucketStore(config);
  }
  return new MemoryTokenBucketStore(config);
}
```

---

### Task 5: Update Middleware & App to Use Factory

**Files:**
- Modify: `src/middleware/rate-limiter.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `createTokenBucketStore` factory
- Produces: Updated middleware registration

**Steps:**
- [ ] Step 5.1: Update `src/middleware/rate-limiter.ts` to import factory:
```typescript
import { createTokenBucketStore } from '../utils/token-bucket-store';
import { RateLimitConfig } from '../config/rate-limit';

// In createRateLimiter:
const store = createTokenBucketStore(config);
```

- [ ] Step 5.2: Update `src/app.ts` to pass full config (including Redis options)

---

### Task 6: Run All Tests (Both Implementations)

**Files:** (none new)

**Steps:**
- [ ] Step 6.1: Run existing tests with Memory store (default, no REDIS_URL) → all pass
- [ ] Step 6.2: Run tests with `REDIS_URL=redis://localhost:6379 npm test` → all pass
- [ ] Step 6.3: Verify middleware integration tests pass with both stores

---

### Task 7: Build & Verify

**Files:** (none new)

**Steps:**
- [ ] Step 7.1: Run `npm run build` → TypeScript compiles without errors
- [ ] Step 7.2: Run `npm test` (Memory) → 18 tests pass
- [ ] Step 7.3: Run `REDIS_URL=redis://localhost:6379 npm test` → 25 tests pass (18 + 7 Redis)
- [ ] Step 7.4: Manual test with `npm run dev` + `curl`

---

### Task 8: Documentation & Cleanup

**Files:**
- Modify: `README.md` (add Redis configuration section)
- Modify: `.env.example` (add Redis vars)

**Steps:**
- [ ] Step 8.1: Update `README.md` with Redis setup instructions
- [ ] Step 8.2: Add `.env.example` with all variables
- [ ] Step 8.3: Remove debug test files if any remain

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| ioredis dependency | Task 1 |
| Lua script atomic token bucket | Task 2, 3 |
| No Mutex needed (Redis atomicity) | Task 3 |
| TTL-based cleanup (PEXPIRE) | Task 2 (script), Task 3 |
| Config via REDIS_URL, REDIS_KEY_PREFIX | Task 1 |
| Same take() interface | Task 3, 4 |
| Factory for backward compatibility | Task 4 |
| All existing tests pass | Task 6 |
| New Redis integration tests | Task 3 |

---

## Next Actions

1. Execute Task 1 → Add ioredis + extend config
2. Execute Task 2 → Create Lua script file
3. Execute Task 3 → RedisTokenBucketStore (TDD)
4. Execute Task 4 → Factory + Memory store refactor
5. Execute Task 5 → Update middleware/app
6. Execute Task 6 → Run all tests (Memory + Redis)
7. Execute Task 7 → Build & verify
8. Execute Task 8 → Documentation
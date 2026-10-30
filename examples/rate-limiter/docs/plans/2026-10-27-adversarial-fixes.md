# Implementation Plan: Adversarial Review Fixes (All 9 Findings)

**Goal:** Fix all 9 findings from adversarial review: 2 CRITICAL, 3 HIGH, 3 MEDIUM, 1 LOW severity.

**Architecture:** Each fix targets a specific vulnerability/defect in the rate limiter system. Fixes are ordered by severity and dependency (critical infrastructure first, then security, then quality).

**Global Constraints:**
- All existing tests must continue passing (32 passing)
- TypeScript strict mode, Vitest TDD
- Backward compatibility with Memory + Redis backends
- No breaking changes to public API (`createRateLimiter`, `createMetricsCollector`)

---

## Task 1: H1 — Fix `npm start` (ESM imports without `.js` extension)

**Severity:** CRITICAL  
**Files:** Modify `tsconfig.json`, all `.ts` files with relative imports

**Steps:**
- [ ] Step 1.1: Update `tsconfig.json` with `"moduleResolution": "node"` and `"module": "NodeNext"`
- [ ] Step 1.2: Add `.js` extension to all relative imports in `.ts` files:
  ```typescript
  // Antes
  import { createRateLimiter } from './middleware/rate-limiter';
  import { rateLimitConfig } from './config/rate-limit';
  
  // Depois
  import { createRateLimiter } from './middleware/rate-limiter.js';
  import { rateLimitConfig } from './config/rate-limit.js';
  ```
- [ ] Step 1.3: Run `npm run build` → verify `dist/` has `.js` files with correct imports
- [ ] Step 1.4: Run `node dist/app.js` → verify server starts without `ERR_MODULE_NOT_FOUND`

---

## Task 2: H2 — Fix Redis Down on Boot (Unhandled Rejection)

**Severity:** CRITICAL  
**Files:** Modify `src/metrics/collector-redis.ts`, `src/utils/redis-token-bucket-store.ts`

**Steps:**
- [ ] Step 2.1: In `collector-redis.ts`, wrap `this.connected` promise with `.catch()`:
  ```typescript
  this.connected = this.client.connect()
    .then(() => true)
    .catch((err) => {
      console.error('[RedisMetricsCollector] Connection failed:', err.message);
      return false;
    });
  ```
- [ ] Step 2.2: In `collector-redis.ts`, `getSnapshot()` — if not connected, return empty snapshot immediately (already does, but ensure no throw)
- [ ] Step 2.3: In `redis-token-bucket-store.ts`, apply same pattern to `this.scriptLoaded`
- [ ] Step 2.4: Add `process.on('unhandledRejection', ...)` in `app.ts` as safety net
- [ ] Step 2.5: Test: stop Redis → `npm run dev` → verify server starts and logs error but doesn't crash

---

## Task 3: H3 — Fix X-Forwarded-For Bypass (IP Rotation)

**Severity:** ALTA  
**Files:** Modify `src/middleware/rate-limiter.ts`, `src/config/rate-limit.ts`

**Steps:**
- [ ] Step 3.1: Add config option `trustProxy` (default: `false`) and `proxyHeader` (default: `'x-forwarded-for'`)
- [ ] Step 3.2: Implement IP extraction with trust logic:
  ```typescript
  const extractIP = (req: FastifyRequest, config: RateLimitConfig): string => {
    if (!config.trustProxy) {
      return req.ip || req.socket.remoteAddress || 'unknown';
    }
    const header = config.proxyHeader || 'x-forwarded-for';
    const forwarded = req.headers[header];
    if (forwarded) {
      const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
      // Pega o PRIMEIRO IP (cliente original), não o último
      return ips[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  };
  ```
- [ ] Step 3.2: Add `trustProxy: false` default in `rateLimitConfig`
- [ ] Step 3.3: Write test: 30 requests with rotating `X-Forwarded-For` → expect 10 allowed, 20 blocked
- [ ] Step 3.4: Document: `TRUST_PROXY=true` só atrás de proxy confiável (nginx, cloudflare)

---

## Task 4: H4 — Fix Memory Leak (Unbounded Maps/Sets)

**Severity:** ALTA  
**Files:** Modify `src/metrics/collector-memory.ts`, `src/utils/memory-token-bucket-store.ts`

**Steps:**
- [ ] Step 4.1: In `collector-memory.ts`, add TTL cleanup for `ipRequests`, `ipBlocks`, `activeIps`:
  ```typescript
  private readonly entryTtlMs = 10 * 60 * 1000; // 10 min
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  constructor(config) {
    // ... existing
    this.startCleanup();
  }
  
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of this.ipRequestsTimestamps.entries()) {
        if (now - entry > this.entryTtlMs) {
          this.ipRequests.delete(ip);
          this.ipBlocks.delete(ip);
          this.activeIps.delete(ip);
          this.ipRequestsTimestamps.delete(ip);
        }
      }
    }, 5 * 60 * 1000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }
  ```
- [ ] Step 4.2: Track timestamp per IP entry (add `ipRequestsTimestamps = new Map<string, number>()`)
- [ ] Step 4.3: In `memory-token-bucket-store.ts`, verify existing cleanup works (already has `bucketTtlMs`)
- [ ] Step 4.4: Write test: inject 10,000 unique IPs → verify maps don't grow unbounded after TTL

---

## Task 5: H5 — Fix SCRIPT FLUSH / NOSCRIPT Handling

**Severity:** ALTA  
**Files:** Modify `src/utils/redis-token-bucket-store.ts`

**Steps:**
- [ ] Step 5.1: In `take()`, catch `NOSCRIPT` error and reload script:
  ```typescript
  async take(key: string): Promise<TokenBucketResult> {
    await this.scriptLoaded;
    try {
      return await this.executeScript(key);
    } catch (err) {
      if (err.message.includes('NOSCRIPT')) {
        console.warn('[RedisTokenBucketStore] NOSCRIPT detected, reloading script');
        this.scriptLoaded = this.loadScript(); // recarrega
        return this.executeScript(key); // retry once
      }
      throw err;
    }
  }
  
  private async executeScript(key: string): Promise<TokenBucketResult> {
    const fullKey = this.getKey(key);
    const now = Date.now();
    const result = await this.client.evalsha(
      this.scriptSha, 1, fullKey, this.capacity, this.refillRate, now, this.ttlMs
    ) as [number, number, number, number];
    // ... parse result
  }
  ```
- [ ] Step 5.2: Add `maxRetries` config (default: 1) for script reload
- [ ] Step 5.3: Write test: mock `evalsha` to throw NOSCRIPT first time → verify retry works

---

## Task 6: H6 — Fix .env Skip Paths Override

**Severity:** MÉDIA  
**Files:** Modify `src/config/rate-limit.ts`

**Steps:**
- [ ] Step 6.1: Change skip logic to merge defaults with env:
  ```typescript
  const defaultSkipPaths = ['/health', '/ready', '/api/metrics', '/dashboard'];
  const envSkipPaths = (process.env.RATE_LIMIT_SKIP_PATHS || '').split(',').filter(Boolean);
  const skipPaths = [...new Set([...defaultSkipPaths, ...envSkipPaths])];
  
  skip: (req) => skipPaths.includes(req.url),
  ```
- [ ] Step 6.2: Update `.env.example` to show additive behavior
- [ ] Step 6.3: Write test: set `RATE_LIMIT_SKIP_PATHS=/custom` → verify `/health`, `/ready`, `/api/metrics`, `/dashboard` still skipped

---

## Task 7: H7 — Reduce Redis Commands per Request (~14 → ~6)

**Severity:** MÉDIA  
**Files:** Modify `src/metrics/collector-redis.ts`

**Steps:**
- [ ] Step 7.1: Batch metrics commands into single pipeline (already done, but optimize):
  - Combine `INCR` + `ZINCRBY` + `SADD` + `ZADD` + `PEXPIRE` into 1 pipeline
  - Current: 1 pipeline with ~14 commands → optimize to ~6
- [ ] Step 7.2: Use `MGET` for counter reads instead of individual `GET`
- [ ] Step 7.3: Use `ZRANGE` with `LIMIT` for top IPs instead of full `ZREVRANGE`
- [ ] Step 7.4: Add config `metricsBatchEnabled: true` to toggle
- [ ] Step 7.5: Benchmark: `npm test` + manual `wrk` to verify latency improvement

---

## Task 8: H8 — Add Auth to /api/metrics and /dashboard

**Severity:** MÉDIA  
**Files:** Modify `src/app.ts`, `src/config/rate-limit.ts`

**Steps:**
- [ ] Step 8.1: Add config `metricsAuthToken` (optional string) and `dashboardAuthToken`
- [ ] Step 8.2: Add auth middleware factory:
  ```typescript
  const createAuthMiddleware = (token?: string) => {
    if (!token) return () => true; // no auth required
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const auth = req.headers.authorization?.replace('Bearer ', '');
      if (auth !== token) {
        reply.code(401).send({ error: 'Unauthorized' });
        return false;
      }
      return true;
    };
  };
  ```
- [ ] Step 8.3: Apply to `/api/metrics` and `/dashboard` routes
- [ ] Step 8.4: Update `.env.example` with `METRICS_AUTH_TOKEN=` and `DASHBOARD_AUTH_TOKEN=`
- [ ] Step 8.5: Write test: request without token → 401; with token → 200

---

## Task 9: H9 — Fix Skip Path Matching (Exact URL vs Prefix)

**Severity:** BAIXA  
**Files:** Modify `src/config/rate-limit.ts`

**Steps:**
- [ ] Step 9.1: Change skip to use prefix match or `URL` parsing:
  ```typescript
  skip: (req) => {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    return skipPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  },
  ```
- [ ] Step 9.2: Write test: `/health?x=1` → should skip; `/healthz` → should not skip

---

## Task 10: Run All Tests & Verify Fixes

**Files:** (none new)

**Steps:**
- [ ] Step 10.1: Run `npm test` → all 32 tests pass
- [ ] Step 10.2: Run `npm run build` → no TypeScript errors
- [ ] Step 10.3: Run `node dist/app.js` → server starts (H1 fixed)
- [ ] Step 10.4: Test H2: stop Redis → `npm run dev` → server stays up
- [ ] Step 10.5: Test H3: 30 reqs with rotating X-Forwarded-For → 10 allowed, 20 blocked
- [ ] Step 10.6: Test H4: inject 10k unique IPs → memory stable after TTL
- [ ] Step 10.7: Test H5: mock NOSCRIPT → verify retry works
- [ ] Step 10.8: Test H6: custom skip paths → defaults still work
- [ ] Step 10.9: Test H7: benchmark Redis commands (manual)
- [ ] Step 10.10: Test H8: auth token required → 401 without, 200 with
- [ ] Step 10.10: Test H9: `/health?x=1` skipped, `/healthz` not skipped

---

## Spec Coverage Check

| Finding | Task |
|---|---|
| H1: npm start broken | Task 1 |
| H2: Redis down crashes | Task 2 |
| H3: X-Forwarded-For bypass | Task 3 |
| H4: Memory leak | Task 4 |
| H5: SCRIPT FLUSH / NOSCRIPT | Task 5 |
| H6: .env skip override | Task 6 |
| H7: Redis command cost | Task 7 |
| H8: No auth on metrics/dashboard | Task 8 |
| H9: Skip exact match | Task 9 |

---

## Next Actions

1. Execute Task 1 → Fix ESM imports
2. Execute Task 2 → Redis boot resilience
3. Execute Task 3 → X-Forwarded-For trust
4. Execute Task 4 → Memory TTL cleanup
5. Execute Task 5 → NOSCRIPT handling
6. Execute Task 6 → Skip paths merge
7. Execute Task 7 → Redis command optimization
8. Execute Task 8 → Auth middleware
9. Execute Task 9 → Skip path matching
10. Execute Task 10 → Full verification
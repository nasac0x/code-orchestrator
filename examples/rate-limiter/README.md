# Rate Limiter Token Bucket Middleware

A resilient, thread-safe **Token Bucket** rate limiter middleware for **Fastify** (TypeScript) with dual backend support: **In-Memory** (default) and **Redis** (multi-instance).

## Features

- ✅ **Token Bucket Algorithm** - Smooth rate limiting with burst allowance
- ✅ **10 requests/minute per IP** (configurable)
- ✅ **HTTP 429 + `Retry-After` header** when limit exceeded
- ✅ **Dual Backend**: In-Memory (single instance) or Redis (multi-instance, horizontal scaling)
- ✅ **Atomic Redis Operations** - Lua script executed via `EVALSHA` (no race conditions, no Mutex needed)
- ✅ **TTL-based Cleanup** - Redis `PEXPIRE` auto-expires idle buckets (no background jobs)
- ✅ **Skip paths** (e.g., `/health`, `/ready`, `/api/metrics`, `/dashboard`)
- ✅ **Standard rate limit headers** (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- ✅ **Real-time Monitoring Dashboard** - `/dashboard` with live metrics from `/api/metrics`
- ✅ **Full test coverage** (18 memory + 7 Redis integration + 5 metrics + 2 dashboard tests) with Vitest
- ✅ **TypeScript** with strict mode

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file (or set environment variables):

```env
# Rate Limit Settings
RATE_LIMIT_CAPACITY=10          # Max requests per window
RATE_LIMIT_WINDOW_MS=60000      # Window size in milliseconds (60s = 1 min)
RATE_LIMIT_SKIP_PATHS=/health,/ready,/api/metrics,/dashboard  # Comma-separated paths to skip

# Redis Backend (Optional - enables multi-instance mode)
REDIS_URL=redis://localhost:6379        # Redis connection string
REDIS_KEY_PREFIX=myapp                  # Key prefix (default: "ratelimit")
# REDIS_MAX_RETRIES=3                   # Optional ioredis options
# REDIS_RETRY_DELAY=100

# Metrics & Dashboard
METRICS_ENABLED=true
METRICS_TTL_HOURS=24
METRICS_TOP_IPS_LIMIT=10
METRICS_LATENCY_SAMPLES=1000
```

**Backend Selection:**
- **No `REDIS_URL`** → In-Memory backend (default, uses per-IP Mutex)
- **`REDIS_URL` set** → Redis backend (atomic Lua script, multi-instance ready)

## Usage

### As a Fastify Hook (Recommended)

```typescript
import Fastify from 'fastify';
import { createRateLimiter } from './middleware/rate-limiter';
import { rateLimitConfig } from './config/rate-limit';

const app = Fastify();

// Store created automatically via factory based on config
const rateLimiterHook = createRateLimiter({ config: rateLimitConfig });
app.addHook('onRequest', rateLimiterHook);

app.get('/api/protected', async () => ({ data: 'sensitive' }));
```

### As a Fastify Plugin

```typescript
import { rateLimiter } from './middleware/rate-limiter';
import { rateLimitConfig } from './config/rate-limit';

await app.register(rateLimiter, { config: rateLimitConfig });
```

### Advanced: Custom Store

```typescript
import { createRateLimiter } from './middleware/rate-limiter';
import { MemoryTokenBucketStore, RedisTokenBucketStore } from './utils/token-bucket-store';
import { rateLimitConfig } from './config/rate-limit';

// Use specific implementation
const store = new RedisTokenBucketStore(rateLimitConfig); // or MemoryTokenBucketStore
const hook = createRateLimiter({ store, config: rateLimitConfig });
```

## Monitoring Dashboard

Access the real-time dashboard at **http://localhost:3000/dashboard**

### Metrics API (`/api/metrics`)

Returns live telemetry in JSON format:

```json
{
  "timestamp": 1699999999999,
  "requests": {
    "total": 150,
    "allowed": 142,
    "blocked": 8,
    "blockRate": 0.053
  },
  "latency": {
    "p50": 2,
    "p95": 5,
    "p99": 12,
    "avg": 3.4
  },
  "topIPs": {
    "byRequests": [{"ip": "192.168.1.1", "count": 45}, ...],
    "byBlocks": [{"ip": "10.0.0.5", "count": 3}, ...]
  },
  "activeBuckets": 23,
  "redis": {
    "connected": true,
    "keyPrefix": "ratelimit:myapp"
  }
}
```

### Dashboard Features

- **Live cards**: Total requests, allowed, blocked, block rate, active buckets, avg latency
- **Latency chart**: p50, p95, p99, average (bar chart via Chart.js)
- **Top IPs tables**: Top 10 by requests, Top 10 by blocks
- **Auto-refresh**: Polls `/api/metrics` every 2 seconds
- **Redis status indicator**: Shows connected/disconnected state

### Configuration

```env
METRICS_ENABLED=true              # Enable/disable metrics collection
METRICS_TTL_HOURS=24              # Redis key TTL for metrics
METRICS_TOP_IPS_LIMIT=10          # Number of top IPs to track
METRICS_LATENCY_SAMPLES=1000      # Max latency samples to keep
```

## API

### Response Headers (Success)

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed (default: 10) |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp (ms) when bucket refills |

### Response (429 Too Many Requests)

```json
{
  "error": "Too Many Requests",
  "retryAfter": 45
}
```

**Headers:**
- `Retry-After: 45` (seconds until next token available)
- `X-RateLimit-Limit: 10`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: <unix-ms>`

## Development

```bash
# Start dev server with hot reload
npm run dev

# Run tests (Memory backend)
npm test

# Run tests with Redis (requires REDIS_URL)
REDIS_URL=redis://localhost:6379 npm test

# Run tests with coverage
npm test -- --coverage

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app.ts                           # Fastify bootstrap
├── config/
│   └── rate-limit.ts                # Configuration & types (with Redis options)
├── metrics/
│   ├── types.ts                     # MetricsSnapshot, MetricsCollector interface
│   ├── collector.ts                 # Factory + no-op collector
│   ├── collector-memory.ts          # In-Memory metrics implementation
│   └── collector-redis.ts           # Redis metrics implementation
├── middleware/
│   └── rate-limiter.ts              # createRateLimiter() hook factory
└── utils/
    ├── mutex.ts                     # Per-IP Mutex (Memory backend only)
    ├── memory-token-bucket-store.ts # In-Memory Token Bucket implementation
    ├── redis-token-bucket-store.ts  # Redis Token Bucket implementation (Lua script)
    ├── token-bucket-store.ts        # Factory + common interface
    └── lua/
        ├── token_bucket_take.lua    # Atomic Lua script (Redis backend)
        └── index.ts                 # Script loader

tests/
├── mutex.test.ts
├── token-bucket-store.test.ts       # Memory backend tests
├── redis-token-bucket-store.test.ts # Redis integration tests (skipped without REDIS_URL)
├── rate-limiter.test.ts
├── metrics-collector-memory.test.ts # Memory metrics tests
├── metrics-collector-redis.test.ts  # Redis metrics tests (skipped without REDIS_URL)
├── metrics-endpoint.test.ts         # /api/metrics endpoint tests
└── dashboard.test.ts                # Dashboard HTML serving tests
```

## Architecture

### In-Memory Backend (Default)

```
Request → extract IP → Mutex.lock(IP) → refill tokens → consume token
                                              │
                                    ┌─────────┴─────────┐
                                    ▼                   ▼
                              Token available      Bucket empty
                                    │                   │
                                    ▼                   ▼
                              next() (200 OK)    429 + Retry-After
                                    │                   │
                                    └─────────┬─────────┘
                                              ▼
                                    Mutex.unlock(IP)
```

**Thread Safety:**
- Per-IP `Mutex` serializes `take()` calls for the same IP
- Different IPs proceed in parallel (no global lock)
- Cleanup interval (5 min) removes buckets inactive > 10 min

### Redis Backend (Multi-Instance)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Fastify App    │────▶│ RedisTokenBucket │────▶│   Redis     │
│  (Instance 1)   │     │ Store            │     │   Server    │
└─────────────────┘     │ - ioredis client │     │             │
         │              │ - Lua script     │     │ Keys:       │
         │              │   (EVALSHA)      │     │ ratelimit:  │
┌─────────────────┐     │ - No Mutex       │     │ {prefix}:   │
│  Fastify App    │────▶│                  │     │ {ip}        │
│  (Instance 2)   │     └──────────────────┘     │ Hash:       │
└─────────────────┘              │               │ {tokens,    │
                                 │               │  lastRefill,│
                                 ▼               │  capacity,  │
                          Lua Script            │  refillRate}│
                          (atomic)              │ TTL: 10 min │
                                              └─────────────┘
```

**Redis Implementation Details:**
- **Lua Script** (`token_bucket_take.lua`): Entire Token Bucket logic in single atomic `EVALSHA` call
- **Key Format**: `ratelimit:{prefix}:{ip}` → Hash with `tokens`, `lastRefill`, `capacity`, `refillRate`
- **TTL**: `PEXPIRE` 10 min (auto-cleanup, no background job needed)
- **Script Loading**: `SCRIPT LOAD` at startup, `EVALSHA` for execution (cached by Redis)
- **Zero Mutex**: Atomicity guaranteed by Redis single-threaded execution

### Metrics Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Fastify App                              │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Rate Limiter │──▶│ Metrics Collector│  │ Static Server    │  │
│  │ (hook)       │   │ (wraps take())  │  │ (@fastify/static)│  │
│  └──────────────┘   └────────┬────────┘   └────────┬─────────┘  │
│                             │                      │            │
│                             ▼                      ▼            │
│                    ┌─────────────────┐    ┌──────────────┐    │
│                    │ Redis Keys      │    │ public/      │    │
│                    │ metrics:*       │    │ dashboard.html│    │
│                    │ ratelimit:*     │    │ (JS vanilla) │    │
│                    └─────────────────┘    └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Browser         │
                    │ GET /dashboard  │
                    │ fetch /api/metrics│
                    │ (poll 2s)       │
                    └─────────────────┘
```

**Redis Metrics Keys:**

| Key | Tipo | TTL | Descrição |
|---|---|---|---|
| `metrics:requests:total` | STRING (INCR) | 24h | Total de requests processados |
| `metrics:requests:allowed` | STRING (INCR) | 24h | Requests permitidos (200) |
| `metrics:requests:blocked` | STRING (INCR) | 24h | Requests bloqueados (429) |
| `metrics:latency:all` | SORTED SET | 1h | Latências (score = timestamp, member = `latency_ms`) |
| `metrics:ips:requests` | SORTED SET | 1h | Top IPs por requests (score = count, member = IP) |
| `metrics:ips:blocked` | SORTED SET | 1h | Top IPs por blocks (score = count, member = IP) |
| `metrics:buckets:active` | SET | 10min | IPs com buckets ativos (tokens > 0) |
| `metrics:redis:status` | STRING | - | `"connected"` / `"disconnected"` |

## Testing

```bash
# Memory backend tests (default)
npm test

# Redis backend integration tests (requires Redis)
REDIS_URL=redis://localhost:6379 npm test

# All tests with coverage
npm test -- --coverage
```

**Test Coverage:**
- **Memory Backend (18 tests)**: Mutex, TokenBucketStore, Middleware
- **Redis Backend (7 tests, integration)**: Same scenarios + health check, atomicity under concurrency
- **Metrics (12 tests)**: Memory collector, Redis collector (skipped), /api/metrics endpoint
- **Dashboard (2 tests)**: HTML serving, static assets
- **Skipped gracefully** when `REDIS_URL` not set

## Redis Setup

```bash
# Docker (quick start)
docker run -d -p 6379:6379 redis:7-alpine

# Or use managed Redis (Redis Cloud, AWS ElastiCache, Azure Cache, etc.)
# Then set REDIS_URL in .env
```

## License

MIT
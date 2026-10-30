import { FastifyRequest } from 'fastify';

export interface RateLimitConfig {
  capacity: number;
  refillRate: number;
  keyGenerator?: (req: FastifyRequest) => string;
  skip?: (req: FastifyRequest) => boolean;
  redisUrl?: string;
  redisKeyPrefix?: string;
  redisConnectionOptions?: Record<string, unknown>;
  metricsEnabled?: boolean;
  metricsTtlHours?: number;
  metricsTopIpsLimit?: number;
  metricsLatencySamples?: number;
  // Redis resilience options
  failOpen?: boolean;
  commandTimeoutMs?: number;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number;
  lazyConnect?: boolean;
  // Auth options for metrics and dashboard
  metricsAuthToken?: string;
  dashboardAuthToken?: string;
}

export const rateLimitConfig: RateLimitConfig = {
  capacity: Number(process.env.RATE_LIMIT_CAPACITY) || 10,
  refillRate: (Number(process.env.RATE_LIMIT_CAPACITY) || 10) / (Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000),
  skip: (req) => {
    const skipPaths = (process.env.RATE_LIMIT_SKIP_PATHS || '/health,/ready,/api/metrics,/dashboard').split(',');
    // Use pathname for prefix matching (ignores query params)
    // Exact match OR prefix match with trailing slash boundary
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    return skipPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
  },
  redisUrl: process.env.REDIS_URL,
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'ratelimit',
  redisConnectionOptions: {},
  metricsEnabled: process.env.METRICS_ENABLED !== 'false',
  metricsTtlHours: Number(process.env.METRICS_TTL_HOURS) || 24,
  metricsTopIpsLimit: Number(process.env.METRICS_TOP_IPS_LIMIT) || 10,
  metricsLatencySamples: Number(process.env.METRICS_LATENCY_SAMPLES) || 1000,
  // Redis resilience
  failOpen: process.env.FAIL_OPEN === 'true',
  commandTimeoutMs: Number(process.env.COMMAND_TIMEOUT_MS) || 200,
  maxRetriesPerRequest: Number(process.env.MAX_RETRIES_PER_REQUEST) || 1,
  retryStrategy: undefined, // uses default in collector
  lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
  // Auth tokens
  metricsAuthToken: process.env.METRICS_AUTH_TOKEN,
  dashboardAuthToken: process.env.DASHBOARD_AUTH_TOKEN,
};
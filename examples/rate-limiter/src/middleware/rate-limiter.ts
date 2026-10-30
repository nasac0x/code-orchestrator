import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createTokenBucketStore, TokenBucketStoreInterface } from '../utils/token-bucket-store.js';
import { createMetricsCollector, MetricsCollector } from '../metrics/index.js';
import { RateLimitConfig } from '../config/rate-limit.js';

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
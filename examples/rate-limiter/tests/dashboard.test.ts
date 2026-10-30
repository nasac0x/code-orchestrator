import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import { createMetricsCollector } from '../src/metrics';
import { rateLimitConfig } from '../src/config/rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Dashboard HTML', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.useFakeTimers();
    app = Fastify();
    
    // Create shared metrics collector
    const metrics = createMetricsCollector(rateLimitConfig);
    
    // Create rate limiter with the SAME metrics instance
    const rateLimiterHook = createRateLimiter({ config: rateLimitConfig, metrics });
    app.addHook('onRequest', rateLimiterHook);
    
    // Add metrics endpoint
    app.get('/api/metrics', async () => {
      return metrics.getSnapshot();
    });
    
    // Read dashboard HTML
    const publicDir = path.join(__dirname, '..', 'public');
    const dashboardHtml = fs.readFileSync(path.join(publicDir, 'dashboard.html'), 'utf-8');
    
    // Dashboard route - serve HTML directly with correct content-type
    app.get('/dashboard', async (req, reply) => {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return dashboardHtml;
    });
    
    // Register static files for dashboard assets
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: '/dashboard/',
      decorateReply: false,
    });
    
    app.get('/test', async () => ({ ok: true }));
    app.get('/health', async () => ({ status: 'ok' }));
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
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
    const res = await app.inject({ method: 'GET', url: '/dashboard/dashboard.html' });
    expect(res.statusCode).toBe(200);
  });
});
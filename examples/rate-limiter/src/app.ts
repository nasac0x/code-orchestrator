import 'dotenv/config';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { createMetricsCollector } from './metrics/index.js';
import { rateLimitConfig } from './config/rate-limit.js';
import { createAuthMiddleware } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

// Create shared metrics collector
const metrics = createMetricsCollector(rateLimitConfig);

// Create auth middleware
const { metricsAuth, dashboardAuth } = createAuthMiddleware({
  metricsAuthToken: rateLimitConfig.metricsAuthToken,
  dashboardAuthToken: rateLimitConfig.dashboardAuthToken,
});

// Register rate limiter hook
const rateLimiterHook = createRateLimiter({ config: rateLimitConfig, metrics });
app.addHook('onRequest', rateLimiterHook);

// Register static files for dashboard
await app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/dashboard/',
  decorateReply: true,
});

// Routes
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/ready', async () => ({ status: 'ready' }));
app.get('/api/test', async () => ({ message: 'Hello from rate-limited endpoint!' }));

// Metrics endpoint with auth
app.get('/api/metrics', { preHandler: metricsAuth }, async () => {
  const snapshot = await metrics.getSnapshot();
  return snapshot;
});

// Dashboard HTML with auth
app.get('/dashboard', { preHandler: dashboardAuth }, async (req, reply) => {
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
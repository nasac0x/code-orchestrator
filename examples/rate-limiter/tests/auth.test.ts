import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createAuthMiddleware } from '../src/middleware/auth.js';

describe('Auth Middleware', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows access when no token is configured (backward compatible)', async () => {
    const { metricsAuth } = createAuthMiddleware({});
    app.get('/api/metrics', { preHandler: metricsAuth }, async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(200);
  });

  it('allows access when correct token is provided', async () => {
    const { metricsAuth } = createAuthMiddleware({ metricsAuthToken: 'secret123' });
    app.get('/api/metrics', { preHandler: metricsAuth }, async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics',
      headers: { authorization: 'Bearer secret123' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects request with missing Authorization header', async () => {
    const { metricsAuth } = createAuthMiddleware({ metricsAuthToken: 'secret123' });
    app.get('/api/metrics', { preHandler: metricsAuth }, async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized', message: 'Invalid or missing Bearer token' });
  });

  it('rejects request with wrong token', async () => {
    const { metricsAuth } = createAuthMiddleware({ metricsAuthToken: 'secret123' });
    app.get('/api/metrics', { preHandler: metricsAuth }, async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics',
      headers: { authorization: 'Bearer wrongtoken' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized', message: 'Invalid or missing Bearer token' });
  });

  it('rejects request with invalid Authorization scheme', async () => {
    const { metricsAuth } = createAuthMiddleware({ metricsAuthToken: 'secret123' });
    app.get('/api/metrics', { preHandler: metricsAuth }, async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics',
      headers: { authorization: 'Basic secret123' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('applies dashboard auth correctly', async () => {
    const { dashboardAuth } = createAuthMiddleware({ dashboardAuthToken: 'dashsecret' });
    app.get('/dashboard', { preHandler: dashboardAuth }, async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer dashsecret' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects dashboard with wrong token', async () => {
    const { dashboardAuth } = createAuthMiddleware({ dashboardAuthToken: 'dashsecret' });
    app.get('/dashboard', { preHandler: dashboardAuth }, async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows different tokens for metrics and dashboard', async () => {
    const { metricsAuth, dashboardAuth } = createAuthMiddleware({
      metricsAuthToken: 'metrics-token',
      dashboardAuthToken: 'dashboard-token',
    });
    app.get('/api/metrics', { preHandler: metricsAuth }, async () => ({ ok: true }));
    app.get('/dashboard', { preHandler: dashboardAuth }, async () => ({ ok: true }));
    await app.ready();

    // Metrics with metrics token works
    const metricsRes = await app.inject({
      method: 'GET',
      url: '/api/metrics',
      headers: { authorization: 'Bearer metrics-token' },
    });
    expect(metricsRes.statusCode).toBe(200);

    // Dashboard with dashboard token works
    const dashRes = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer dashboard-token' },
    });
    expect(dashRes.statusCode).toBe(200);

    // Cross-token fails
    const crossRes = await app.inject({
      method: 'GET',
      url: '/api/metrics',
      headers: { authorization: 'Bearer dashboard-token' },
    });
    expect(crossRes.statusCode).toBe(401);
  });
});
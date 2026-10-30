import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthConfig {
  metricsAuthToken?: string;
  dashboardAuthToken?: string;
}

/**
 * Creates an authentication middleware that validates Bearer tokens.
 * If no token is configured, access is allowed (backward compatible).
 */
export function createAuthMiddleware(config: AuthConfig) {
  const { metricsAuthToken, dashboardAuthToken } = config;

  // Extract token from Authorization header
  const extractToken = (req: FastifyRequest): string | null => {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const [scheme, token] = auth.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token;
  };

  // Check if token matches expected
  const validateToken = (token: string | null, expected: string | undefined): boolean => {
    if (!expected) return true; // No token configured = allow (backward compatible)
    return token === expected;
  };

  return {
    // Middleware for /api/metrics
    metricsAuth: async (req: FastifyRequest, reply: FastifyReply) => {
      const token = extractToken(req);
      if (!validateToken(token, metricsAuthToken)) {
        reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing Bearer token' });
        return false;
      }
      return true;
    },

    // Middleware for /dashboard
    dashboardAuth: async (req: FastifyRequest, reply: FastifyReply) => {
      const token = extractToken(req);
      if (!validateToken(token, dashboardAuthToken)) {
        reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing Bearer token' });
        return false;
      }
      return true;
    },
  };
}
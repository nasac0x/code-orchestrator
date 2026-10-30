import Redis from 'ioredis';
import { RateLimitConfig } from '../config/rate-limit.js';
import { LUA_SCRIPT } from './lua/index.js';

export interface TokenBucketResult {
  allowed: boolean;
  retryAfter?: number;
  remaining: number;
  reset: number;
}

export interface RedisTokenBucketStoreConfig {
  redisUrl?: string;
  redisKeyPrefix?: string;
  capacity: number;
  refillRate: number;
  failOpen?: boolean;
  commandTimeoutMs?: number;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number;
  lazyConnect?: boolean;
}

export class RedisTokenBucketStore {
  private readonly client: Redis;
  private readonly commandName = 'ratelimit_take';
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly keyPrefix: string;
  private readonly ttlMs: number;
  private readonly failOpen: boolean;
  private readonly commandTimeoutMs: number;

  constructor(config: RedisTokenBucketStoreConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.keyPrefix = config.redisKeyPrefix || 'ratelimit';
    this.failOpen = config.failOpen ?? false;
    this.commandTimeoutMs = config.commandTimeoutMs ?? 200;

    // TTL derivado da config: ceil(capacity / refillRate) * 2
    const windowMs = Math.ceil(this.capacity / this.refillRate);
    this.ttlMs = windowMs * 2;

    const redisUrl = config.redisUrl || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 1,
      retryStrategy: config.retryStrategy ?? ((times: number) => Math.min(times * 50, 200)),
      lazyConnect: config.lazyConnect ?? true,
      commandTimeout: this.commandTimeoutMs,
      connectTimeout: 5000,
    });

    this.client.on('error', (err: Error) => {
      console.error('[RedisTokenBucketStore] Redis error:', err.message);
    });

    // Registra o script como comando customizado - ioredis trata NOSCRIPT automaticamente
    this.client.defineCommand(this.commandName, {
      numberOfKeys: 1,
      lua: LUA_SCRIPT,
    });

    // Conecta sem derrubar o processo se falhar
    this.client.connect().catch((err: Error) => {
      console.error('[RedisTokenBucketStore] Initial connection failed:', err.message);
    });
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  async take(key: string): Promise<TokenBucketResult> {
    const fullKey = this.getKey(key);
    const now = Date.now();

    try {
      // Usa o comando customizado - ioredis trata NOSCRIPT re-carregando o script automaticamente
      const result = await (this.client as any)[this.commandName](
        this.getKey(key),
        this.capacity,
        this.refillRate,
        now,
        this.ttlMs
      ) as [number, number, number, number];

      const [allowed, remaining, reset, retryAfter] = result;
      return {
        allowed: allowed === 1,
        remaining,
        reset,
        retryAfter: retryAfter > 0 ? retryAfter : undefined,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[RedisTokenBucketStore] take() failed:', error.message);

      if (this.failOpen) {
        // Fail-open: permite a requisição
        return {
          allowed: true,
          remaining: this.capacity,
          reset: Date.now() + this.ttlMs,
          retryAfter: undefined,
        };
      }

      // Fail-closed: bloqueia a requisição
      return {
        allowed: false,
        remaining: 0,
        reset: Date.now() + this.ttlMs,
        retryAfter: Math.ceil(this.ttlMs / 1000),
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
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
import { RateLimitConfig } from '../config/rate-limit.js';
import { MemoryTokenBucketStore } from './memory-token-bucket-store.js';
import { RedisTokenBucketStore } from './redis-token-bucket-store.js';

export interface TokenBucketResult {
  allowed: boolean;
  retryAfter?: number;
  remaining: number;
  reset: number;
}

export interface TokenBucketStoreInterface {
  take(key: string): Promise<TokenBucketResult>;
  shutdown(): void | Promise<void>;
}

export { MemoryTokenBucketStore } from './memory-token-bucket-store.js';
export { RedisTokenBucketStore } from './redis-token-bucket-store.js';

export function createTokenBucketStore(config: RateLimitConfig): TokenBucketStoreInterface {
  if (config.redisUrl) {
    return new RedisTokenBucketStore(config);
  }
  return new MemoryTokenBucketStore(config);
}
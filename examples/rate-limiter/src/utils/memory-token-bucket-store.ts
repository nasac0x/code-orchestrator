import { Mutex } from './mutex.js';
import { RateLimitConfig } from '../config/rate-limit.js';

export interface TokenBucketResult {
  allowed: boolean;
  retryAfter?: number;
  remaining: number;
  reset: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class MemoryTokenBucketStore {
  private buckets = new Map<string, TokenBucket>();
  private mutexes = new Map<string, Mutex>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly cleanupIntervalMs = 5 * 60 * 1000;
  private readonly bucketTtlMs = 10 * 60 * 1000;

  constructor(config: RateLimitConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.startCleanup();
  }

  private getMutex(key: string): Mutex {
    let mutex = this.mutexes.get(key);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexes.set(key, mutex);
    }
    return mutex;
  }

  private refill(bucket: TokenBucket, now: number): void {
    const elapsed = now - bucket.lastRefill;
    const newTokens = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + newTokens);
    bucket.lastRefill = now;
  }

  async take(key: string): Promise<TokenBucketResult> {
    const mutex = this.getMutex(key);
    return mutex.runExclusive(async () => {
      const now = Date.now();
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = { tokens: this.capacity, lastRefill: now };
        this.buckets.set(key, bucket);
      }
      this.refill(bucket, now);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        const reset = bucket.lastRefill + Math.ceil((this.capacity - bucket.tokens) / this.refillRate);
        return {
          allowed: true,
          remaining: Math.floor(bucket.tokens),
          reset,
        };
      }

      const tokensNeeded = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil(tokensNeeded / this.refillRate);
      const reset = bucket.lastRefill + Math.ceil((this.capacity - bucket.tokens) / this.refillRate);
      return {
        allowed: false,
        retryAfter: Math.ceil(retryAfterMs / 1000),
        remaining: 0,
        reset,
      };
    });
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > this.bucketTtlMs) {
          this.buckets.delete(key);
          this.mutexes.delete(key);
        }
      }
    }, this.cleanupIntervalMs);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
    this.mutexes.clear();
  }
}
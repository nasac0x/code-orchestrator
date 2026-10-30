import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mutex } from '../src/utils/mutex';

describe('Mutex', () => {
  let mutex: Mutex;

  beforeEach(() => {
    mutex = new Mutex();
  });

  it('should serialize concurrent executions', async () => {
    const order: number[] = [];
    const promises = [
      mutex.runExclusive(async () => { await new Promise(r => setTimeout(r, 10)); order.push(1); }),
      mutex.runExclusive(async () => { await new Promise(r => setTimeout(r, 5)); order.push(2); }),
      mutex.runExclusive(async () => { order.push(3); }),
    ];
    await Promise.all(promises);
    expect(order).toEqual([1, 2, 3]);
  });

  it('should propagate resolved value', async () => {
    const result = await mutex.runExclusive(async () => 42);
    expect(result).toBe(42);
  });

  it('should propagate rejected error', async () => {
    await expect(mutex.runExclusive(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
  });

  it('should allow concurrent executions on different mutex instances', async () => {
    const mutex2 = new Mutex();
    const order: number[] = [];
    await Promise.all([
      mutex.runExclusive(async () => { await new Promise(r => setTimeout(r, 10)); order.push(1); }),
      mutex2.runExclusive(async () => { order.push(2); }),
    ]);
    expect(order).toEqual([2, 1]);
  });
});
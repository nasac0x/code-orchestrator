import { MetricsCollector, MetricsSnapshot } from './types.js';

interface LatencySample {
  value: number;
  timestamp: number;
}

export class MemoryMetricsCollector implements MetricsCollector {
  private totalRequests = 0;
  private allowedRequests = 0;
  private blockedRequests = 0;
  private ipRequests = new Map<string, number>();
  private ipBlocks = new Map<string, number>();
  private latencies: LatencySample[] = [];
  private activeIps = new Set<string>();
  private readonly topIpsLimit: number;
  private readonly latencySamples: number;

  constructor(config: { keyPrefix: string; topIpsLimit: number; latencySamples: number }) {
    this.topIpsLimit = config.topIpsLimit;
    this.latencySamples = config.latencySamples;
  }

  async recordRequest(key: string, allowed: boolean, latencyMs: number): Promise<void> {
    this.totalRequests++;
    this.activeIps.add(key);
    
    if (allowed) {
      this.allowedRequests++;
      this.ipRequests.set(key, (this.ipRequests.get(key) || 0) + 1);
    } else {
      this.blockedRequests++;
      this.ipBlocks.set(key, (this.ipBlocks.get(key) || 0) + 1);
    }

    this.latencies.push({ value: latencyMs, timestamp: Date.now() });
    if (this.latencies.length > this.latencySamples) {
      this.latencies.shift();
    }
  }

  async getSnapshot(): Promise<MetricsSnapshot> {
    const now = Date.now();
    const sortedLatencies = [...this.latencies].sort((a, b) => a.value - b.value);
    
    const percentile = (p: number) => {
      if (sortedLatencies.length === 0) return 0;
      const idx = Math.ceil(sortedLatencies.length * p / 100) - 1;
      return sortedLatencies[Math.max(0, idx)].value;
    };

    const avg = sortedLatencies.length > 0 
      ? sortedLatencies.reduce((s, l) => s + l.value, 0) / sortedLatencies.length 
      : 0;

    const topByRequests = [...this.ipRequests.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.topIpsLimit)
      .map(([ip, count]) => ({ ip, count }));

    const topByBlocks = [...this.ipBlocks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.topIpsLimit)
      .map(([ip, count]) => ({ ip, count }));

    return {
      timestamp: now,
      requests: {
        total: this.totalRequests,
        allowed: this.allowedRequests,
        blocked: this.blockedRequests,
        blockRate: this.totalRequests > 0 ? this.blockedRequests / this.totalRequests : 0,
      },
      latency: {
        p50: percentile(50),
        p95: percentile(95),
        p99: percentile(99),
        avg,
      },
      topIPs: {
        byRequests: topByRequests,
        byBlocks: topByBlocks,
      },
      activeBuckets: this.activeIps.size,
      redis: {
        connected: false,
        keyPrefix: 'memory',
      },
    };
  }

  async shutdown(): Promise<void> {
    this.totalRequests = 0;
    this.allowedRequests = 0;
    this.blockedRequests = 0;
    this.ipRequests.clear();
    this.ipBlocks.clear();
    this.latencies = [];
    this.activeIps.clear();
  }
}
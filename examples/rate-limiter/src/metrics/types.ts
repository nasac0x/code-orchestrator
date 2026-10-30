export interface MetricsSnapshot {
  timestamp: number;
  requests: {
    total: number;
    allowed: number;
    blocked: number;
    blockRate: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  topIPs: {
    byRequests: Array<{ ip: string; count: number }>;
    byBlocks: Array<{ ip: string; count: number }>;
  };
  activeBuckets: number;
  redis: {
    connected: boolean;
    keyPrefix: string;
  };
}

export interface MetricsCollector {
  recordRequest(key: string, allowed: boolean, latencyMs: number): Promise<void>;
  getSnapshot(): Promise<MetricsSnapshot>;
  shutdown(): Promise<void>;
}
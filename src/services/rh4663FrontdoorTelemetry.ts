/** Process-local, privacy-safe operational counters for the public Front Door.
 * They deliberately contain no wallet, query-string, source payload, or IP data.
 * A production metrics scraper can consume the structured logs until a metrics
 * backend is configured. */
export type Rh4663FrontdoorTelemetrySample = {
  duration_ms: number; cache_hit: boolean; response_state: 'available' | 'partial' | 'stale' | 'degraded' | 'error'; source_health: Record<string, string>; card_count: number; open_loop_count: number;
};

export class Rh4663FrontdoorTelemetry {
  private readonly durations: number[] = [];
  private requests = 0; private cacheHits = 0; private partialResponses = 0; private failures = 0;
  record(sample: Rh4663FrontdoorTelemetrySample) {
    this.requests += 1; if (sample.cache_hit) this.cacheHits += 1; if (sample.response_state !== 'available') this.partialResponses += 1;
    this.durations.push(Math.max(0, Math.round(sample.duration_ms))); if (this.durations.length > 1_000) this.durations.shift();
    return this.snapshot();
  }
  failure() { this.requests += 1; this.failures += 1; return this.snapshot(); }
  snapshot() {
    const values = [...this.durations].sort((a, b) => a - b); const percentile = (p: number) => values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : null;
    return { requests: this.requests, failures: this.failures, cache_hit_rate: this.requests ? this.cacheHits / this.requests : 0, partial_response_rate: this.requests ? this.partialResponses / this.requests : 0, latency_ms: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) } };
  }
}

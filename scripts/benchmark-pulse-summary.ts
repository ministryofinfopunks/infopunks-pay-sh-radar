import { performance } from 'node:perf_hooks';
import { IntelligenceSnapshot } from '../src/persistence/repository';
import { pulseSummary } from '../src/services/pulseService';

const generatedAt = '2026-11-03T00:00:00.000Z';
const generatedAtMs = Date.parse(generatedAt);

function syntheticStore(eventCount: number): IntelligenceSnapshot {
  const providers = Array.from({ length: 20 }, (_, index) => ({
    id: `provider-${index}`,
    name: `Synthetic provider ${index}`,
    endpointCount: 2
  })) as IntelligenceSnapshot['providers'];
  const events = Array.from({ length: eventCount }, (_, index) => {
    const providerId = `provider-${index % providers.length}`;
    return {
      id: `synthetic-degradation-${index}`,
      type: 'provider.degraded' as const,
      source: 'synthetic-profile',
      entityType: 'provider' as const,
      entityId: providerId,
      observedAt: new Date(generatedAtMs - (eventCount - index) * 1_000).toISOString(),
      payload: { providerId, response_time_ms: 1_200 }
    };
  });
  return {
    events, providers, endpoints: [], trustAssessments: [], signalAssessments: [], narratives: [], ingestionRuns: [], monitorRuns: [],
    dataSource: {
      mode: 'live_pay_sh_catalog', url: 'https://pay.sh/api/catalog', generated_at: generatedAt,
      provider_count: providers.length, last_ingested_at: generatedAt, used_fixture: false
    }
  };
}

async function main() {
  for (const eventCount of [100, 500, 1_000, 2_000]) {
    const snapshot = syntheticStore(eventCount);
    const startedAt = performance.now();
    let heartbeatDelayMs = 0;
    setImmediate(() => { heartbeatDelayMs = performance.now() - startedAt; });
    const readsMs: number[] = [];
    for (let read = 0; read < 4; read += 1) {
      const readStartedAt = performance.now();
      pulseSummary(snapshot, generatedAt, 450_000, { includePropagation: false, includeInterpretations: false });
      readsMs.push(performance.now() - readStartedAt);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    const warmReadsMs = readsMs.slice(1).sort((left, right) => left - right);
    console.log(JSON.stringify({
      events: eventCount,
      reads: readsMs.length,
      cold_read_ms: Number(readsMs[0].toFixed(2)),
      warm_median_read_ms: Number(warmReadsMs[1].toFixed(2)),
      warm_max_read_ms: Number(warmReadsMs[2].toFixed(2)),
      event_loop_heartbeat_delay_ms: Number(heartbeatDelayMs.toFixed(2))
    }));
  }
}

void main();

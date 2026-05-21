import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { IntelligenceRepository, IntelligenceSnapshot } from '../src/persistence/repository';

class DegradedRepository implements IntelligenceRepository {
  async loadSnapshot(): Promise<IntelligenceSnapshot | null> {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5432') as Error & { code?: string };
    error.code = 'ECONNREFUSED';
    throw error;
  }

  async saveSnapshot(): Promise<void> {
    return;
  }
}

describe('radar evidence ledger', () => {
  it('returns compact agent-readable evidence ledger with exact invariants and no winner claims', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/evidence-ledger' });
    expect(response.statusCode).toBe(200);

    const data = response.json().data;
    expect(data.ledger_state).toEqual({
      recorded_benchmarks: 5,
      total_benchmarks: 10,
      total_artifacts: 6,
      total_recorded_runs: 40,
      proven_routes: 10,
      winner_claimed: false,
      latest_recorded_at: '2026-05-19T11:00:00.000Z'
    });
    expect(data.doctrine).toMatchObject({
      spend_rail: 'Pay.sh',
      evidence_ledger: 'Radar',
      proof_adapter: 'Agent Harness'
    });

    const recordedLaneIds = data.recorded_lanes.map((row: { benchmark_id: string }) => row.benchmark_id);
    expect(recordedLaneIds).toEqual([
      'finance-data-sol-price',
      'finance-data-token-search',
      'finance-data-token-metadata',
      'document-ocr-text-extraction',
      'data-web-search-results'
    ]);
    expect(data.recorded_lanes.find((row: { benchmark_id: string }) => row.benchmark_id === 'data-web-search-results')?.label).toBe('Web Search Results');

    const scaffoldLaneIds = data.scaffold_lanes.map((row: { benchmark_id: string }) => row.benchmark_id);
    expect(scaffoldLaneIds).toEqual(['communications-email-delivery', 'solana-infra-account-balance', 'social-data-reddit-post-search', 'maps-place-search-results', 'audio-speech-transcription']);
    expect(data.scaffold_lanes.every((row: { why_not_promoted: unknown[]; missing_requirements: unknown[] }) => row.why_not_promoted.length > 0 && row.missing_requirements.length > 0)).toBe(true);
    const mapsLane = data.scaffold_lanes.find((row: { benchmark_id: string }) => row.benchmark_id === 'maps-place-search-results');
    expect(mapsLane?.why_not_promoted).toEqual([
      'StableEnrich paid-executed and paid-proven recognizable place-search candidates, but evidence is degraded: names/addresses/coordinates missing and location not confirmed.',
      'Google Places paid-executed and later received one paid diagnostic retry with includedType=cafe, but still returned zero recognizable place candidates.',
      'No second paid-proven comparable place-search route yet.',
      'No benchmark artifact exists.'
    ]);
    const audioLane = data.scaffold_lanes.find((row: { benchmark_id: string }) => row.benchmark_id === 'audio-speech-transcription');
    expect(audioLane?.why_not_promoted).toEqual([
      'Google Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven.',
      'Alibaba Speech paid-executed and received one shape diagnostic paid retry; transcript semantics still not proven.',
      'Both routes remain candidate/unproven with degraded evidence.',
      'No benchmark artifact exists.'
    ]);
    expect(audioLane?.missing_requirements).toEqual([
      'route schema/output change or different comparable transcription provider',
      'two comparable paid-proven routes with transcript semantics proven on canonical fixture',
      '5-run benchmark artifact'
    ]);

    expect(data.latest_artifacts.some((row: { artifact_id: string }) => row.artifact_id === 'data-web-search-results-benchmark-runs-2026-05-19')).toBe(true);
    expect(data.latest_artifacts.some((row: { artifact_id: string }) => row.artifact_id === 'document-ocr-text-extraction-benchmark-runs-2026-05-19')).toBe(true);
    const latestByBenchmarkId = new Map<string, { benchmark_id: string; artifact_id: string; recorded_runs: number }>(
      data.latest_artifacts.map((row: {
        benchmark_id: string;
        artifact_id: string;
        recorded_runs: number;
      }) => [row.benchmark_id, row] as const)
    );
    expect(latestByBenchmarkId.get('finance-data-token-metadata')?.artifact_id).toBe('finance-data-token-metadata-benchmark-runs-2026-05-19');
    expect(latestByBenchmarkId.get('finance-data-token-metadata')?.recorded_runs).toBe(5);
    expect(latestByBenchmarkId.get('data-web-search-results')?.artifact_id).toBe('data-web-search-results-benchmark-runs-2026-05-19');
    expect(latestByBenchmarkId.get('data-web-search-results')?.recorded_runs).toBe(10);
    expect(latestByBenchmarkId.get('document-ocr-text-extraction')?.recorded_runs).toBe(10);

    const recordedLaneRuns = new Map(
      data.recorded_lanes.map((row: { benchmark_id: string; recorded_runs: number }) => [row.benchmark_id, row.recorded_runs])
    );
    expect(recordedLaneRuns.get('finance-data-token-metadata')).toBe(10);
    expect(recordedLaneRuns.get('data-web-search-results')).toBe(10);

    expect(data.route_timeline_entrypoints.some((row: { benchmark_id: string; route_detail_note: string }) => row.benchmark_id === 'data-web-search-results' && row.route_detail_note.includes('URL-encode route_id'))).toBe(true);
    expect(data.caveat_summary).toBeTruthy();

    expect(data.ledger_state.winner_claimed).toBe(false);
    expect(data.recorded_lanes.every((row: { winner_claimed: boolean }) => row.winner_claimed === false)).toBe(true);
    expect(data.latest_artifacts.every((row: { winner_claimed: boolean }) => row.winner_claimed === false)).toBe(true);

    const serialized = JSON.stringify(data).toLowerCase();
    expect(serialized).not.toContain('best route');
    expect(serialized).not.toContain('top route');
    expect(serialized).not.toContain('winner route');
    expect(serialized).not.toContain('loser route');
    expect(serialized).not.toContain('ranking authority');
    expect(serialized).not.toContain('guaranteed trust');
    expect(serialized).not.toContain('superiority proof');

    await app.close();
  });

  it('is available in degraded persistence mode through artifact-backed fallback', async () => {
    process.env.DATABASE_URL = 'postgres://example:test@localhost:5432/test';
    process.env.PAYSH_BOOTSTRAP_ENABLED = 'false';
    const app = await createApp(undefined, new DegradedRepository());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/evidence-ledger' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.ledger_state.recorded_benchmarks).toBe(5);
    expect(response.json().data.ledger_state.winner_claimed).toBe(false);
    await app.close();
    delete process.env.DATABASE_URL;
    delete process.env.PAYSH_BOOTSTRAP_ENABLED;
  });
});

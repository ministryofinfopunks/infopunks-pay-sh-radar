import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('verify-production release invariants', () => {
  it('requires exact benchmark-summary and benchmark-history release totals', async () => {
    const script = await readProjectFile('scripts/verify-production.ts');

    expect(script).toContain('benchmark-summary recorded_benchmarks === 4');
    expect(script).toContain('recordedBenchmarks === 4');
    expect(script).toContain('benchmark-summary total_recorded_runs === 30');
    expect(script).toContain('totalRecordedRuns === 30');
    expect(script).toContain('benchmark-summary proven_routes === 8');
    expect(script).toContain('provenRoutes === 8');
    expect(script).toContain('benchmark-summary total_artifacts === 5');
    expect(script).toContain('totalArtifacts === 5');
    expect(script).toContain('benchmark-history history_count === 4');
    expect(script).toContain('historyCount === 4');
    expect(script).toContain('benchmark-history total_artifacts === 5');
    expect(script).toContain('benchmark-history total_recorded_runs === 30');
    expect(script).toContain('benchmark-history winner_claimed === false');
    expect(script).not.toContain('total_artifacts >= 5 (or equivalent field omitted)');
  });
});

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('verify-production release invariants', () => {
  it('requires exact benchmark-summary and benchmark-history release totals', async () => {
    const script = await readProjectFile('scripts/verify-production.ts');

    expect(script).toContain('benchmark-summary recorded_benchmarks === 5');
    expect(script).toContain('recordedBenchmarks === 5');
    expect(script).toContain('benchmark-summary total_recorded_runs === 40');
    expect(script).toContain('totalRecordedRuns === 40');
    expect(script).toContain('benchmark-summary proven_routes === 10');
    expect(script).toContain('provenRoutes === 10');
    expect(script).toContain('benchmark-summary total_artifacts === 6');
    expect(script).toContain('totalArtifacts === 6');
    expect(script).toContain('benchmark-history history_count === 5');
    expect(script).toContain('historyCount === 5');
    expect(script).toContain('benchmark-history total_artifacts === 6');
    expect(script).toContain('benchmark-history total_recorded_runs === 40');
    expect(script).toContain('benchmark-history winner_claimed === false');
    expect(script).toContain('GET /v1/radar/evidence-ledger status');
    expect(script).toContain('GET /v1/radar/evidence-ledger/brief status');
    expect(script).toContain('likely deployment lag for the new brief endpoint');
    expect(script).toContain('evidence-ledger recorded_benchmarks === 5');
    expect(script).toContain('evidence-ledger total_artifacts === 6');
    expect(script).toContain('evidence-ledger total_recorded_runs === 40');
    expect(script).toContain('evidence-ledger brief total_recorded_runs === 40');
    expect(script).toContain('evidence-ledger brief finance-data-token-metadata latest_artifact_recorded_runs === 5');
    expect(script).toContain('evidence-ledger brief finance-data-token-metadata total_recorded_runs === 10');
    expect(script).toContain('evidence-ledger brief data-web-search-results latest_artifact_recorded_runs === 10');
    expect(script).toContain('evidence-ledger brief document-ocr-text-extraction latest_artifact_recorded_runs === 10');
    expect(script).toContain('evidence-ledger proven_routes === 10');
    expect(script).toContain('evidence-ledger winner_claimed === false');
    expect(script).toContain('evidence-ledger recorded_lanes count === 5');
    expect(script).toContain('recordedLanes.length === 5');
    expect(script).not.toContain('recordedLanes.length === 4');
    expect(script).toContain('evidence-ledger scaffold_lanes count === 5');
    expect(script).toContain('scaffoldLanes.length === 5');
    expect(script).not.toContain('scaffoldLanes.length === 3');
    expect(script).toContain('`recorded_lanes=${String(recordedLanes.length)}`');
    expect(script).toContain('`scaffold_lanes=${String(scaffoldLanes.length)}`');
    expect(script).toContain('evidence-ledger latest_artifacts data-web-search-results recorded_runs === 10');
    expect(script).toContain('evidence-ledger latest_artifacts document-ocr-text-extraction recorded_runs === 10');
    expect(script).toContain('evidence-ledger latest_artifacts finance-data-token-metadata recorded_runs === 5');
    expect(script).toContain('document-ocr-text-extraction-benchmark-runs-2026-05-19');
    expect(script).toContain('OCR route timeline has 2 routes');
    expect(script).toContain('benchmark-summary winner_claimed globally false OR no benchmark winner_claimed=true');
    expect(script).toContain('evidence-ledger winner_claimed === false');
    expect(script).toContain("const disallowedPhrases = ['best route', 'top route', 'winner route', 'loser route', 'ranking authority', 'guaranteed trust', 'superiority proof'];");
    expect(script).toContain('evidence-ledger brief has no route winner claims');
    expect(script).toContain('openapi includes /v1/radar/evidence-ledger');
    expect(script).not.toContain('total_artifacts >= 5 (or equivalent field omitted)');
  });
});

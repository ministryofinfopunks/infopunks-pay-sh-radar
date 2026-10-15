import { afterEach, describe, expect, it, vi } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createOpenApiSpec } from '../src/api/openapi';
import { unicornReadExamples } from '../src/api/publicReadExamples';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { MemoryRepository } from '../src/persistence/repository';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { validateReleaseRead, marketObservationLabel } from '../src/web/releaseReadContracts';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function validators() {
  const spec = createOpenApiSpec() as any;
  const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
  ajv.addSchema({ $id: 'https://radar.invalid/openapi', components: spec.components });
  return { spec, check: (name: string, body: unknown) => {
    const validate = ajv.compile({ $ref: `https://radar.invalid/openapi#/components/schemas/${name}` });
    const valid = validate(body); expect(validate.errors).toBeNull(); expect(valid).toBe(true);
  } };
}
describe('R2 public read contracts and side effects', () => {
  it('validates complete primary examples against generated schemas without any network access', () => {
    const fetch = vi.fn(() => { throw new Error('spec_must_not_fetch'); }); vi.stubGlobal('fetch', fetch);
    const { spec, check } = validators();
    for (const [path, name] of [['/v1/unicorn-radar', 'UnicornRadarSummary'], ['/v1/unicorn-radar/candidates', 'UnicornRadarCandidateList'], ['/v1/unicorn-radar/candidates/{candidateId}', 'UnicornRadarCandidate']]) {
      check(name, spec.paths[path].get.responses['200'].content['application/json'].examples.success.value.data);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(spec.components.schemas.UnicornRadarReceipt.properties.url.type).toEqual(['string', 'null']);
    expect(spec.components.schemas.UnicornRadarHunterCredit.properties.source.enum).toContain('infopunks_desk');
    expect(spec.paths['/v1/economics/revenue'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths['/v1/economics/revenue'].get.responses['401']).toBeDefined();
  });
  it('validates actual HTTP projections and proves allowed GETs do not persist or append receipts', async () => {
    vi.stubEnv('PAYSH_BOOTSTRAP_ENABLED', 'false'); vi.stubEnv('INGESTION_ENABLED', 'false'); vi.stubEnv('MONITOR_ENABLED', 'false');
    const fetch = vi.fn(async (_input: RequestInfo | URL) => new Response('{}', { status: 503 })); vi.stubGlobal('fetch', fetch);
    const repo = new MemoryRepository(); const receiptStore = new MemoryCanonicalReceiptStore();
    const saved = vi.spyOn(repo, 'saveSnapshot'); const appended = vi.spyOn(receiptStore, 'append');
    const app = await createApp(emptyIntelligenceStore(), repo, { judgmentReceiptStore: receiptStore });
    try {
      await app.ready(); saved.mockClear(); appended.mockClear();
      const { check } = validators();
      for (const [path, schema] of [['/v1/unicorn-radar', 'UnicornRadarSummary'], ['/v1/unicorn-radar/candidates', 'UnicornRadarCandidateList'], ['/v1/unicorn-radar/candidates/ur_manifest_ambiguity', 'UnicornRadarCandidate']]) {
        const response = await app.inject({ url: path }); expect(response.statusCode).toBe(200); check(schema, response.json().data);
        validateReleaseRead(path, response.json());
      }
      const summary = (await app.inject({ url: '/v1/unicorn-radar?status=unknown' })).json().data;
      expect(summary.counts.total).toBe(10); // No server-query filter is implemented.
      expect(summary.revenue_receipts).toEqual([]);
      expect(summary.candidates.every((c: any) => c.paid_evaluation_disclosure.is_paid === false)).toBe(true);
      expect(saved).not.toHaveBeenCalled(); expect(appended).not.toHaveBeenCalled();
      expect(fetch.mock.calls.length).toBeGreaterThan(0);
      expect(fetch.mock.calls.every(([url]) => String(url).startsWith('https://api.dexscreener.com/'))).toBe(true);
      const missing = await app.inject({ url: '/v1/unicorn-radar/candidates/no-record' }); expect(missing.statusCode).toBe(404);
      const malformed = await app.inject({ url: '/v1/unicorn-radar/candidates/%FF' }); expect(malformed.statusCode).toBe(400); expect(malformed.body).not.toContain('%FF');
    } finally { await app.close(); }
  });
  it.each(['total', 'status', 'sector'])('rejects internally contradictory %s counts rather than presenting empty evidence', field => {
    const body = { data: unicornReadExamples().summary } as any;
    if (field === 'total') body.data.counts.total = 0;
    if (field === 'status') body.data.counts.by_status.watchlist = 99;
    if (field === 'sector') body.data.counts.by_sector['AI / Agent Rails'] = 99;
    expect(() => validateReleaseRead('/v1/unicorn-radar', body)).toThrow('Evidence response is invalid');
  });
  it('rejects duplicated identities even when the claimed counts match', () => {
    const body = { data: unicornReadExamples().summary } as any;
    body.data.candidates[0].id = body.data.candidates[1].id;
    expect(() => validateReleaseRead('/v1/unicorn-radar', body)).toThrow('Evidence response is invalid');
  });
  it('accepts genuinely empty data only with corresponding zero counts', () => {
    const body = { data: unicornReadExamples().summary } as any;
    body.data.candidates = []; body.data.counts.total = 0;
    for (const counts of [body.data.counts.by_status, body.data.counts.by_sector, body.data.counts.by_verdict]) for (const key of Object.keys(counts)) counts[key] = 0;
    expect(() => validateReleaseRead('/v1/unicorn-radar', body)).not.toThrow();
  });
  it('never describes an absent or future capture as current provider publication', () => {
    const now = Date.parse('2026-10-14T00:00:00Z');
    expect(marketObservationLabel({}, now)).toContain('unavailable');
    expect(marketObservationLabel({ dexScreenerData: {}, marketDataUpdatedAt: '2026-10-15T00:00:00Z' }, now)).toContain('invalid');
    const label = marketObservationLabel({ dexScreenerData: {}, marketDataUpdatedAt: '2026-10-13T23:59:30Z' }, now);
    expect(label).toContain('Radar market capture'); expect(label).toContain('snapshot'); expect(label).not.toMatch(/recent|live/i);
  });
});

import { getUnicornRadarCandidate, listUnicornRadarCandidates } from '../data/unicornRadar';
import { UnicornRadarSectorSchema, UnicornRadarStatusSchema, UnicornRadarVerdictSchema } from '../schemas/entities';
import { UNICORN_RADAR_COPY, UNICORN_RADAR_GENERATED_AT } from '../services/unicornRadarService';
import { safeJsonExport } from '../services/radarExportService';

/** Complete examples from the authored archive; never fetch or fabricate current telemetry. */
export function unicornReadExamples() {
  const candidates = listUnicornRadarCandidates();
  const count = (values: readonly string[], field: 'status' | 'verdict' | 'sector') =>
    Object.fromEntries(values.map(value => [value, candidates.filter(candidate => candidate[field] === value).length]));
  return {
    summary: safeJsonExport({
      generated_at: UNICORN_RADAR_GENERATED_AT,
      ...UNICORN_RADAR_COPY,
      counts: { total: candidates.length, by_status: count(UnicornRadarStatusSchema.options, 'status'),
        by_verdict: count(UnicornRadarVerdictSchema.options, 'verdict'), by_sector: count(UnicornRadarSectorSchema.options, 'sector') },
      candidates, revenue_receipts: []
    }),
    list: safeJsonExport({ generated_at: UNICORN_RADAR_GENERATED_AT, count: candidates.length, candidates }),
    detail: safeJsonExport(getUnicornRadarCandidate('ur_manifest_ambiguity'))
  };
}

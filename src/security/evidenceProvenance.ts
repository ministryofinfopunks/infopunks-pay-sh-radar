import { z } from 'zod';
import type { EconomicOperation } from '../schemas/economicEngine';

/** Host-only domain; no HTTP field or environment toggle can opt a production store in. */
const brand: unique symbol = Symbol('local-simulation-domain');
export type LocalSimulationDomain = Readonly<{
  kind: 'local-simulation';
  real_spending: false;
  [brand]: true;
}>;
const domains = new WeakSet<object>();
export function localSimulationDomain(): LocalSimulationDomain {
  const domain = Object.freeze({
    kind: 'local-simulation' as const,
    real_spending: false as const,
    [brand]: true as const,
  });
  domains.add(domain);
  return domain;
}
export function isLocalSimulationDomain(value: unknown): value is LocalSimulationDomain {
  return typeof value === 'object' && value !== null && domains.has(value);
}
export const LocalSimulationProvenanceSchema = z
  .object({
    catalog_source: z.literal('simulation'),
    evidence_class: z.literal('local_simulation'),
    simulation: z.literal(true),
    environment: z.literal('isolated-local-spend-lab'),
    external_economic_activity: z.literal(false),
    spending_authority: z.literal('none'),
  })
  .strict();
export type LocalSimulationProvenance = z.infer<typeof LocalSimulationProvenanceSchema>;
export const localSimulationProvenance: Readonly<LocalSimulationProvenance> = Object.freeze(
  LocalSimulationProvenanceSchema.parse({
    catalog_source: 'simulation',
    evidence_class: 'local_simulation',
    simulation: true,
    environment: 'isolated-local-spend-lab',
    external_economic_activity: false,
    spending_authority: 'none',
  }),
);
export function eligibleEvidenceProvenance(
  provenance: Record<string, unknown>,
  domain?: LocalSimulationDomain,
) {
  if (domain !== undefined)
    return (
      isLocalSimulationDomain(domain) &&
      LocalSimulationProvenanceSchema.safeParse(provenance).success
    );
  return (
    provenance.catalog_source === 'live' &&
    (provenance.fixture === undefined || provenance.fixture === false) &&
    (provenance.simulation === undefined || provenance.simulation === false) &&
    (provenance.evidence_class === undefined || provenance.evidence_class === 'live_evidence') &&
    (provenance.spending_authority === undefined ||
      provenance.spending_authority === 'reviewed_live') &&
    (provenance.external_economic_activity === undefined ||
      provenance.external_economic_activity === true) &&
    provenance.environment !== 'isolated-local-spend-lab'
  );
}
export function isLocalSimulationOperation(op: EconomicOperation) {
  return (
    op.profile_id.startsWith('spend-lab/') &&
    op.chain_id === 'lab:simulation' &&
    op.asset_id === 'lab:simulation/MOCK' &&
    op.fee_asset_id === op.asset_id &&
    op.asset_contract === 'MOCK' &&
    op.payer === 'lab-payer' &&
    op.recipient === 'lab-provider' &&
    op.router === 'lab-router' &&
    op.method === 'local-service'
  );
}

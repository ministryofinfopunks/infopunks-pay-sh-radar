export type RhChainCanonicalStatus = 'source_required' | 'candidate' | 'reviewed' | 'disputed';
export type RhChainCanonicalIdentity = { contract: string; ticker: string; name: string; canonical_status: RhChainCanonicalStatus; evidence_links: string[]; reviewed_at: string | null; notes: string };

/** Manual-only registry. Providers must never populate this list. */
export const rhChainCanonicalIdentityRegistry: readonly RhChainCanonicalIdentity[] = [];
const normalize = (value: string) => value.trim().toLowerCase();
export function findRhChainCanonicalIdentity(contract: string, registry = rhChainCanonicalIdentityRegistry): RhChainCanonicalIdentity | null {
  return registry.find((identity) => normalize(identity.contract) === normalize(contract)) ?? null;
}

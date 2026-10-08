import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { IpxLaunchPolicySchema, type IpxLaunchPolicy } from '../schemas/ipxLaunch';
import { ipxSha256 } from './ipxJcs';

const digest = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase()).refine(value => !/^0x0+$/.test(value));
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(value => value.toLowerCase()).refine(value => !/^0x0+$/.test(value));
const evidence = z.object({ artifact_uri: z.string().url().refine(value => !/\b(tbd|todo|pending)\b/i.test(value)), artifact_sha256: digest, reviewer: z.string().min(1).refine(value => !/^(tbd|todo|pending)$/i.test(value.trim())), reviewed_at: z.string().datetime() }).strict();

/** A reviewed manifest is a launch gate, not a substitute for live chain verification. */
export const IpxIssuanceManifestSchema = z.object({
  version: z.literal('ipx.issuance-manifest.v1'),
  policy_hash: digest,
  chain_id: z.literal(4663),
  finalized_block_number: z.string().regex(/^[1-9][0-9]*$/),
  finalized_block_hash: digest,
  deployed_contracts: z.object({ token: address, distributor: address, vault: address, pltr: address }).strict(),
  constitution: evidence,
  source_and_build: evidence,
  deployed_bytecode_and_constructor: evidence,
  independent_contract_review: evidence,
  genesis_wallet_claim_terms: evidence,
  launch_policy_and_custody: evidence,
  venue_routes_and_liquidity: evidence,
  x402_v2_exact_4663_usdg: evidence,
  rollback_and_operator_runbook: evidence
}).strict();

export function validateIpxIssuanceManifest(raw: unknown, policy: IpxLaunchPolicy) {
  const manifest = IpxIssuanceManifestSchema.parse(raw);
  const canonicalPolicy = IpxLaunchPolicySchema.parse(policy);
  if (manifest.policy_hash !== ipxSha256(canonicalPolicy)
    || manifest.deployed_contracts.token !== canonicalPolicy.token_contract
    || manifest.deployed_contracts.distributor !== canonicalPolicy.genesis_distributor
    || manifest.deployed_contracts.vault !== canonicalPolicy.contribution_vault
    || manifest.deployed_contracts.pltr !== canonicalPolicy.canonical_pltr
    || manifest.constitution.artifact_sha256 !== canonicalPolicy.constitution_sha256) {
    throw new Error('ipx_issuance_manifest_policy_mismatch');
  }
  return { manifest, manifest_hash: ipxSha256(manifest) };
}

export function loadIpxIssuanceManifest(path: string | undefined, policy: IpxLaunchPolicy) {
  if (!path) throw new Error('ipx_issuance_manifest_required');
  return validateIpxIssuanceManifest(JSON.parse(readFileSync(path, 'utf8')), policy);
}

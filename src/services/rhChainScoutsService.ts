import type { RhChainScoutsPayload, RhChainSignalScout, RhChainScoutReputationLabel } from '../data/rhChain';
import type { RhChainSignalSubmission } from './rhChainSignalVault';

const DOCTRINE = 'External data gives context. Infopunks gives judgment. Receipts create memory.' as const;
const DISCLAIMER = 'Signal Scouts are consented public attributions for evidence contributions only. No token rewards, paid alpha access, trading coordination, endorsement, or financial recommendation is offered.';

function reputation(submissions: RhChainSignalSubmission[]): RhChainScoutReputationLabel {
  const accepted = submissions.filter((item) => item.review_status === 'approved_signal').length;
  const risk = submissions.filter((item) => ['high_risk', 'do_not_touch_yet', 'source_required'].includes(item.risk_state ?? '')).length;
  const narrative = submissions.filter((item) => Boolean(item.submitter_notes)).length;
  if (accepted >= 3) return 'signal_archivist';
  if (risk >= 2) return 'risk_spotter';
  if (narrative >= 2) return 'narrative_mapper';
  if (submissions.some((item) => item.links.liquidity || item.deployer_notes)) return 'receipt_hunter';
  return 'new_scout';
}

/** Builds a privacy-preserving board; contacts and non-consenting contributors are never included. */
export function assembleRhChainScouts(submissions: RhChainSignalSubmission[]): RhChainScoutsPayload {
  const byHandle = new Map<string, RhChainSignalSubmission[]>();
  for (const submission of submissions) {
    if (!submission.public_attribution_consent || !submission.scout_handle) continue;
    const handle = submission.scout_handle.trim();
    byHandle.set(handle.toLowerCase(), [...(byHandle.get(handle.toLowerCase()) ?? []), submission]);
  }
  const scouts: RhChainSignalScout[] = [...byHandle.entries()].map(([scout_id, records]) => {
    const latest = [...records].sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))[0];
    const accepted = records.filter((item) => item.review_status === 'approved_signal').length;
    const risk = records.filter((item) => ['high_risk', 'do_not_touch_yet', 'source_required'].includes(item.risk_state ?? '')).length;
    return { scout_id, display_handle: latest.scout_handle!, submissions_count: records.length, accepted_evidence_count: accepted, approved_signal_mentions: accepted, risk_warning_mentions: risk, latest_submission_at: latest.submitted_at, reputation_label: reputation(records), public_notes: [`${records.length} consented submission${records.length === 1 ? '' : 's'} retained in Signal Vault.`, 'Attribution recognizes evidence contribution only; it does not indicate approval or token safety.'], data_mode: records.some((item) => item.data_mode === 'persisted') ? 'persisted' as const : 'community_submission' as const };
  }).sort((left, right) => right.latest_submission_at.localeCompare(left.latest_submission_at));
  return { title: 'Signal Scouts', subtitle: 'The market forgets. Scouts bring receipts.', generated_at: scouts[0]?.latest_submission_at ?? new Date().toISOString(), doctrine: DOCTRINE, disclaimer: DISCLAIMER, scouts,
    roles: [
      { title: 'Receipt Hunter', description: 'Finds source links, contracts, pairs, and timestamped liquidity context.' },
      { title: 'Risk Spotter', description: 'Surfaces clone, identity, deployer, or evidence gaps without making definitive claims.' },
      { title: 'Narrative Mapper', description: 'Records how tickers, memes, and market language mutate across the desk.' },
      { title: 'Launch Surface Watcher', description: 'Documents launch claims, routes, and missing provenance for manual review.' },
      { title: 'Signal Archivist', description: 'Preserves public memory so the market cannot erase its own receipts.' }
    ] };
}

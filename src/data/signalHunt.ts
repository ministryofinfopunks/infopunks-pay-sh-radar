import { z } from 'zod';
import type {
  SignalHuntCandidate,
  SignalHuntDecisionState,
  SignalHuntHuntState,
  SignalHuntProofState,
  SignalHuntSubmissionInput,
  SignalHuntVerifyInput
} from '../schemas/entities';

type SignalHuntSeed = SignalHuntCandidate;

const SignalHuntSubmissionInputSchema = z.object({
  title: z.string().min(1),
  handle_or_source: z.string().min(1),
  category: z.string().min(1),
  thesis: z.string().min(1),
  why_it_matters: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  submitted_by: z.string().min(1),
  tags: z.array(z.string().min(1)).default([])
});

const SignalHuntVerifyInputSchema = z.object({
  verifier: z.string().min(1),
  verdict: z.enum(['verified_signal', 'noise', 'disputed', 'under_review']),
  proof_state: z.enum(['receipts_attached', 'validated', 'challenged', 'rejected']).optional(),
  decision_note: z.string().min(1),
  linked_check_ids: z.array(z.string()).default([]),
  linked_loop_ids: z.array(z.string()).default([]),
  linked_signal_ids: z.array(z.string()).default([]),
  linked_route_ids: z.array(z.string()).default([])
});

const seededSignals: SignalHuntSeed[] = [
  {
    id: 'hunt_black_bull_coordination',
    title: 'Black Bull attention is mutating into community coordination',
    handle_or_source: '@ansem + community carry',
    category: 'attention_market',
    thesis: 'The signal is no longer only persona velocity. Redistribution mechanics and participant-made media are carrying the object into a broader coordination loop.',
    why_it_matters: 'Signal Hunt surfaces the intake before Narrative Intel hardens the frame, so the desk can track whether culture is becoming durable memory or just reflexive heat.',
    evidence: [
      'Reported creator-fee redistribution summaries keep recirculating as trench proof.',
      'Holder-growth screenshots and participant-made media are now part of the public loop.',
      'Linked signal reports and watch pages already exist downstream in Narrative Intel.'
    ],
    evidence_count: 3,
    signal_score: 92,
    velocity_score: 89,
    risk_score: 79,
    proof_state: 'validated',
    hunt_state: 'verified_signal',
    decision_state: 'signal',
    submitted_by: 'desk',
    submitted_at: '2026-07-01T09:00:00.000Z',
    updated_at: '2026-07-01T12:15:00.000Z',
    linked_check_ids: ['check_route_pay_sh_seed'],
    linked_loop_ids: ['loop_pre_spend_route'],
    linked_signal_ids: ['black-bull'],
    linked_route_ids: ['route_pay_sh_market_research_01'],
    tags: ['coordination', 'attention-market', 'community-carry']
  },
  {
    id: 'hunt_troll_reindex',
    title: 'TROLL is behaving like internet memory, not fresh meme novelty',
    handle_or_source: 'Community takeover / Solscan / Dexscreener',
    category: 'meme_archetype',
    thesis: 'The signal is survival. Old internet lore keeps re-entering trench circulation with enough holder surface and myth coherence to matter again.',
    why_it_matters: 'Signal Hunt should catch re-indexed culture before the market narrative pretends it appeared from nowhere.',
    evidence: [
      'The asset carries a long-circulation survival frame instead of a one-cycle novelty frame.',
      'Community takeover language remains central to the public thesis.',
      'Tracker-visible holder surface is repeatedly used as cultural proof.'
    ],
    evidence_count: 3,
    signal_score: 88,
    velocity_score: 74,
    risk_score: 67,
    proof_state: 'receipts_attached',
    hunt_state: 'under_review',
    decision_state: 'review',
    submitted_by: 'community',
    submitted_at: '2026-06-30T11:30:00.000Z',
    updated_at: '2026-07-01T08:40:00.000Z',
    linked_check_ids: ['check_provider_reliability_seed'],
    linked_loop_ids: [],
    linked_signal_ids: ['troll'],
    linked_route_ids: [],
    tags: ['reindex', 'meme', 'community-takeover']
  },
  {
    id: 'hunt_machine_wallet_desks',
    title: 'Machine-wallet infra is becoming public culture instead of back-office plumbing',
    handle_or_source: 'Machine market stack / Signal Graph',
    category: 'agent_infra',
    thesis: 'Machine identity, wallet rails, and preflight policy are starting to compress into one memetic stack.',
    why_it_matters: 'Signal Hunt is the intake layer that lets culture-facing discovery attach to the serious machine-market and pre-spend stack before claims harden.',
    evidence: [
      'Machine market coverage has expanded into route risk, receipts, and first-safe planning.',
      'Graph and narrative surfaces already expose adjacent infra claims.',
      'Builders are starting to speak about machine spend as a public story, not just an internal control-plane problem.'
    ],
    evidence_count: 3,
    signal_score: 81,
    velocity_score: 71,
    risk_score: 58,
    proof_state: 'unproven',
    hunt_state: 'fresh_signal',
    decision_state: 'review',
    submitted_by: 'desk',
    submitted_at: '2026-06-29T15:20:00.000Z',
    updated_at: '2026-07-01T07:00:00.000Z',
    linked_check_ids: [],
    linked_loop_ids: ['loop_provider_trust'],
    linked_signal_ids: [],
    linked_route_ids: ['route_pay_sh_market_research_03'],
    tags: ['machine-markets', 'wallets', 'agent-readiness']
  },
  {
    id: 'hunt_persona_copytrade_noise',
    title: 'Another persona ticker is recycling the same copy-trade myth',
    handle_or_source: '@reply_gang_monitor',
    category: 'attention_market',
    thesis: 'The object is reading like a thin persona wrapper with weak receipts and derivative copy.',
    why_it_matters: 'Signal Hunt needs an explicit noise lane so the public loop can see rejected intake, not only the winners.',
    evidence: [
      'Evidence is mostly screenshots of posts rather than durable proof.',
      'The story maps too closely to prior influencer-coin cycles.',
      'No linked proof checks or loop memory currently strengthen the case.'
    ],
    evidence_count: 3,
    signal_score: 34,
    velocity_score: 63,
    risk_score: 88,
    proof_state: 'rejected',
    hunt_state: 'noise',
    decision_state: 'noise',
    submitted_by: 'system',
    submitted_at: '2026-06-28T21:10:00.000Z',
    updated_at: '2026-06-30T06:40:00.000Z',
    linked_check_ids: [],
    linked_loop_ids: [],
    linked_signal_ids: [],
    linked_route_ids: [],
    tags: ['noise', 'copy-trade', 'thin-evidence']
  },
  {
    id: 'hunt_disputed_provider_rep',
    title: 'Provider reputation thread is splitting between proof and vibes',
    handle_or_source: 'Provider Reputation / Proof Feed',
    category: 'provider_reputation',
    thesis: 'A provider-quality story is spreading faster than the receipts supporting it, and the public discussion is now contested.',
    why_it_matters: 'Signal Hunt should connect culture-layer intake to provider reputation and evidence-led challenge flows before the wrong operational myth hardens.',
    evidence: [
      'Proof checks and dispute language are both increasing around the same subject.',
      'The public narrative now mixes route quality with unrelated tribal claims.',
      'The right next step is linked validation, not more amplification.'
    ],
    evidence_count: 3,
    signal_score: 61,
    velocity_score: 69,
    risk_score: 83,
    proof_state: 'challenged',
    hunt_state: 'disputed',
    decision_state: 'review',
    submitted_by: 'community',
    submitted_at: '2026-06-27T17:45:00.000Z',
    updated_at: '2026-07-01T05:30:00.000Z',
    linked_check_ids: ['check_provider_reliability_seed'],
    linked_loop_ids: ['loop_provider_trust'],
    linked_signal_ids: [],
    linked_route_ids: [],
    tags: ['provider-reputation', 'challenged', 'validation']
  }
];

let runtimeSignals = seededSignals.map(cloneSignal);

function cloneSignal(signal: SignalHuntCandidate): SignalHuntCandidate {
  return {
    ...signal,
    evidence: [...signal.evidence],
    linked_check_ids: [...signal.linked_check_ids],
    linked_loop_ids: [...signal.linked_loop_ids],
    linked_signal_ids: [...signal.linked_signal_ids],
    linked_route_ids: [...signal.linked_route_ids],
    tags: [...signal.tags]
  };
}

function compareByUpdatedDesc(left: SignalHuntCandidate, right: SignalHuntCandidate) {
  return right.updated_at.localeCompare(left.updated_at);
}

function computeDecisionState(huntState: SignalHuntHuntState): SignalHuntDecisionState {
  if (huntState === 'verified_signal') return 'signal';
  if (huntState === 'noise') return 'noise';
  return 'review';
}

function defaultProofState(huntState: SignalHuntHuntState): SignalHuntProofState {
  if (huntState === 'verified_signal') return 'validated';
  if (huntState === 'noise') return 'rejected';
  if (huntState === 'disputed') return 'challenged';
  return 'receipts_attached';
}

function asId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function listSignalHuntCandidates(): SignalHuntCandidate[] {
  return runtimeSignals.map(cloneSignal).sort(compareByUpdatedDesc);
}

export function getSignalHuntCandidate(signalId: string): SignalHuntCandidate | null {
  const signal = runtimeSignals.find((item) => item.id === signalId);
  return signal ? cloneSignal(signal) : null;
}

export function createSignalHuntSubmission(input: SignalHuntSubmissionInput): SignalHuntCandidate {
  const parsed = SignalHuntSubmissionInputSchema.parse(input);
  const now = new Date().toISOString();
  const signal: SignalHuntCandidate = {
    id: asId('hunt'),
    title: parsed.title,
    handle_or_source: parsed.handle_or_source,
    category: parsed.category,
    thesis: parsed.thesis,
    why_it_matters: parsed.why_it_matters,
    evidence: [...parsed.evidence],
    evidence_count: parsed.evidence.length,
    signal_score: 64,
    velocity_score: 58,
    risk_score: 55,
    proof_state: 'receipts_attached',
    hunt_state: 'fresh_signal',
    decision_state: 'review',
    submitted_by: parsed.submitted_by,
    submitted_at: now,
    updated_at: now,
    linked_check_ids: [],
    linked_loop_ids: [],
    linked_signal_ids: [],
    linked_route_ids: [],
    tags: [...parsed.tags]
  };
  runtimeSignals = [signal, ...runtimeSignals];
  return cloneSignal(signal);
}

export function verifySignalHuntCandidate(signalId: string, input: SignalHuntVerifyInput): SignalHuntCandidate | null {
  const parsed = SignalHuntVerifyInputSchema.parse(input);
  const index = runtimeSignals.findIndex((item) => item.id === signalId);
  if (index < 0) return null;
  const current = runtimeSignals[index];
  const hunt_state = parsed.verdict as SignalHuntHuntState;
  const updated: SignalHuntCandidate = {
    ...current,
    hunt_state,
    proof_state: parsed.proof_state ?? defaultProofState(hunt_state),
    decision_state: computeDecisionState(hunt_state),
    updated_at: new Date().toISOString(),
    linked_check_ids: mergeUnique(current.linked_check_ids, parsed.linked_check_ids),
    linked_loop_ids: mergeUnique(current.linked_loop_ids, parsed.linked_loop_ids),
    linked_signal_ids: mergeUnique(current.linked_signal_ids, parsed.linked_signal_ids),
    linked_route_ids: mergeUnique(current.linked_route_ids, parsed.linked_route_ids),
    evidence: [...current.evidence, `${parsed.verifier}: ${parsed.decision_note}`],
    evidence_count: current.evidence.length + 1,
    signal_score: hunt_state === 'verified_signal' ? Math.min(current.signal_score + 7, 100) : hunt_state === 'noise' ? Math.max(current.signal_score - 18, 0) : current.signal_score,
    risk_score: hunt_state === 'noise' ? Math.min(current.risk_score + 6, 100) : hunt_state === 'verified_signal' ? Math.max(current.risk_score - 5, 0) : current.risk_score
  };
  runtimeSignals = runtimeSignals.map((item, itemIndex) => itemIndex === index ? updated : item);
  return cloneSignal(updated);
}

function mergeUnique(left: string[], right: string[]) {
  return Array.from(new Set([...left, ...right]));
}

export function getSignalHuntCounts() {
  const counts = {
    total: runtimeSignals.length,
    fresh_signal: 0,
    under_review: 0,
    verified_signal: 0,
    noise: 0,
    disputed: 0
  };
  for (const signal of runtimeSignals) counts[signal.hunt_state] += 1;
  return counts;
}

export function listSignalHuntByState(huntState: SignalHuntHuntState) {
  return listSignalHuntCandidates().filter((item) => item.hunt_state === huntState);
}

export function resetSignalHuntStoreForTests() {
  runtimeSignals = seededSignals.map(cloneSignal);
}

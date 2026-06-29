import type {
  CandidateSignal,
  CandidateSignalPriority,
  CandidateSignalStatus
} from '../schemas/entities';

const seededCandidates: CandidateSignal[] = [
  {
    candidate_id: 'candidate_sol_persona_attention',
    name: 'Next attention market around a major Solana persona',
    chain: 'Solana',
    category: 'attention_market',
    submitted_by: 'desk',
    status: 'watching',
    priority: 'high',
    risk_level: 'medium',
    summary: 'The desk is tracking whether a familiar Solana persona is compressing social attention into a new market object.',
    why_it_matters: 'Persona-led coordination can mint a market before durable ownership or utility becomes legible.',
    evidence_links: ['/narratives/attention-markets'],
    created_at: '2026-06-24T09:00:00.000Z',
    updated_at: '2026-06-29T00:00:00.000Z'
  },
  {
    candidate_id: 'candidate_agentic_meme_repeat_mentions',
    name: 'Agentic meme asset gaining repeat mentions',
    ticker: 'TBD',
    category: 'agentic_narrative',
    submitted_by: 'system',
    status: 'needs_evidence',
    priority: 'medium',
    risk_level: 'unknown',
    summary: 'Repeat mentions suggest an agentic meme frame may be forming, but current evidence is still too thin for a mapped report.',
    why_it_matters: 'Repeated framing can signal that a meme is turning into a coordination rail instead of a one-cycle joke.',
    evidence_links: [],
    created_at: '2026-06-25T12:30:00.000Z',
    updated_at: '2026-06-29T00:00:00.000Z'
  },
  {
    candidate_id: 'candidate_depin_machine_payments',
    name: 'DePIN machine-payment narrative cluster',
    chain: 'Solana',
    category: 'depin_signal',
    submitted_by: 'desk',
    status: 'under_review',
    priority: 'high',
    risk_level: 'low',
    summary: 'The desk is grouping emerging machine-payment claims into one DePIN-adjacent narrative cluster for review.',
    why_it_matters: 'Machine payments can turn infrastructure coordination into investable narrative surface well before demand quality is settled.',
    evidence_links: ['/machine-market/summary'],
    created_at: '2026-06-22T08:15:00.000Z',
    updated_at: '2026-06-29T00:00:00.000Z'
  },
  {
    candidate_id: 'candidate_ai_wallet_coordination',
    name: 'AI wallet coordination narrative',
    chain: 'Base',
    category: 'agentic_narrative',
    submitted_by: 'community',
    status: 'queued',
    priority: 'medium',
    risk_level: 'medium',
    summary: 'This candidate watches whether AI wallet coordination is shifting from technical demo copy into a market myth.',
    why_it_matters: 'If wallets become the story rather than the plumbing, the narrative can spread faster than the actual execution proof.',
    evidence_links: ['/graph'],
    created_at: '2026-06-27T07:45:00.000Z',
    updated_at: '2026-06-29T00:00:00.000Z'
  },
  {
    candidate_id: 'candidate_article6_carbon',
    name: 'Carbon credit tokenization narrative under Article 6',
    category: 'market_myth',
    submitted_by: 'desk',
    status: 'needs_evidence',
    priority: 'low',
    risk_level: 'unknown',
    summary: 'The desk is monitoring whether Article 6 language is being used to manufacture premature token legitimacy.',
    why_it_matters: 'Policy-linked myths can create surface-level credibility long before market structure or settlement discipline is proven.',
    evidence_links: [],
    created_at: '2026-06-26T15:20:00.000Z',
    updated_at: '2026-06-29T00:00:00.000Z'
  },
  {
    candidate_id: 'candidate_solana_trench_myth',
    name: 'Emerging Solana trench myth with unclear evidence',
    chain: 'Solana',
    category: 'unknown',
    submitted_by: 'system',
    status: 'rejected',
    priority: 'low',
    risk_level: 'high',
    summary: 'A trench story is circulating, but the desk cannot yet distinguish signal from recycled chatter.',
    why_it_matters: 'Rejected candidates still matter because weak evidence can still propagate as market belief.',
    evidence_links: [],
    created_at: '2026-06-23T19:10:00.000Z',
    updated_at: '2026-06-28T22:40:00.000Z'
  }
];

function byUpdatedDesc(left: CandidateSignal, right: CandidateSignal) {
  return right.updated_at.localeCompare(left.updated_at);
}

export function listCandidateSignals(): CandidateSignal[] {
  return [...seededCandidates].sort(byUpdatedDesc);
}

export function getCandidateSignal(candidate_id: string): CandidateSignal | null {
  return seededCandidates.find((candidate) => candidate.candidate_id === candidate_id) ?? null;
}

export function getCandidateSignalCounts() {
  const candidates = listCandidateSignals();
  const counts = {
    total: candidates.length,
    queued: 0,
    watching: 0,
    needs_evidence: 0,
    under_review: 0,
    promoted_to_report: 0
  };

  for (const candidate of candidates) {
    if (candidate.status in counts) counts[candidate.status as keyof typeof counts] += 1;
  }

  return counts;
}

export function getCandidateSignalsByStatus(status: CandidateSignalStatus): CandidateSignal[] {
  return listCandidateSignals().filter((candidate) => candidate.status === status);
}

export function getCandidateSignalsByPriority(priority: CandidateSignalPriority): CandidateSignal[] {
  return listCandidateSignals().filter((candidate) => candidate.priority === priority);
}

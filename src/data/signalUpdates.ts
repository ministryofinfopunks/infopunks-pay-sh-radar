import type { SignalEvidenceUpdate } from '../schemas/entities';

const signalEvidenceUpdates: SignalEvidenceUpdate[] = [
  {
    update_id: 'seu_black_bull_001',
    signal_slug: 'black-bull',
    timestamp: '2026-06-24T10:00:00.000Z',
    update_type: 'attention_shift',
    summary: "The Black Bull narrative begins spreading as an attention-market artifact around Ansem's Solana influence.",
    evidence_links: ['/signals/black-bull', '/narratives/attention-markets'],
    previous_score: 72,
    new_score: 86,
    analyst_note: 'Attention velocity increased because the meme is simple, persona-linked, and easy for trench participants to repeat.'
  },
  {
    update_id: 'seu_black_bull_002',
    signal_slug: 'black-bull',
    timestamp: '2026-06-25T11:30:00.000Z',
    update_type: 'myth_shift',
    summary: 'The Black Bull symbol compresses conviction, aggression, and Solana-native trench identity into one portable meme.',
    evidence_links: ['/signals/black-bull', '/narratives/attention-markets'],
    previous_score: 78,
    new_score: 88,
    analyst_note: 'Myth coherence is strong because the symbol travels without needing technical explanation.'
  },
  {
    update_id: 'seu_black_bull_003',
    signal_slug: 'black-bull',
    timestamp: '2026-06-26T09:15:00.000Z',
    update_type: 'holder_shift',
    summary: 'Power concentration remains a sovereignty concern because attention, supply, and interpretation can cluster around a small set of actors.',
    evidence_links: ['/signals/black-bull', '/narratives/attention-markets'],
    previous_score: 58,
    new_score: 52,
    analyst_note: 'Narrative assets should be treated as reflexive systems where wallet power and symbolic power can reinforce each other.'
  },
  {
    update_id: 'seu_black_bull_004',
    signal_slug: 'black-bull',
    timestamp: '2026-06-27T14:45:00.000Z',
    update_type: 'risk_shift',
    summary: 'Reflexivity risk increased as the asset became more dependent on attention loops between price, posting, and belief.',
    evidence_links: ['/signals/black-bull', '/narratives/attention-markets'],
    previous_score: 71,
    new_score: 82,
    analyst_note: 'High reflexivity is not automatically bearish, but it means the loop requires active monitoring.'
  },
  {
    update_id: 'seu_black_bull_005',
    signal_slug: 'black-bull',
    timestamp: '2026-06-28T18:20:00.000Z',
    update_type: 'verdict_change',
    summary: 'Infopunks classifies ANSEM / The Black Bull as a high-signal but high-reflexivity narrative asset.',
    evidence_links: ['/signals/black-bull', '/narratives/attention-markets'],
    previous_score: 74,
    new_score: 80,
    analyst_note: 'The report remains non-directional. This is not a buy/sell call. It is a signal map.'
  }
];

export function listSignalUpdates(signal_slug: string): SignalEvidenceUpdate[] {
  return signalEvidenceUpdates
    .filter((update) => update.signal_slug === signal_slug)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getSignalUpdate(signal_slug: string, update_id: string): SignalEvidenceUpdate | null {
  return signalEvidenceUpdates.find((update) => update.signal_slug === signal_slug && update.update_id === update_id) ?? null;
}

export function signalUpdateExists(signal_slug: string, update_id: string): boolean {
  return getSignalUpdate(signal_slug, update_id) !== null;
}

export function getLatestSignalUpdate(signal_slug: string): SignalEvidenceUpdate | null {
  return listSignalUpdates(signal_slug)[0] ?? null;
}

export function getSignalUpdateSummary(signal_slug: string): string {
  const latest = getLatestSignalUpdate(signal_slug);
  if (!latest) {
    return 'Evidence update summary: no evidence updates yet. Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.';
  }

  const scoreMovement = typeof latest.previous_score === 'number' && typeof latest.new_score === 'number'
    ? ` Score movement: ${latest.previous_score} -> ${latest.new_score}.`
    : '';

  return `Evidence update summary: ${latest.summary}${scoreMovement} Latest signal shift: ${latest.update_type}. Reflexivity monitoring remains active. Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.`;
}

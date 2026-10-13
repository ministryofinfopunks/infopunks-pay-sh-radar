import type { RhCategoryFinding, RhCategoryIntelligence } from './rhChainCategoryIntelligenceService';
import type { FrontdoorCard, FrontdoorSourceRef, OpenLoop } from './rh4663FrontdoorService';

export function observedMarketPresentation(market: RhCategoryIntelligence) {
  // First pass takes one per category, so breadth survives a large stock universe.
  const first = market.categories.flatMap(c => c.findings.slice(0, 1));
  const remaining = market.categories.flatMap(c => c.findings.slice(1));
  const ordered = [...first, ...remaining];
  const source = (f: RhCategoryFinding): FrontdoorSourceRef => ({ source_type: 'market_observation', source_id: f.observation.observation_id,
    href: f.observation.source.source_url ?? f.observation.history_href, observed_at: f.observation.observed_at });
  const label = (f: RhCategoryFinding) => market.categories.find(c => c.category === f.category)!.label;
  const now: FrontdoorCard[] = ordered.slice(0, 2).map(f => ({
    id: `observation:${f.token_contract}`, topic: label(f), headline: `${f.ticker || f.token_contract.slice(0, 10)} liquidity changed ${f.observation.metrics.liquidity_delta_pct}% over the observed hour.`,
    summary: f.evidence.state === 'INCOMPLETE' ? 'Market movement observed. Category evidence remains incomplete.' : 'Measured market activity with source-linked observations.',
    primary_metric: `$${f.observation.metrics.liquidity_usd.toLocaleString('en-US')} indexed liquidity`, delta: `${f.observation.coverage.sample_count} observations`,
    evidence_state: 'OBSERVED', freshness: f.observation.observed_at, source_type: 'market_observation', source_ref: source(f), deep_link: f.observation.investigation_href,
    priority_reason: 'Fresh, persisted exact-contract/pair measurement; no reviewed financial interpretation.'
  }));
  const incomplete = ordered.filter(f => f.evidence.state === 'INCOMPLETE');
  const watch: FrontdoorCard[] = incomplete.slice(0, 2).map(f => ({ id: `coverage:${f.token_contract}`, topic: `${label(f)} evidence`,
    headline: `${f.ticker || f.token_contract.slice(0, 10)} has ${f.evidence.missing_inputs.length} category evidence ${f.evidence.missing_inputs.length === 1 ? 'gap' : 'gaps'}.`, summary: f.evidence.missing_inputs.join(', '),
    primary_metric: 'Category score withheld', delta: null, evidence_state: 'INSUFFICIENT_DATA', freshness: f.observation.observed_at,
    source_type: 'market_observation', source_ref: source(f), deep_link: f.evidence_href, priority_reason: 'Missing category evidence is surfaced before interpretation.' }));
  const loops: OpenLoop[] = incomplete.slice(0, 1).map(f => ({ loop_id: `market-coverage:${f.token_contract}`, question: `What evidence is still missing for ${f.ticker || f.token_contract.slice(0, 10)}?`,
    short_context: `${label(f)} observations are available; category interpretation remains blocked.`, source_type: 'market_observation', source_ref: source(f),
    state: 'BLOCKED_BY_DATA', opened_at: f.observation.observed_at, last_changed_at: f.observation.observed_at, expected_checkpoint_at: null, expected_resolution_at: null,
    progress: { type: 'COUNT', numerator: Object.values(f.evidence.inputs).filter(Boolean).length, denominator: Object.keys(f.evidence.inputs).length, label: 'Category input coverage' },
    current_evidence: `${f.observation.coverage.sample_count} exact-pair observations.`, next_evidence_needed: f.evidence.missing_inputs.join(', '),
    resolution_condition: 'All category-required observations are present and fresh. This closes an input gap only.', falsification_condition: 'Contract or pair identity disagrees with the source observations.',
    deep_link: f.evidence_href, priority_reason: 'A derived coverage checkpoint; it cannot publish a reviewed conclusion or authorize execution.' }));
  return { now, watch, loops, refs: ordered.map(source) };
}

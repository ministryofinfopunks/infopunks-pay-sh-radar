import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { getNarrativeMetadataForPath, NARRATIVE_PUBLIC_HOST } from '../shared/narrativeMetadata';

type NarrativeDecisionState = 'strong_signal' | 'supportive_watch' | 'durable_re_index' | 'watch_closely' | 'concentrated_power' | 'high_reflexivity' | 'unproven' | 'do_not_chase';

type NarrativeEvidenceArtifact = {
  label: string;
  note: string;
  href?: string;
};

type NarrativeRelatedRoute = {
  label: string;
  href: string;
};

type NarrativeAsset = {
  id: string;
  slug: string;
  ticker: string;
  name: string;
  chain: string;
  category: string;
  thesis: string;
  signal_source: string;
  attention_velocity_score: number;
  myth_coherence_score: number;
  centralization_risk_score: number;
  reflexivity_risk_score: number;
  kol_dependency_score: number;
  trench_contagion_score: number;
  sovereignty_score: number;
  infopunk_verdict: string;
  evidence_artifacts: NarrativeEvidenceArtifact[];
  related_routes: NarrativeRelatedRoute[];
  last_updated: string;
};

type NarrativeSignalCard = {
  id: string;
  title: string;
  score: number | string;
  short_explanation: string;
  evidence_note: string;
  decision_state: NarrativeDecisionState;
};

type NarrativeSignalSection = {
  id: string;
  title: string;
  body: string;
  card_ids: string[];
};

type NarrativeSignalSurface = {
  slug: string;
  type: 'signal_source' | 'signal_report';
  title: string;
  subtitle: string;
  thesis: string;
  disclaimer: string;
  signal_source: string;
  asset_slug: string | null;
  last_updated: string;
  infopunk_verdict?: string;
  verdict_label?: string;
  verdict_state?: string;
  verdict_copy?: string;
  cards: NarrativeSignalCard[];
  sections: NarrativeSignalSection[];
  asset?: NarrativeAsset;
};

type SignalEvidenceUpdateType = 'attention_shift' | 'holder_shift' | 'myth_shift' | 'risk_shift' | 'verdict_change';

type SignalEvidenceUpdate = {
  update_id: string;
  signal_slug: string;
  timestamp: string;
  update_type: SignalEvidenceUpdateType;
  summary: string;
  evidence_links: string[];
  previous_score?: number;
  new_score?: number;
  analyst_note: string;
  risk_facets?: SignalRiskFacet[];
};

type SignalEvidenceUpdateResponse = {
  signal_slug: string;
  count: number;
  updates: SignalEvidenceUpdate[];
  latest_update: SignalEvidenceUpdate | null;
  summary: string;
};

type SignalEvidenceUpdateDetailResponse = {
  signal_slug: string;
  update: SignalEvidenceUpdate;
};

type SignalDeskStatus = 'live_watch' | 'seeded_report' | 'needs_review';
type SignalRiskFacet = 'high_reflexivity' | 'power_concentration' | 'unproven_sovereignty' | 'kol_dependency' | 'thin_evidence' | 'narrative_fatigue' | 'live_watch';

type SignalDeskReportCard = {
  slug: string;
  ticker: string;
  name: string;
  category: string;
  thesis: string;
  href: string;
  verdict_label?: string;
  verdict_state?: string;
  signal_strength: number;
  myth_coherence: number;
  reflexivity_risk: number;
  sovereignty_score: number;
  risk_facets: SignalRiskFacet[];
  desk_status: SignalDeskStatus;
  latest_update_type?: SignalEvidenceUpdateType;
  latest_update_at?: string;
  update_count: number;
};

type SignalDeskDispatchCard = {
  update_id: string;
  signal_slug: string;
  signal_name: string;
  ticker: string;
  update_type: SignalEvidenceUpdateType;
  readable_update_type: string;
  timestamp: string;
  summary: string;
  analyst_note: string;
  href: string;
  og_image: string;
  risk_facets: SignalRiskFacet[];
  previous_score?: number;
  new_score?: number;
  signal_delta?: number;
};

type SignalDeskActivityType = 'report_published' | 'dispatch_published' | 'risk_shift' | 'verdict_change' | 'candidate_promoted' | 'metadata_updated' | 'og_card_generated';

type SignalDeskActivityItem = {
  id: string;
  type: SignalDeskActivityType;
  timestamp: string;
  title: string;
  summary: string;
  href: string;
};

type SignalDeskIndex = {
  generated_at: string;
  desk_status: SignalDeskStatus;
  counts: {
    reports: number;
    dispatches: number;
    risk_shifts: number;
    watched_signals: number;
  };
  candidate_signals: CandidateSignal[];
  candidate_counts: {
    total: number;
    queued: number;
    watching: number;
    needs_evidence: number;
    under_review: number;
    promoted_to_report: number;
  };
  featured_report: SignalDeskReportCard | null;
  reports: SignalDeskReportCard[];
  latest_dispatches: SignalDeskDispatchCard[];
  risk_shifts: SignalDeskDispatchCard[];
  desk_activity: SignalDeskActivityItem[];
};

type CandidateSignalCategory = 'attention_market' | 'meme_asset' | 'agentic_narrative' | 'depin_signal' | 'kol_signal' | 'market_myth' | 'unknown';
type CandidateSignalStatus = 'queued' | 'watching' | 'needs_evidence' | 'under_review' | 'rejected' | 'promoted_to_report';
type CandidateSignalPriority = 'low' | 'medium' | 'high';
type CandidateSignalRiskLevel = 'low' | 'medium' | 'high' | 'unknown';

type CandidateSignal = {
  candidate_id: string;
  name: string;
  ticker?: string;
  chain?: string;
  category: CandidateSignalCategory;
  submitted_by: 'desk' | 'community' | 'system';
  status: CandidateSignalStatus;
  priority: CandidateSignalPriority;
  risk_level: CandidateSignalRiskLevel;
  risk_facets: SignalRiskFacet[];
  summary: string;
  why_it_matters: string;
  evidence_links: string[];
  created_at: string;
  updated_at: string;
};

type AttentionMarketCategory = 'persona_coin' | 'influencer_attention' | 'dev_attention' | 'ai_agent_attention' | 'community_archetype' | 'streamer_signal' | 'reply_gang' | 'anonymous_cult';
type AttentionSourceType = 'influencer' | 'dev' | 'ai_agent' | 'community_archetype' | 'streamer' | 'reply_gang' | 'anonymous_cult';
type AttentionMarketVerdict = 'attention_arbitrage' | 'extraction_risk' | 'cult_sludge' | 're_index_watch' | 'movement_candidate' | 'signal_market_candidate' | 'supportive_watch';

type AttentionMarketSignal = {
  id: string;
  slug: string;
  ticker: string;
  name: string;
  category: AttentionMarketCategory;
  attention_source: {
    type: AttentionSourceType;
    label: string;
    summary: string;
  };
  control_risk: {
    score: number;
    summary: string;
    factors: string[];
  };
  coherence_score: {
    score: number;
    summary: string;
  };
  receipt_layer: {
    score: number;
    summary: string;
    evidence_links: string[];
  };
  fragmentation_risk: {
    score: number;
    summary: string;
  };
  evolution_verdict: AttentionMarketVerdict;
  verdict_label: string;
  verdict_copy: string;
  risk_facets: SignalRiskFacet[];
  related_signal_slug?: string;
  href: string;
  updated_at: string;
};

type AttentionMarketWatchIndex = {
  generated_at: string;
  count: number;
  verdict_counts: Record<string, number>;
  signals: AttentionMarketSignal[];
};

type AttentionMarketWatchDetail = {
  signal: AttentionMarketSignal;
};

type AttentionMarketIntakeStatus = 'staged' | 'needs_evidence' | 'under_review' | 'rejected' | 'promoted_to_watch_profile';

type AttentionMarketIntakeSubmission = {
  intake_id: string;
  submitted_at: string;
  status: AttentionMarketIntakeStatus;
  ticker: string;
  name: string;
  chain?: string;
  attention_source_type: AttentionSourceType | 'unknown';
  attention_source_label?: string;
  submitter_handle?: string;
  why_it_matters: string;
  evidence_links: string[];
  default_evidence_requirements: string[];
  default_risk_facets: SignalRiskFacet[];
  intake_note: string;
};

type AttentionMarketIntakeRequirements = {
  requirements: string[];
  default_risk_facets: SignalRiskFacet[];
  disclaimer: string;
};

type AttentionMarketIntakeForm = {
  ticker: string;
  name: string;
  chain: string;
  attention_source_type: AttentionSourceType | 'unknown';
  attention_source_label: string;
  submitter_handle: string;
  why_it_matters: string;
  evidence_links: string;
};

type NarrativeFilterUpdateType = 'all' | SignalEvidenceUpdateType;
type NarrativeFilterRisk = 'all' | SignalRiskFacet;
type NarrativeFilterStatus = 'all' | SignalDeskStatus;

type NarrativeIntakeForm = {
  narrativeName: string;
  tickerOrTag: string;
  chain: string;
  whyItMatters: string;
  evidenceLinks: string;
  submitterHandle: string;
};

const NARRATIVE_METHOD_STEPS = [
  'Detect Narrative Asset',
  'Map Signal Source',
  'Score Attention Velocity',
  'Check Power Concentration',
  'Track Reflexivity Risk',
  'Publish Versioned Evidence Updates'
] as const;

const BLACK_BULL_SHARE_LINES = [
  "Ansem's airdrop turns $ANSEM from a pure attention object into a visible trench-coordination event. Infopunks marks it Supportive Watch.",
  "$ANSEM is the market asking how much Ansem's attention is worth. Infopunks is asking who understands attention before it becomes price.",
  'Infopunks do not worship signal. Infopunks map signal.',
  'Solana is entering the attention-market era. Personas become liquidity. Memes become coordination rails.',
  'Reports are not final. Signals mutate.',
  'Infopunks Radar is watching the narratives that become markets.'
] as const;

const API_BASE_URL = getApiBaseUrl();

async function api<T>(path: string) {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

async function postApi<T>(path: string, body: unknown) {
  const response = await fetch(toApiUrl(API_BASE_URL, path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<{ data: T }>;
}

function canonicalUrl(path: string) {
  return `${NARRATIVE_PUBLIC_HOST}${path}`;
}

function setMetaTag(attr: 'property' | 'name', key: string, content: string) {
  let node = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let node = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
}

function updateNarrativeMetadata({
  title,
  description,
  canonicalPath,
  imageUrl,
  type
}: {
  title: string;
  description: string;
  canonicalPath: string;
  imageUrl: string | null;
  type: 'website' | 'article';
}) {
  const url = canonicalUrl(canonicalPath);
  document.title = title;
  setMetaTag('name', 'description', description);
  setMetaTag('property', 'og:type', type);
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:url', url);
  if (imageUrl) {
    setMetaTag('property', 'og:image', imageUrl);
    setMetaTag('property', 'og:image:width', '1200');
    setMetaTag('property', 'og:image:height', '630');
    setMetaTag('name', 'twitter:image', imageUrl);
  }
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setCanonicalLink(url);
}

function syncNarrativeMetadata(pathname: string) {
  const metadata = getNarrativeMetadataForPath(pathname);
  if (!metadata) return;
  updateNarrativeMetadata({
    title: metadata.title,
    description: metadata.description,
    canonicalPath: metadata.canonicalPath,
    imageUrl: metadata.ogImageUrl,
    type: 'website'
  });
}

async function copyText(value: string) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function isNotFoundError(error: unknown) {
  return error instanceof Error && error.message.endsWith(' 404');
}

function stateLabel(value: NarrativeDecisionState) {
  if (value === 'durable_re_index') return 'Durable Re-index';
  if (value === 'supportive_watch') return 'Supportive Watch';
  return value.replaceAll('_', ' ');
}

function formatScore(value: number | string) {
  return typeof value === 'number' ? `${value}/100` : value;
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}

function formatDeskStatus(value: SignalDeskStatus) {
  return value.split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function formatCandidateCategory(value: CandidateSignalCategory) {
  return value.split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function formatCandidateStatus(value: CandidateSignalStatus) {
  return value.split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function formatCandidatePriority(value: CandidateSignalPriority) {
  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)} Priority`;
}

function formatCandidateRiskLevel(value: CandidateSignalRiskLevel) {
  return value === 'unknown'
    ? 'Unknown Risk'
    : `${value[0]?.toUpperCase() ?? ''}${value.slice(1)} Risk`;
}

function formatAttentionCategory(value: AttentionMarketCategory) {
  return value.split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function formatAttentionVerdict(value: AttentionMarketVerdict) {
  return value.split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function formatRiskFacet(value: SignalRiskFacet) {
  return value.split('_').map((part) => {
    if (part.toLowerCase() === 'kol') return 'KOL';
    return `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`;
  }).join(' ');
}

function updateTypeFilterLabel(value: NarrativeFilterUpdateType) {
  return value === 'all' ? 'All' : signalUpdateTypeLabel(value);
}

function riskFilterLabel(value: NarrativeFilterRisk) {
  return value === 'all' ? 'All' : formatRiskFacet(value);
}

function signalUpdateTypeLabel(value: SignalEvidenceUpdateType) {
  switch (value) {
    case 'attention_shift':
      return 'Attention Shift';
    case 'holder_shift':
      return 'Holder / Power Shift';
    case 'myth_shift':
      return 'Myth Shift';
    case 'risk_shift':
      return 'Risk Shift';
    case 'verdict_change':
      return 'Verdict Change';
  }
}

function signalDelta(update: SignalEvidenceUpdate) {
  if (typeof update.previous_score !== 'number' || typeof update.new_score !== 'number') return null;
  const delta = update.new_score - update.previous_score;
  const prefix = delta > 0 ? '+' : '';
  return {
    value: delta,
    label: `${prefix}${delta}`,
    trajectory: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  };
}

function deskStatus(signal: NarrativeSignalSurface, updateCount: number) {
  if (updateCount > 0) return 'Live Watch';
  if (signal.type === 'signal_report') return 'Seeded Report';
  return 'Needs Review';
}

function reportSearchText(report: SignalDeskReportCard) {
  return [
    report.ticker,
    report.name,
    report.category,
    report.thesis,
    report.latest_update_type ? signalUpdateTypeLabel(report.latest_update_type) : '',
    formatDeskStatus(report.desk_status)
  ].join(' ').toLowerCase();
}

function dispatchSearchText(dispatch: SignalDeskDispatchCard) {
  return [
    dispatch.ticker,
    dispatch.signal_name,
    dispatch.summary,
    dispatch.analyst_note,
    dispatch.readable_update_type
  ].join(' ').toLowerCase();
}

function reportMatchesRisk(report: SignalDeskReportCard, risk: NarrativeFilterRisk) {
  if (risk === 'all') return true;
  return report.risk_facets.includes(risk);
}

function dispatchMatchesRisk(dispatch: SignalDeskDispatchCard, _deskStatusBySignal: Map<string, SignalDeskStatus>, risk: NarrativeFilterRisk) {
  if (risk === 'all') return true;
  return dispatch.risk_facets.includes(risk);
}

function dispatchMatchesStatus(dispatch: SignalDeskDispatchCard, deskStatusBySignal: Map<string, SignalDeskStatus>, status: NarrativeFilterStatus) {
  if (status === 'all') return true;
  return deskStatusBySignal.get(dispatch.signal_slug) === status;
}

function reportMatchesFilters(report: SignalDeskReportCard, filters: { updateType: NarrativeFilterUpdateType; risk: NarrativeFilterRisk; status: NarrativeFilterStatus; search: string }) {
  const search = filters.search.trim().toLowerCase();
  if (filters.updateType !== 'all' && report.latest_update_type !== filters.updateType) return false;
  if (filters.status !== 'all' && report.desk_status !== filters.status) return false;
  if (!reportMatchesRisk(report, filters.risk)) return false;
  if (search && !reportSearchText(report).includes(search)) return false;
  return true;
}

function dispatchMatchesFilters(dispatch: SignalDeskDispatchCard, deskStatusBySignal: Map<string, SignalDeskStatus>, filters: { updateType: NarrativeFilterUpdateType; risk: NarrativeFilterRisk; status: NarrativeFilterStatus; search: string }) {
  const search = filters.search.trim().toLowerCase();
  if (filters.updateType !== 'all' && dispatch.update_type !== filters.updateType) return false;
  if (!dispatchMatchesStatus(dispatch, deskStatusBySignal, filters.status)) return false;
  if (!dispatchMatchesRisk(dispatch, deskStatusBySignal, filters.risk)) return false;
  if (search && !dispatchSearchText(dispatch).includes(search)) return false;
  return true;
}

function candidateMatchesFilters(candidate: CandidateSignal, filters: { risk: NarrativeFilterRisk; search: string }) {
  const search = filters.search.trim().toLowerCase();
  if (filters.risk !== 'all' && !candidate.risk_facets.includes(filters.risk)) return false;
  const haystack = [
    candidate.name,
    candidate.ticker ?? '',
    candidate.chain ?? '',
    candidate.summary,
    candidate.why_it_matters,
    formatCandidateCategory(candidate.category)
  ].join(' ').toLowerCase();
  if (search && !haystack.includes(search)) return false;
  return true;
}

function EvidenceChip({ href }: { href: string }) {
  return <a className="narrative-evidence-chip" href={href}>{href}</a>;
}

function RiskFacetChip({ facet }: { facet: SignalRiskFacet }) {
  return <span className={`narrative-evidence-chip narrative-risk-facet facet-${facet}`}>{formatRiskFacet(facet)}</span>;
}

function SignalUpdateScoreDelta({ update }: { update: SignalEvidenceUpdate }) {
  const delta = signalDelta(update);
  if (!delta) return null;

  return <div className={`narrative-signal-delta ${delta.trajectory}`}>
    <span>Signal Delta</span>
    <strong>{update.previous_score} → {update.new_score} ({delta.label})</strong>
  </div>;
}

function verdictLabelToState(verdictLabel: string): NarrativeDecisionState {
  if (verdictLabel === 'DURABLE RE-INDEX') return 'durable_re_index';
  if (verdictLabel === 'SUPPORTIVE WATCH') return 'supportive_watch';
  return 'watch_closely';
}

function DeskDispatchCard({
  signalName,
  updateType,
  verdictLabel
}: {
  signalName: string;
  updateType: SignalEvidenceUpdateType;
  verdictLabel?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = verdictLabel
    ? `Infopunks Signal Update: ${verdictLabel} issued for ${signalName}. Reports are not final. Signals mutate.`
    : `Infopunks Signal Update: ${signalUpdateTypeLabel(updateType)} detected for ${signalName}. Reports are not final. Signals mutate.`;

  async function handleCopy() {
    const copied = await copyText(copy);
    setState(copied ? 'copied' : 'failed');
    window.setTimeout(() => setState('idle'), 1400);
  }

  const buttonLabel = state === 'copied' ? 'Copied' : state === 'failed' ? 'Failed to copy' : 'Copy Dispatch';

  return <section className="panel narrative-desk-dispatch" aria-label="Desk Dispatch">
    <div className="narrative-desk-dispatch-head">
      <div>
        <p className="section-kicker">Share-ready copy</p>
        <h2>Desk Dispatch</h2>
      </div>
      <button className="copy-chip" type="button" onClick={handleCopy} aria-label="Copy Desk Dispatch" aria-live="polite">{buttonLabel}</button>
    </div>
    {verdictLabel && <div className="chips narrative-update-chips">
      <span className={`narrative-decision-pill state-${verdictLabelToState(verdictLabel)}`}>{verdictLabel}</span>
    </div>}
    <p className="narrative-desk-dispatch-copy">{copy}</p>
  </section>;
}

function SignalUpdateNotFound({ slug }: { slug: string }) {
  return <div className="shell narrative-shell">
    <main className="narrative-page" aria-label="Signal update not found">
      <section className="panel narrative-update-not-found">
        <p className="section-kicker">Narrative desk</p>
        <h1>Signal update not found.</h1>
        <p>This permalink does not match a known versioned evidence update.</p>
        <div className="panel-actions">
          <a className="execute" href={`/signals/${slug}`}>Back to signal</a>
          <a className="execute compact secondary" href="/narratives">Back to narratives</a>
        </div>
      </section>
    </main>
  </div>;
}

function LatestDeskUpdateChip({ latestUpdate }: { latestUpdate: SignalEvidenceUpdate | null }) {
  if (!latestUpdate) return null;

  return <section className="panel narrative-desk-chip" aria-label="Latest desk update">
    <div className="narrative-desk-chip-head">
      <div>
        <p className="section-kicker">Latest Desk Update</p>
        <h2>{signalUpdateTypeLabel(latestUpdate.update_type)}</h2>
      </div>
      <span className={`narrative-update-badge type-${latestUpdate.update_type}`}>{signalUpdateTypeLabel(latestUpdate.update_type)}</span>
    </div>
    <p>{latestUpdate.summary}</p>
    <div className="narrative-desk-chip-meta">
      <span>{formatDate(latestUpdate.timestamp)}</span>
      <a className="execute compact secondary" href="#living-evidence-feed">Open Living Evidence Feed</a>
    </div>
  </section>;
}

function ReportFreshnessCard({ surface, updateCount, latestUpdate }: {
  surface: NarrativeSignalSurface;
  updateCount: number;
  latestUpdate: SignalEvidenceUpdate | null;
}) {
  const status = deskStatus(surface, updateCount);

  return <article className="panel narrative-freshness-card" aria-label="Report freshness card">
    <div className="narrative-freshness-head">
      <div>
        <p className="section-kicker">Report Freshness</p>
        <h2>{status}</h2>
      </div>
      <span className="source-badge">{status}</span>
    </div>
    <div className="narrative-freshness-grid">
      <div><span>Last updated</span><strong>{formatDate(surface.last_updated)}</strong></div>
      <div><span>Evidence updates</span><strong>{updateCount}</strong></div>
      <div><span>Latest update type</span><strong>{latestUpdate ? signalUpdateTypeLabel(latestUpdate.update_type) : 'No updates'}</strong></div>
      <div><span>Desk status</span><strong>{status}</strong></div>
    </div>
  </article>;
}

function LivingEvidenceFeed({ updates, latestUpdate, summary }: {
  updates: SignalEvidenceUpdate[];
  latestUpdate: SignalEvidenceUpdate | null;
  summary: string;
}) {
  return <section id="living-evidence-feed" className="panel narrative-living-feed" aria-label="Living Evidence Feed">
    <div className="narrative-living-feed-head">
      <div>
        <p className="section-kicker">Living desk</p>
        <h2>Living Evidence Feed</h2>
        <p>Versioned updates tracking how the narrative changes over time.</p>
      </div>
      {latestUpdate && <span className={`narrative-update-badge type-${latestUpdate.update_type}`}>{signalUpdateTypeLabel(latestUpdate.update_type)}</span>}
    </div>
    <p className="narrative-feed-rally">Reports are not final. Signals mutate.</p>
    <p className="narrative-feed-summary">{summary}</p>
    {!updates.length && <div className="narrative-feed-empty">
      <p className="section-kicker">Static report mode</p>
      <p>No versioned evidence updates yet. This signal remains in static report mode.</p>
    </div>}
    {!!updates.length && <div className="timeline narrative-update-timeline">
      {updates.map((update) => {
        const delta = signalDelta(update);
        return <article key={update.update_id} className="panel narrative-update-card">
          <div className="narrative-update-head">
            <div>
              <p className="section-kicker">{formatDate(update.timestamp)}</p>
              <h3>{signalUpdateTypeLabel(update.update_type)}</h3>
            </div>
            <span className={`narrative-update-badge type-${update.update_type}`}>{signalUpdateTypeLabel(update.update_type)}</span>
          </div>
          <p>{update.summary}</p>
          {delta && <SignalUpdateScoreDelta update={update} />}
          <p className="narrative-analyst-note"><b>Analyst note:</b> {update.analyst_note}</p>
          <div className="panel-actions">
            <a className="execute compact secondary" href={`/signals/${update.signal_slug}/updates/${update.update_id}`}>Open Dispatch</a>
          </div>
          <div className="chips narrative-update-chips">
            {update.evidence_links.map((href) => <EvidenceChip key={`${update.update_id}-${href}`} href={href} />)}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

function NarrativeMethodModule() {
  return <section className="panel narrative-method-module" aria-label="Narrative Asset Intelligence Method">
    <div className="narrative-method-head">
      <div>
        <p className="section-kicker">Desk method</p>
        <h2>Narrative Asset Intelligence Method</h2>
        <p>Narrative Asset Intelligence treats attention, myth, wallet power, and reflexivity as one evidence desk.</p>
      </div>
    </div>
    <div className="narrative-method-grid">
      {NARRATIVE_METHOD_STEPS.map((step, index) => <article key={step} className="panel narrative-method-step">
        <p className="section-kicker">Step {index + 1}</p>
        <h3>{step}</h3>
      </article>)}
    </div>
  </section>;
}

function DeskStatusStrip({ desk }: { desk: SignalDeskIndex }) {
  const stats = [
    ['Reports', desk.counts.reports],
    ['Dispatches', desk.counts.dispatches],
    ['Risk Shifts', desk.counts.risk_shifts],
    ['Watched Signals', desk.counts.watched_signals],
    ['Candidates', desk.candidate_counts.total],
    ['Desk Status', formatDeskStatus(desk.desk_status)]
  ] as const;

  return <section className="panel narrative-desk-status" aria-label="Desk Status Strip">
    <div className="narrative-desk-status-head">
      <div>
        <p className="section-kicker">Desk status</p>
        <h2>Live Watch</h2>
      </div>
      <span className="source-badge">{formatDate(desk.generated_at)}</span>
    </div>
    <div className="narrative-desk-status-grid">
      {stats.map(([label, value]) => <article key={label} className="narrative-desk-stat">
        <span>{label}</span>
        <strong>{value}</strong>
      </article>)}
    </div>
  </section>;
}

function NarrativeControlStrip({
  updateType,
  risk,
  status,
  search,
  onUpdateTypeChange,
  onRiskChange,
  onStatusChange,
  onSearchChange
}: {
  updateType: NarrativeFilterUpdateType;
  risk: NarrativeFilterRisk;
  status: NarrativeFilterStatus;
  search: string;
  onUpdateTypeChange: (value: NarrativeFilterUpdateType) => void;
  onRiskChange: (value: NarrativeFilterRisk) => void;
  onStatusChange: (value: NarrativeFilterStatus) => void;
  onSearchChange: (value: string) => void;
}) {
  return <section className="panel narrative-control-strip" aria-label="Narrative filters">
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Desk filters</p>
        <h2>Analyst Control Strip</h2>
        <p>Filter live desk outputs without changing the underlying report or dispatch routes.</p>
      </div>
    </div>
    <div className="narrative-control-grid">
      <label className="narrative-control-field">
        <span>Update Type</span>
        <select aria-label="Update Type Filter" value={updateType} onChange={(event) => onUpdateTypeChange(event.target.value as NarrativeFilterUpdateType)}>
          <option value="all">All</option>
          <option value="attention_shift">Attention Shift</option>
          <option value="holder_shift">Holder / Power Shift</option>
          <option value="myth_shift">Myth Shift</option>
          <option value="risk_shift">Risk Shift</option>
          <option value="verdict_change">Verdict Change</option>
        </select>
      </label>
      <label className="narrative-control-field">
        <span>Risk Facet</span>
        <select aria-label="Risk Facet Filter" value={risk} onChange={(event) => onRiskChange(event.target.value as NarrativeFilterRisk)}>
          <option value="all">All</option>
          <option value="high_reflexivity">High Reflexivity</option>
          <option value="power_concentration">Power Concentration</option>
          <option value="unproven_sovereignty">Unproven Sovereignty</option>
          <option value="kol_dependency">KOL Dependency</option>
          <option value="thin_evidence">Thin Evidence</option>
          <option value="narrative_fatigue">Narrative Fatigue</option>
          <option value="live_watch">Live Watch</option>
        </select>
      </label>
      <label className="narrative-control-field">
        <span>Signal Status</span>
        <select aria-label="Signal Status Filter" value={status} onChange={(event) => onStatusChange(event.target.value as NarrativeFilterStatus)}>
          <option value="all">All</option>
          <option value="live_watch">Live Watch</option>
          <option value="seeded_report">Seeded Report</option>
          <option value="needs_review">Needs Review</option>
        </select>
      </label>
      <label className="narrative-control-field narrative-control-search">
        <span>Search</span>
        <input
          aria-label="Search reports and dispatches"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Ticker, name, summary, analyst note, category, update type"
        />
      </label>
    </div>
    <div className="chips narrative-route-chips">
      <span className="narrative-evidence-chip">{updateTypeFilterLabel(updateType)}</span>
      <span className="narrative-evidence-chip">{riskFilterLabel(risk)}</span>
      <span className="narrative-evidence-chip">{status === 'all' ? 'All Statuses' : formatDeskStatus(status)}</span>
    </div>
  </section>;
}

function FeaturedNarrativeReport({ report, latestDispatchHref }: { report: SignalDeskReportCard; latestDispatchHref: string | null }) {
  return <section className="panel narrative-featured-report" aria-label="Featured ANSEM Black Bull report">
    <div className="narrative-featured-head">
      <div>
        <p className="section-kicker">Featured report</p>
        <h2>{report.ticker} / {report.name}</h2>
        <p>{report.thesis}</p>
      </div>
      <span className="source-badge">{formatDeskStatus(report.desk_status)}</span>
    </div>
    <div className="narrative-featured-metrics">
      <div>
        <span>Signal Strength</span>
        <strong>{report.signal_strength}</strong>
      </div>
      <div>
        <span>Myth Coherence</span>
        <strong>{report.myth_coherence}</strong>
      </div>
      <div>
        <span>Reflexivity Risk</span>
        <strong>{report.reflexivity_risk}</strong>
      </div>
      <div>
        <span>Sovereignty Score</span>
        <strong>{report.sovereignty_score}</strong>
      </div>
      <div>
        <span>Latest Update Type</span>
        <strong>{report.latest_update_type ? signalUpdateTypeLabel(report.latest_update_type) : 'No updates'}</strong>
      </div>
      <div>
        <span>Latest Update Timestamp</span>
        <strong>{report.latest_update_at ? formatDate(report.latest_update_at) : 'No updates'}</strong>
      </div>
    </div>
    <div className="chips narrative-update-chips">
      {report.risk_facets.map((facet) => <RiskFacetChip key={`${report.slug}-${facet}`} facet={facet} />)}
    </div>
    <div className="panel-actions">
      <a className="execute" href={report.href}>Open Signal Report</a>
      {latestDispatchHref
        ? <a className="execute compact secondary" href={latestDispatchHref}>Open Latest Dispatch</a>
        : <a className="execute compact secondary" href="/narratives/attention-markets">Open Latest Dispatch</a>}
    </div>
  </section>;
}

function ShareLinesModule() {
  return <section className="panel narrative-share-lines" aria-label="Share Lines">
    <div className="narrative-share-lines-head">
      <div>
        <p className="section-kicker">Field copy</p>
        <h2>Share Lines</h2>
      </div>
    </div>
    <div className="narrative-share-lines-grid">
      {BLACK_BULL_SHARE_LINES.map((line, index) => <article key={line} className="panel narrative-share-line-card">
        <p className="section-kicker">Line {index + 1}</p>
        <p>{line}</p>
      </article>)}
    </div>
  </section>;
}

function DoNotWorshipSignalCard() {
  return <section className="panel narrative-warning-card state-high_reflexivity" aria-label="Do Not Worship Signal">
    <div className="narrative-warning-head">
      <div>
        <p className="section-kicker">Sovereignty warning</p>
        <h2>Do Not Worship Signal</h2>
      </div>
      <span className="narrative-decision-pill state-high_reflexivity">high reflexivity</span>
    </div>
    <p>High signal does not mean low risk. Narrative assets can move fast because belief, liquidity, and attention reinforce each other. Infopunks maps the loop so readers do not get owned by it.</p>
  </section>;
}

function NarrativeLinkCluster({ links }: { links: Array<{ href: string; label: string }> }) {
  return <section className="panel narrative-link-cluster" aria-label="Related narrative routes">
    <p className="section-kicker">Desk links</p>
    <div className="chips narrative-route-chips">
      {links.map((link) => <a key={link.href} className="narrative-evidence-chip" href={link.href}>{link.label}</a>)}
    </div>
  </section>;
}

function NarrativeIntelNav({ current }: { current: string }) {
  const links = [
    { href: '/narratives', label: 'Narrative Intel' },
    { href: '/narratives/attention-markets', label: 'Attention Markets' },
    { href: '/narratives/attention-market-watch', label: 'Attention Market Watch' },
    { href: '/signals/ansem', label: 'Ansem' },
    { href: '/signals/black-bull', label: 'Black Bull' },
    { href: '/signals/troll', label: 'TROLL' }
  ];

  function isActive(href: string) {
    if (href === '/narratives/attention-market-watch') {
      return current === href || current.startsWith('/attention-market-watch/');
    }
    return current === href;
  }

  return <nav className="global-toolbar narrative-toolbar" aria-label="Narrative Intel navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Narrative Intel</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Narrative Intel routes">
      {links.map((link) => <a key={link.href} href={link.href} className={isActive(link.href) ? 'active' : ''} aria-current={isActive(link.href) ? 'page' : undefined}>{link.label}</a>)}
    </div>
    <div className="terminal-actions" aria-label="Narrative Intel quick links">
      <span className="terminal-action-cluster">
        <a className="methodology-trigger" href="/">Radar Home</a>
        <a className="methodology-trigger" href="/graph">Signal Graph</a>
      </span>
    </div>
  </nav>;
}

function NarrativeMetricCard({ card }: { card: NarrativeSignalCard }) {
  return <article className={`panel narrative-metric-card state-${card.decision_state}`}>
    <div className="narrative-metric-head">
      <p className="section-kicker">{card.title}</p>
      <span className={`narrative-decision-pill state-${card.decision_state}`}>{stateLabel(card.decision_state)}</span>
    </div>
    <strong>{formatScore(card.score)}</strong>
    <p>{card.short_explanation}</p>
    <small>Evidence note: {card.evidence_note}</small>
  </article>;
}

function NarrativeEvidenceList({ artifacts }: { artifacts: NarrativeEvidenceArtifact[] }) {
  return <div className="narrative-evidence-list">
    {artifacts.map((artifact) => <article key={artifact.label} className="panel narrative-evidence-card">
      <p className="section-kicker">{artifact.label}</p>
      <p>{artifact.note}</p>
      {artifact.href && <a href={artifact.href}>Open artifact</a>}
    </article>)}
  </div>;
}

function DispatchSection({
  title,
  subtitle,
  dispatches,
  ariaLabel
}: {
  title: string;
  subtitle: string;
  dispatches: SignalDeskDispatchCard[];
  ariaLabel: string;
}) {
  return <section className="panel narrative-desk-catalog" aria-label={ariaLabel}>
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Desk dispatches</p>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
    <div className="narrative-desk-catalog-grid">
      {!dispatches.length && <article className="panel narrative-update-card narrative-empty-state">
        <div className="narrative-update-head">
          <div>
            <p className="section-kicker">Filtered view</p>
            <h3>No matching dispatches</h3>
          </div>
        </div>
        <p>Adjust the analyst control strip to widen the desk view.</p>
      </article>}
      {dispatches.map((dispatch) => <article key={dispatch.update_id} className="panel narrative-update-card">
        <div className="narrative-update-head">
          <div>
            <p className="section-kicker">{dispatch.ticker} / {dispatch.signal_name}</p>
            <h3>{dispatch.readable_update_type}</h3>
          </div>
          <span className={`narrative-update-badge type-${dispatch.update_type}`}>{dispatch.readable_update_type}</span>
        </div>
        <p>{dispatch.summary}</p>
        <div className="chips narrative-update-chips">
          {dispatch.risk_facets.map((facet) => <RiskFacetChip key={`${dispatch.update_id}-${facet}`} facet={facet} />)}
        </div>
        {typeof dispatch.previous_score === 'number' && typeof dispatch.new_score === 'number' && <div className={`narrative-signal-delta ${(dispatch.signal_delta ?? 0) > 0 ? 'up' : (dispatch.signal_delta ?? 0) < 0 ? 'down' : 'flat'}`}>
          <span>Signal Delta</span>
          <strong>{dispatch.previous_score} → {dispatch.new_score} ({dispatch.signal_delta && dispatch.signal_delta > 0 ? '+' : ''}{dispatch.signal_delta ?? 0})</strong>
        </div>}
        <p className="narrative-analyst-note"><b>Analyst note:</b> {dispatch.analyst_note}</p>
        <div className="narrative-desk-card-meta">
          <span>{formatDate(dispatch.timestamp)}</span>
          <a className="execute compact secondary" href={dispatch.href}>Open Dispatch</a>
        </div>
      </article>)}
    </div>
  </section>;
}

function ReportCatalogCard({ report }: { report: SignalDeskReportCard }) {
  return <article className="panel narrative-asset-preview">
    <div className="narrative-asset-head">
      <div>
        <p className="section-kicker">{report.category}</p>
        <h2>{report.ticker} / {report.name}</h2>
      </div>
      <span className="source-badge">{formatDeskStatus(report.desk_status)}</span>
    </div>
    {report.verdict_label && <div className="chips narrative-update-chips">
      <span className={`narrative-decision-pill state-${report.verdict_state ?? 'watch_closely'}`}>{report.verdict_label}</span>
    </div>}
    <p>{report.thesis}</p>
    <div className="chips narrative-update-chips">
      {report.risk_facets.map((facet) => <RiskFacetChip key={`${report.slug}-${facet}`} facet={facet} />)}
    </div>
    <div className="narrative-asset-stats">
      <span>signal {report.signal_strength}</span>
      <span>myth {report.myth_coherence}</span>
      <span>reflexivity {report.reflexivity_risk}</span>
      <span>sovereignty {report.sovereignty_score}</span>
      <span>updates {report.update_count}</span>
    </div>
    <div className="narrative-desk-card-meta">
      <span>{report.latest_update_at ? formatDate(report.latest_update_at) : 'No updates yet'}</span>
      <span>{report.latest_update_type ? signalUpdateTypeLabel(report.latest_update_type) : 'Seeded report'}</span>
    </div>
    <div className="panel-actions">
      <a className="execute compact secondary" href={report.href}>Open Report</a>
    </div>
  </article>;
}

function CandidateSignalCard({ candidate }: { candidate: CandidateSignal }) {
  return <article className="panel narrative-candidate-card">
    <div className="narrative-asset-head">
      <div>
        <p className="section-kicker">{formatCandidateCategory(candidate.category)}</p>
        <h2>{candidate.ticker ? `${candidate.ticker} / ${candidate.name}` : candidate.name}</h2>
      </div>
      <span className="source-badge">{formatCandidateStatus(candidate.status)}</span>
    </div>
    <div className="narrative-asset-stats">
      <span>{formatCandidatePriority(candidate.priority)}</span>
      <span>{formatCandidateRiskLevel(candidate.risk_level)}</span>
      {candidate.chain && <span>{candidate.chain}</span>}
      <span>submitted by {candidate.submitted_by}</span>
    </div>
    <p>{candidate.summary}</p>
    <div className="chips narrative-update-chips">
      {candidate.risk_facets.map((facet) => <RiskFacetChip key={`${candidate.candidate_id}-${facet}`} facet={facet} />)}
    </div>
    <p className="narrative-candidate-why"><b>Why it matters:</b> {candidate.why_it_matters}</p>
    <div className="chips narrative-update-chips">
      {candidate.evidence_links.length
        ? candidate.evidence_links.map((href) => <EvidenceChip key={`${candidate.candidate_id}-${href}`} href={href} />)
        : <span className="narrative-evidence-chip">No linked evidence yet</span>}
    </div>
    <div className="panel-actions">
      <a className="execute compact secondary" href={`/v1/signal-desk/candidates/${candidate.candidate_id}`}>Track Candidate</a>
      {candidate.status === 'needs_evidence' && <a className="execute compact secondary" href="#submit-narrative-review">Needs Evidence</a>}
    </div>
  </article>;
}

function CandidateSignalsSection({ candidates, counts }: { candidates: CandidateSignal[]; counts: SignalDeskIndex['candidate_counts'] }) {
  return <section className="panel narrative-desk-catalog" aria-label="Candidate Signals">
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Desk queue</p>
        <h2>Candidate Signals</h2>
        <p>Signals waiting for evidence, review, or promotion into full reports.</p>
      </div>
      <span className="source-badge">{counts.total} tracked</span>
    </div>
    <p className="narrative-feed-summary">Mapped reports show what the desk has already processed. Candidate signals show what the desk is watching next.</p>
    <div className="narrative-desk-status-grid narrative-candidate-counts">
      <article className="narrative-desk-stat"><span>Queued</span><strong>{counts.queued}</strong></article>
      <article className="narrative-desk-stat"><span>Watching</span><strong>{counts.watching}</strong></article>
      <article className="narrative-desk-stat"><span>Needs Evidence</span><strong>{counts.needs_evidence}</strong></article>
      <article className="narrative-desk-stat"><span>Under Review</span><strong>{counts.under_review}</strong></article>
      <article className="narrative-desk-stat"><span>Promoted</span><strong>{counts.promoted_to_report}</strong></article>
    </div>
    <div className="narrative-desk-catalog-grid narrative-candidate-grid">
      {!candidates.length && <article className="panel narrative-candidate-card narrative-empty-state">
        <p className="section-kicker">Filtered view</p>
        <h2>No matching candidates</h2>
        <p>Current analyst filters exclude the watched queue.</p>
      </article>}
      {candidates.map((candidate) => <CandidateSignalCard key={candidate.candidate_id} candidate={candidate} />)}
    </div>
  </section>;
}

function SubmitNarrativeReviewCard() {
  const [form, setForm] = useState<NarrativeIntakeForm>({
    narrativeName: '',
    tickerOrTag: '',
    chain: '',
    whyItMatters: '',
    evidenceLinks: '',
    submitterHandle: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function setField<K extends keyof NarrativeIntakeForm>(key: K, value: NarrativeIntakeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedForm: NarrativeIntakeForm = {
      narrativeName: String(formData.get('narrative_name') ?? ''),
      tickerOrTag: String(formData.get('ticker_or_tag') ?? ''),
      chain: String(formData.get('chain') ?? ''),
      whyItMatters: String(formData.get('why_it_matters') ?? ''),
      evidenceLinks: String(formData.get('evidence_links') ?? ''),
      submitterHandle: String(formData.get('submitter_handle') ?? '')
    };
    setForm(submittedForm);
    const nextErrors: string[] = [];
    if (!submittedForm.narrativeName.trim()) nextErrors.push('Narrative name is required.');
    if (!submittedForm.whyItMatters.trim()) nextErrors.push('Why it matters is required.');
    const evidenceLinks = submittedForm.evidenceLinks.split('\n').map((item) => item.trim()).filter(Boolean);
    if (!evidenceLinks.length) nextErrors.push('At least one evidence link is required.');
    setErrors(nextErrors);
    if (nextErrors.length) {
      setSubmitted(false);
      return;
    }
    setSubmitted(true);
  }

  return <section id="submit-narrative-review" className="panel narrative-intake-card" aria-label="Submit Narrative for Desk Review">
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Desk intake</p>
        <h2>Submit Narrative for Desk Review</h2>
        <p>Submitting a narrative does not create a buy call. It adds a candidate for evidence review.</p>
      </div>
    </div>
    <form className="narrative-intake-form" onSubmit={handleSubmit}>
      <label className="narrative-control-field">
        <span>Narrative name</span>
        <input name="narrative_name" aria-label="Narrative name" value={form.narrativeName} onChange={(event) => setField('narrativeName', event.target.value)} />
      </label>
      <label className="narrative-control-field">
        <span>Ticker or tag optional</span>
        <input name="ticker_or_tag" aria-label="Ticker or tag optional" value={form.tickerOrTag} onChange={(event) => setField('tickerOrTag', event.target.value)} />
      </label>
      <label className="narrative-control-field">
        <span>Chain or ecosystem optional</span>
        <input name="chain" aria-label="Chain or ecosystem optional" value={form.chain} onChange={(event) => setField('chain', event.target.value)} />
      </label>
      <label className="narrative-control-field narrative-intake-wide">
        <span>Why it matters</span>
        <textarea name="why_it_matters" aria-label="Why it matters" value={form.whyItMatters} onChange={(event) => setField('whyItMatters', event.target.value)} rows={4} />
      </label>
      <label className="narrative-control-field narrative-intake-wide">
        <span>Evidence links</span>
        <textarea name="evidence_links" aria-label="Evidence links" value={form.evidenceLinks} onChange={(event) => setField('evidenceLinks', event.target.value)} rows={4} placeholder="One link per line" />
      </label>
      <label className="narrative-control-field">
        <span>Submitter handle optional</span>
        <input name="submitter_handle" aria-label="Submitter handle optional" value={form.submitterHandle} onChange={(event) => setField('submitterHandle', event.target.value)} />
      </label>
      <div className="panel-actions">
        <button className="execute" type="submit">Stage Submission</button>
      </div>
    </form>
    {errors.length > 0 && <div className="route-state error">{errors.join(' ')}</div>}
    {submitted && <div className="narrative-intake-confirmation">
      <p>Submission staged. Connect intake persistence to make this live.</p>
    </div>}
  </section>;
}

function DeskActivityTimeline({ items }: { items: SignalDeskActivityItem[] }) {
  return <section className="panel narrative-desk-activity" aria-label="Desk Activity Timeline">
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Desk activity</p>
        <h2>Desk Activity Timeline</h2>
        <p>Report launches, dispatches, risk shifts, and distribution surfaces in one restrained feed.</p>
      </div>
    </div>
    <div className="timeline narrative-update-timeline">
      {items.map((item) => <article key={item.id} className="panel narrative-activity-item">
        <div className="narrative-update-head">
          <div>
            <p className="section-kicker">{formatDate(item.timestamp)}</p>
            <h3>{item.title}</h3>
          </div>
          <span className="narrative-evidence-chip">{item.type.replaceAll('_', ' ')}</span>
        </div>
        <p>{item.summary}</p>
        <div className="panel-actions">
          <a className="execute compact secondary" href={item.href}>Open Activity</a>
        </div>
      </article>)}
    </div>
  </section>;
}

function AttentionWatchModule({ watch }: { watch: AttentionMarketWatchIndex }) {
  return <section className="panel narrative-desk-catalog attention-watch-module" aria-label="Attention Market Watch">
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Signal Desk Index</p>
        <h2>Attention Market Watch</h2>
        <p>Persona-backed markets are becoming their own asset class. Infopunks classifies the attention source, control risk, coherence, receipts, and fragmentation risk.</p>
      </div>
      <span className="source-badge">{watch.count} monitored</span>
    </div>
    <div className="narrative-desk-status-grid">
      {Object.entries(watch.verdict_counts).map(([verdict, count]) => <article key={verdict} className="narrative-desk-stat">
        <span>{formatAttentionVerdict(verdict as AttentionMarketVerdict)}</span>
        <strong>{count}</strong>
      </article>)}
    </div>
    <div className="panel-actions">
      <a className="execute" href="/narratives/attention-market-watch">Open Attention Market Watch</a>
      <a className="execute compact secondary" href="/narratives/attention-market-watch#intake">Submit Attention Market</a>
    </div>
  </section>;
}

function AttentionWatchSignalCard({ signal }: { signal: AttentionMarketSignal }) {
  const cta = signal.href === '/signals/black-bull' ? 'Open Signal' : 'Open Watch Profile';
  const evidenceLight = signal.slug === 'tjr' || signal.slug === 'luke' || signal.slug === 'superman';

  return <article className="panel narrative-asset-preview attention-watch-card">
    <div className="narrative-asset-head">
      <div>
        <p className="section-kicker">{formatAttentionCategory(signal.category)}</p>
        <h2>{signal.ticker} / {signal.name}</h2>
      </div>
      <span className="source-badge">{signal.verdict_label}</span>
    </div>
    {evidenceLight && <div className="chips narrative-update-chips">
      <span className="narrative-evidence-chip">Evidence-light profile</span>
      <span className="narrative-evidence-chip">Monitored, not endorsed</span>
    </div>}
    <p>{signal.attention_source.label}</p>
    <p>{signal.attention_source.summary}</p>
    <div className="narrative-asset-stats">
      <span>control {signal.control_risk.score}</span>
      <span>coherence {signal.coherence_score.score}</span>
      <span>receipts {signal.receipt_layer.score}</span>
      <span>fragmentation {signal.fragmentation_risk.score}</span>
    </div>
    <p>{signal.verdict_copy}</p>
    <div className="chips narrative-update-chips">
      {signal.risk_facets.map((facet) => <RiskFacetChip key={`${signal.slug}-${facet}`} facet={facet} />)}
    </div>
    <div className="panel-actions">
      <a className="execute compact secondary" href={signal.href}>{cta}</a>
    </div>
  </article>;
}

function AttentionMarketEvidenceRequirementsModule({ requirements }: { requirements: AttentionMarketIntakeRequirements }) {
  const publicLabels = [
    'Attention source',
    'Control points',
    'Coherence',
    'Receipt layer',
    'Fragmentation risk',
    'Evolution verdict candidate'
  ];

  return <section className="panel narrative-desk-catalog" aria-label="Evidence Requirements">
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Evidence Requirements</p>
        <h2>Evidence Requirements</h2>
      </div>
    </div>
    <div className="narrative-method-grid">
      {publicLabels.map((item) => <article key={item} className="panel narrative-method-step">
        <h3>{item}</h3>
      </article>)}
    </div>
    <div className="chips narrative-update-chips">
      {requirements.default_risk_facets.map((facet) => <RiskFacetChip key={`intake-${facet}`} facet={facet} />)}
    </div>
    <p className="narrative-rally-line">Before you follow the meta, check the receipts.</p>
  </section>;
}

function AttentionMarketIntakeCard({
  requirements
}: {
  requirements: AttentionMarketIntakeRequirements | null;
}) {
  const [form, setForm] = useState<AttentionMarketIntakeForm>({
    ticker: '',
    name: '',
    chain: '',
    attention_source_type: 'unknown',
    attention_source_label: '',
    submitter_handle: '',
    why_it_matters: '',
    evidence_links: ''
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submission, setSubmission] = useState<AttentionMarketIntakeSubmission | null>(null);
  const [requirementsOpen, setRequirementsOpen] = useState(false);

  function setField<K extends keyof AttentionMarketIntakeForm>(key: K, value: AttentionMarketIntakeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedForm: AttentionMarketIntakeForm = {
      ticker: String(formData.get('ticker') ?? ''),
      name: String(formData.get('name') ?? ''),
      chain: String(formData.get('chain') ?? ''),
      attention_source_type: (String(formData.get('attention_source_type') ?? 'unknown') as AttentionMarketIntakeForm['attention_source_type']) || 'unknown',
      attention_source_label: String(formData.get('attention_source_label') ?? ''),
      submitter_handle: String(formData.get('submitter_handle') ?? ''),
      why_it_matters: String(formData.get('why_it_matters') ?? ''),
      evidence_links: String(formData.get('evidence_links') ?? '')
    };
    setForm(submittedForm);
    const nextErrors: string[] = [];
    if (!submittedForm.ticker.trim()) nextErrors.push('Ticker is required.');
    if (!submittedForm.name.trim()) nextErrors.push('Name is required.');
    if (!submittedForm.why_it_matters.trim()) nextErrors.push('Why it matters is required.');
    setErrors(nextErrors);
    if (nextErrors.length) {
      setSubmission(null);
      return;
    }

    const payload = {
      ticker: submittedForm.ticker.trim(),
      name: submittedForm.name.trim(),
      chain: submittedForm.chain.trim() || undefined,
      attention_source_type: submittedForm.attention_source_type,
      attention_source_label: submittedForm.attention_source_label.trim() || undefined,
      submitter_handle: submittedForm.submitter_handle.trim() || undefined,
      why_it_matters: submittedForm.why_it_matters.trim(),
      evidence_links: submittedForm.evidence_links.split('\n').map((item) => item.trim()).filter(Boolean)
    };

    try {
      const response = await postApi<{ submission: AttentionMarketIntakeSubmission }>('/v1/attention-market-watch/intake', payload);
      setSubmission(response.data.submission);
      setErrors([]);
      setRequirementsOpen(true);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'attention_market_intake_unavailable']);
    }
  }

  return <section id="intake" className="panel narrative-intake-card" aria-label="Submit an Attention Market">
    <div className="narrative-desk-catalog-head">
      <div>
        <p className="section-kicker">Attention market intake</p>
        <h2>Submit an Attention Market</h2>
        <p>Got a persona coin, influencer token, reply-gang asset, or cult ticker entering the trenches? Stage it for evidence review.</p>
        <p>Submission does not create a report. It creates a candidate signal for evidence review.</p>
      </div>
    </div>
    <form className="narrative-intake-form" onSubmit={handleSubmit}>
      <label className="narrative-control-field">
        <span>Ticker</span>
        <input name="ticker" aria-label="Ticker" value={form.ticker} onChange={(event) => setField('ticker', event.target.value)} />
      </label>
      <label className="narrative-control-field">
        <span>Name</span>
        <input name="name" aria-label="Name" value={form.name} onChange={(event) => setField('name', event.target.value)} />
      </label>
      <label className="narrative-control-field">
        <span>Chain / ecosystem optional</span>
        <input name="chain" aria-label="Chain / ecosystem optional" value={form.chain} onChange={(event) => setField('chain', event.target.value)} />
      </label>
      <label className="narrative-control-field">
        <span>Attention source type</span>
        <select name="attention_source_type" aria-label="Attention source type" value={form.attention_source_type} onChange={(event) => setField('attention_source_type', event.target.value as AttentionMarketIntakeForm['attention_source_type'])}>
          <option value="unknown">Unknown</option>
          <option value="influencer">Influencer</option>
          <option value="dev">Dev</option>
          <option value="ai_agent">AI agent</option>
          <option value="community_archetype">Community archetype</option>
          <option value="streamer">Streamer</option>
          <option value="reply_gang">Reply gang</option>
          <option value="anonymous_cult">Anonymous cult</option>
        </select>
      </label>
      <label className="narrative-control-field">
        <span>Attention source label optional</span>
        <input name="attention_source_label" aria-label="Attention source label optional" value={form.attention_source_label} onChange={(event) => setField('attention_source_label', event.target.value)} />
      </label>
      <label className="narrative-control-field">
        <span>Submitter handle optional</span>
        <input name="submitter_handle" aria-label="Submitter handle optional" value={form.submitter_handle} onChange={(event) => setField('submitter_handle', event.target.value)} />
      </label>
      <label className="narrative-control-field narrative-intake-wide">
        <span>Why it matters</span>
        <textarea name="why_it_matters" aria-label="Why it matters" value={form.why_it_matters} onChange={(event) => setField('why_it_matters', event.target.value)} rows={4} />
      </label>
      <label className="narrative-control-field narrative-intake-wide">
        <span>Evidence links</span>
        <textarea name="evidence_links" aria-label="Evidence links" value={form.evidence_links} onChange={(event) => setField('evidence_links', event.target.value)} rows={4} placeholder="One link per line" />
      </label>
      <div className="panel-actions">
        <button className="execute" type="submit">Stage for Review</button>
        <button className="execute compact secondary" type="button" onClick={() => setRequirementsOpen((value) => !value)}>View Evidence Requirements</button>
      </div>
    </form>
    {errors.length > 0 && <div className="route-state error">{errors.join(' ')}</div>}
    {submission && <div className="narrative-intake-confirmation">
      <p>Submission staged for review. This is not an endorsement. The desk requires receipts before promotion.</p>
      <p><b>Staged intake id:</b> {submission.intake_id}</p>
      <p><b>Status:</b> {submission.status}</p>
      <p>{submission.intake_note}</p>
      <div className="chips narrative-update-chips">
        {submission.default_risk_facets.map((facet) => <RiskFacetChip key={`submission-${facet}`} facet={facet} />)}
      </div>
      <div className="narrative-evidence-list">
        {submission.default_evidence_requirements.map((requirement) => <article key={requirement} className="panel narrative-evidence-card">
          <p>{requirement}</p>
        </article>)}
      </div>
    </div>}
    {requirementsOpen && requirements && <div className="narrative-intake-requirements-inline">
      <div className="narrative-evidence-list">
        {requirements.requirements.map((requirement) => <article key={requirement} className="panel narrative-evidence-card">
          <p>{requirement}</p>
        </article>)}
      </div>
      <p className="panel-caption">{requirements.disclaimer}</p>
    </div>}
  </section>;
}

function AttentionMarketWatchIndexPageBody({
  watch,
  requirements
}: {
  watch: AttentionMarketWatchIndex;
  requirements: AttentionMarketIntakeRequirements | null;
}) {
  const verdicts: AttentionMarketVerdict[] = [
    'attention_arbitrage',
    'extraction_risk',
    'cult_sludge',
    're_index_watch',
    'movement_candidate',
    'signal_market_candidate',
    'supportive_watch'
  ];
  const ansem = watch.signals.find((signal) => signal.slug === 'ansem') ?? null;

  return <>
    <section className="panel hero narrative-hero">
      <div>
        <p className="eyebrow">Narrative Asset Intelligence</p>
        <h1>Attention Market Watch</h1>
        <p className="copy">Influencer coins are the first wave of persona-backed markets. Infopunks tracks the next layer: which narratives are real, which wallets are extracting, which communities are coherent, and which movements have receipts.</p>
        <p className="copy narrative-rally-line">Before you follow the meta, check the receipts.</p>
      </div>
      <div className="panel narrative-hero-rail">
        <p className="section-kicker">Category thesis</p>
        <p>Influencer coins say: Trust this person. Infopunks says: Trust the process that reveals what is worth trusting.</p>
      </div>
    </section>

    <section className="panel narrative-desk-catalog" aria-label="Classification Method">
      <div className="narrative-desk-catalog-head">
        <div>
          <p className="section-kicker">Classification Method</p>
          <h2>Classification Method</h2>
        </div>
      </div>
      <div className="narrative-method-grid">
        {['Attention Source', 'Control Risk', 'Coherence Score', 'Receipt Layer', 'Fragmentation Risk', 'Evolution Verdict'].map((item) => <article key={item} className="panel narrative-method-step">
          <h3>{item}</h3>
        </article>)}
      </div>
    </section>

    <section className="panel narrative-desk-catalog" aria-label="Verdict Types">
      <div className="narrative-desk-catalog-head">
        <div>
          <p className="section-kicker">Verdict Types</p>
          <h2>Verdict Types</h2>
        </div>
      </div>
      <div className="narrative-method-grid">
        {verdicts.map((verdict) => <article key={verdict} className="panel narrative-method-step">
          <h3>{formatAttentionVerdict(verdict)}</h3>
          <p>{watch.verdict_counts[verdict] ?? 0} tracked</p>
        </article>)}
      </div>
    </section>

    <section className="panel narrative-desk-catalog" aria-label="Watchlist">
      <div className="narrative-desk-catalog-head">
        <div>
          <p className="section-kicker">Watchlist</p>
          <h2>Watchlist</h2>
        </div>
      </div>
      <div className="narrative-grid">
        {watch.signals.map((signal) => <AttentionWatchSignalCard key={signal.slug} signal={signal} />)}
      </div>
    </section>

    {requirements && <AttentionMarketEvidenceRequirementsModule requirements={requirements} />}
    <AttentionMarketIntakeCard requirements={requirements} />

    {ansem && <section className="panel narrative-copy-panel" aria-label="Featured Case Study">
      <p className="section-kicker">Featured Case Study</p>
      <h2>ANSEM / The Black Bull</h2>
      <p>$ANSEM showed persona attention becoming a market. Attention Market Watch turns that event into a classification system.</p>
      <div className="panel-actions">
        <a className="execute" href="/signals/black-bull">Open Black Bull Signal Report</a>
      </div>
    </section>}
  </>;
}

function AttentionMarketWatchProfileCard({ label, score, body }: { label: string; score: string; body: string }) {
  return <article className="panel narrative-metric-card">
    <div className="narrative-metric-head">
      <p className="section-kicker">{label}</p>
      <span className="narrative-decision-pill state-watch_closely">{score}</span>
    </div>
    <p>{body}</p>
  </article>;
}

export function NarrativesIndexPage() {
  const [desk, setDesk] = useState<SignalDeskIndex | null>(null);
  const [attentionWatch, setAttentionWatch] = useState<AttentionMarketWatchIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateType, setUpdateType] = useState<NarrativeFilterUpdateType>('all');
  const [risk, setRisk] = useState<NarrativeFilterRisk>('all');
  const [status, setStatus] = useState<NarrativeFilterStatus>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    syncNarrativeMetadata('/narratives');
  }, []);

  useEffect(() => {
    api<SignalDeskIndex>('/v1/signal-desk')
      .then((response) => setDesk(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'signal_desk_unavailable'));
  }, []);

  useEffect(() => {
    api<AttentionMarketWatchIndex>('/v1/attention-market-watch')
      .then((response) => setAttentionWatch(response.data))
      .catch(() => undefined);
  }, []);

  const deskStatusBySignal = useMemo(() => {
    const next = new Map<string, SignalDeskStatus>();
    for (const report of desk?.reports ?? []) next.set(report.slug, report.desk_status);
    return next;
  }, [desk?.reports]);

  const filteredReports = useMemo(() => {
    return (desk?.reports ?? []).filter((report) => reportMatchesFilters(report, { updateType, risk, status, search }));
  }, [desk?.reports, risk, search, status, updateType]);

  const filteredLatestDispatches = useMemo(() => {
    return (desk?.latest_dispatches ?? []).filter((dispatch) => dispatchMatchesFilters(dispatch, deskStatusBySignal, { updateType, risk, status, search }));
  }, [desk?.latest_dispatches, deskStatusBySignal, risk, search, status, updateType]);

  const filteredRiskShifts = useMemo(() => {
    return (desk?.risk_shifts ?? []).filter((dispatch) => dispatchMatchesFilters(dispatch, deskStatusBySignal, { updateType, risk, status, search }));
  }, [desk?.risk_shifts, deskStatusBySignal, risk, search, status, updateType]);

  const filteredCandidates = useMemo(() => {
    return (desk?.candidate_signals ?? []).filter((candidate) => candidateMatchesFilters(candidate, { risk, search }));
  }, [desk?.candidate_signals, risk, search]);

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#narrative-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current="/narratives" />
    </header>
    <main id="narrative-content" className="narrative-page">
      <section className="panel hero narrative-hero">
        <div>
          <p className="eyebrow">Narrative Asset Intelligence</p>
          <h1>Narrative Asset Intelligence</h1>
          <p className="copy">Signal reports, evidence updates, and sovereignty checks for narratives that become markets.</p>
          <p className="copy narrative-rally-line">Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.</p>
          <div className="panel-actions">
            <a className="execute" href="/signals/black-bull">Open Signal Report</a>
            <a className="execute compact secondary" href="/narratives/attention-markets">Read Attention Markets Thesis</a>
          </div>
        </div>
        <div className="panel narrative-hero-rail">
          <p className="section-kicker">Desk stance</p>
          <p>Bloomberg-style cultural intelligence for memetic markets, compact enough for live watch and dispatch review.</p>
          <p>Personas can become liquidity. Memes can become coordination rails. Sovereignty checks still decide whether signal has durable shape.</p>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {desk && <>
        <DeskStatusStrip desk={desk} />
        <NarrativeControlStrip
          updateType={updateType}
          risk={risk}
          status={status}
          search={search}
          onUpdateTypeChange={setUpdateType}
          onRiskChange={setRisk}
          onStatusChange={setStatus}
          onSearchChange={setSearch}
        />
        {attentionWatch && <AttentionWatchModule watch={attentionWatch} />}
        {desk.featured_report && <FeaturedNarrativeReport
          report={desk.featured_report}
          latestDispatchHref={desk.latest_dispatches[0]?.href ?? null}
        />}
        <DispatchSection
          title="Latest Desk Dispatches"
          subtitle="Latest evidence updates from the desk. Reports are not final. Signals mutate."
          dispatches={filteredLatestDispatches}
          ariaLabel="Latest Desk Dispatches"
        />
        <DispatchSection
          title="Risk Shifts"
          subtitle="Power, reflexivity, and verdict changes that require sovereignty checks."
          dispatches={filteredRiskShifts}
          ariaLabel="Risk Shifts"
        />
        <section className="panel narrative-desk-catalog" aria-label="Reports Catalog">
          <div className="narrative-desk-catalog-head">
            <div>
              <p className="section-kicker">Report catalog</p>
              <h2>Reports Catalog</h2>
              <p>Every live report card on the desk, structured to scale beyond Black Bull.</p>
            </div>
          </div>
          <div className="narrative-grid">
            {!filteredReports.length && <article className="panel narrative-asset-preview narrative-empty-state">
              <p className="section-kicker">Filtered view</p>
              <h2>No matching reports</h2>
              <p>Current filters narrow the catalog below the active desk set.</p>
            </article>}
            {filteredReports.map((report) => <ReportCatalogCard key={report.slug} report={report} />)}
          </div>
        </section>
        <CandidateSignalsSection candidates={filteredCandidates} counts={desk.candidate_counts} />
        <SubmitNarrativeReviewCard />
        <NarrativeLinkCluster links={[
          { href: '/signals/black-bull', label: 'Black Bull Signal Report' },
          { href: '/signals/ansem', label: 'Ansem Signal Source' },
          { href: '/narratives/attention-markets', label: 'Attention Markets Thesis' }
        ]} />
        <DeskActivityTimeline items={desk.desk_activity} />
      </>}
    </main>
  </div>;
}

export function AttentionMarketsPage() {
  const bullets = [
    'personas can become liquidity',
    'memes can become coordination rails',
    'wallets can become myth objects',
    'attention velocity can precede price action',
    'narrative assets require sovereignty checks'
  ];

  useEffect(() => {
    syncNarrativeMetadata('/narratives/attention-markets');
  }, []);

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#attention-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current="/narratives/attention-markets" />
    </header>
    <main id="attention-content" className="narrative-page">
      <section className="panel hero narrative-hero">
        <div>
          <p className="eyebrow">Attention Markets</p>
          <h1>Attention Markets</h1>
          <p className="copy">Narrative markets are not just about price. They are about who gets to compress attention into a tradeable object first.</p>
        </div>
        <div className="panel narrative-hero-rail">
          <p className="section-kicker">Operational note</p>
          <p>Minimal hype. Evidence first. Watch the flow, the concentration, and the sovereignty gap.</p>
        </div>
      </section>

      <section className="narrative-grid" aria-label="Attention market theses">
        {bullets.map((item) => <article key={item} className="panel narrative-thesis-card">
          <p className="section-kicker">Infopunks thesis</p>
          <h2>{item}</h2>
          <p>{item === 'attention velocity can precede price action'
            ? 'Signal can arrive before conventional market consensus notices. Velocity itself becomes a data point.'
            : item === 'narrative assets require sovereignty checks'
              ? 'Before treating an asset as durable, check whether it can hold meaning without a single amplifier.'
              : 'Narrative compression can turn a social pattern into a market rail faster than fundamentals can catch up.'}</p>
        </article>)}
      </section>

      <NarrativeMethodModule />
    </main>
  </div>;
}

export function AttentionMarketWatchPage() {
  const [watch, setWatch] = useState<AttentionMarketWatchIndex | null>(null);
  const [requirements, setRequirements] = useState<AttentionMarketIntakeRequirements | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncNarrativeMetadata('/narratives/attention-market-watch');
  }, []);

  useEffect(() => {
    api<AttentionMarketWatchIndex>('/v1/attention-market-watch')
      .then((response) => setWatch(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'attention_market_watch_unavailable'));
  }, []);

  useEffect(() => {
    api<AttentionMarketIntakeRequirements>('/v1/attention-market-watch/intake/requirements')
      .then((response) => setRequirements(response.data))
      .catch(() => undefined);
  }, []);

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#attention-watch-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current="/narratives/attention-market-watch" />
    </header>
    <main id="attention-watch-content" className="narrative-page">
      {error && <section className="panel"><p className="route-state error">{error}</p></section>}
      {watch && <AttentionMarketWatchIndexPageBody watch={watch} requirements={requirements} />}
    </main>
  </div>;
}

export function AttentionMarketWatchProfilePage({ slug }: { slug: string }) {
  const [detail, setDetail] = useState<AttentionMarketWatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncNarrativeMetadata(`/attention-market-watch/${slug}`);
  }, [slug]);

  useEffect(() => {
    api<AttentionMarketWatchDetail>(`/v1/attention-market-watch/${encodeURIComponent(slug)}`)
      .then((response) => setDetail(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'attention_market_watch_profile_unavailable'));
  }, [slug]);

  const signal = detail?.signal ?? null;
  const profileStateCopy = signal && signal.slug === 'ansem'
    ? 'Linked signal report available.'
    : signal && (signal.receipt_layer.score <= 24 || signal.evolution_verdict === 'attention_arbitrage')
      ? 'Monitored derivative signal. Evidence-light profile. This attention-market object is not an endorsement.'
      : 'Profile under active watch.';

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#attention-watch-profile-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current={`/attention-market-watch/${slug}`} />
    </header>
    <main id="attention-watch-profile-content" className="narrative-page">
      {error && !signal && <section className="panel"><p className="route-state error">{error}</p></section>}
      {signal && <>
        <section className="panel hero narrative-hero">
          <div>
            <p className="eyebrow">Attention Market Profile</p>
            <h1>{signal.name}</h1>
            <p className="copy">${signal.ticker}</p>
            <p className="copy">{signal.verdict_copy}</p>
            <p className="copy">{profileStateCopy}</p>
            {(signal.slug === 'tjr' || signal.slug === 'luke' || signal.slug === 'superman') && <div className="chips narrative-update-chips">
              <span className="narrative-evidence-chip">Evidence-light profile</span>
              <span className="narrative-evidence-chip">Monitored, not endorsed</span>
            </div>}
          </div>
          <div className="panel narrative-hero-rail">
            <p className="section-kicker">Verdict</p>
            <p>{signal.verdict_label}</p>
            <p className="section-kicker">Attention source</p>
            <p>{signal.attention_source.label}</p>
          </div>
        </section>

        <section className="narrative-card-grid">
          <AttentionMarketWatchProfileCard label="Attention Source" score={signal.attention_source.type} body={signal.attention_source.summary} />
          <AttentionMarketWatchProfileCard label="Control Risk" score={`${signal.control_risk.score}/100`} body={signal.control_risk.summary} />
          <AttentionMarketWatchProfileCard label="Coherence Score" score={`${signal.coherence_score.score}/100`} body={signal.coherence_score.summary} />
          <AttentionMarketWatchProfileCard label="Receipt Layer" score={`${signal.receipt_layer.score}/100`} body={signal.receipt_layer.summary} />
          <AttentionMarketWatchProfileCard label="Fragmentation Risk" score={`${signal.fragmentation_risk.score}/100`} body={signal.fragmentation_risk.summary} />
          <AttentionMarketWatchProfileCard label="Evolution Verdict" score={signal.verdict_label} body={signal.verdict_copy} />
        </section>

        <section className="panel narrative-desk-catalog" aria-label="Risk facets">
          <div className="narrative-desk-catalog-head">
            <div>
              <p className="section-kicker">Risk facets</p>
              <h2>Risk facets</h2>
            </div>
          </div>
          <div className="chips narrative-update-chips">
            {signal.risk_facets.map((facet) => <RiskFacetChip key={`${signal.slug}-${facet}`} facet={facet} />)}
          </div>
        </section>

        <section className="panel narrative-desk-catalog" aria-label="Evidence links">
          <div className="narrative-desk-catalog-head">
            <div>
              <p className="section-kicker">Evidence links</p>
              <h2>Evidence links</h2>
            </div>
          </div>
          <div className="chips narrative-update-chips">
            {signal.receipt_layer.evidence_links.map((href) => <EvidenceChip key={`${signal.slug}-${href}`} href={href} />)}
          </div>
        </section>

        <section className="panel narrative-copy-panel">
          <p className="section-kicker">Control factors</p>
          <p>{signal.control_risk.factors.join(' · ')}</p>
        </section>

        <div className="panel-actions">
          {signal.href && <a className="execute" href={signal.href}>{signal.href === '/signals/black-bull' ? 'Open Black Bull Signal Report' : 'Open Watch Profile'}</a>}
          <a className="execute compact secondary" href="/narratives/attention-market-watch">Back to Attention Market Watch</a>
        </div>
      </>}
    </main>
  </div>;
}

function SignalSurfacePage({ slug, expectedType }: { slug: string; expectedType: NarrativeSignalSurface['type'] }) {
  const [surface, setSurface] = useState<NarrativeSignalSurface | null>(null);
  const [updates, setUpdates] = useState<SignalEvidenceUpdateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<NarrativeSignalSurface>(`/v1/signals/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (response.data.type !== expectedType) throw new Error('signal_surface_type_mismatch');
        setSurface(response.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'signal_surface_unavailable'));
  }, [slug, expectedType]);

  useEffect(() => {
    api<SignalEvidenceUpdateResponse>(`/v1/signals/${encodeURIComponent(slug)}/updates`)
      .then((response) => setUpdates(response.data))
      .catch((err) => {
        if (isNotFoundError(err)) return;
        setError(err instanceof Error ? err.message : 'signal_updates_unavailable');
      });
  }, [slug]);

  const cardsById = useMemo(() => new Map((surface?.cards ?? []).map((card) => [card.id, card])), [surface?.cards]);
  const feedUpdates = updates?.updates ?? [];
  const latestUpdate = updates?.latest_update ?? null;
  const preVerdictSections = useMemo(() => (surface?.sections ?? []).filter((section) => section.id !== 'infopunk-verdict'), [surface?.sections]);
  const verdictSection = useMemo(() => (surface?.sections ?? []).find((section) => section.id === 'infopunk-verdict') ?? null, [surface?.sections]);

  useEffect(() => {
    if (!surface) return;
    syncNarrativeMetadata(`/signals/${surface.slug}`);
  }, [surface]);

  if (error && isNotFoundError(new Error(error))) {
    return <div className="shell narrative-shell"><main className="narrative-page"><section className="panel"><h1>Signal Not Found</h1><p>{slug}</p></section></main></div>;
  }

  return <div className="shell narrative-shell">
    <a className="skip-link" href="#signal-content">Skip to content</a>
    <header className="site-header">
      <NarrativeIntelNav current={`/signals/${slug}`} />
    </header>
    <main id="signal-content" className="narrative-page">
      {error && !surface && <section className="panel"><p className="route-state error">{error}</p></section>}
      {surface && <>
        <section className="panel hero narrative-hero">
          <div>
            <p className="eyebrow">{surface.subtitle}</p>
            <h1>{surface.title}</h1>
            <p className="copy">{surface.thesis}</p>
            <p className="copy">{surface.disclaimer}</p>
            {surface.type === 'signal_report' && <p className="copy narrative-rally-line">Infopunks Radar is no longer just watching markets. It is watching the narratives that become markets.</p>}
          </div>
          <div className="panel narrative-hero-rail">
            <p className="section-kicker">Signal source</p>
            <p>{surface.signal_source}</p>
            <p className="section-kicker">Last updated</p>
            <p>{formatDate(surface.last_updated)}</p>
          </div>
        </section>

        {surface.type === 'signal_report' && <LatestDeskUpdateChip latestUpdate={latestUpdate} />}

        {surface.asset && <section className="panel narrative-copy-panel">
          <p className="section-kicker">Mapped asset</p>
          <h2>{surface.asset.ticker} / {surface.asset.name}</h2>
          <p>{surface.asset.infopunk_verdict}</p>
        </section>}

        {surface.type === 'signal_report' && <ReportFreshnessCard surface={surface} updateCount={updates?.count ?? 0} latestUpdate={latestUpdate} />}
        {surface.slug === 'ansem' && <NarrativeLinkCluster links={[
          { href: '/signals/black-bull', label: 'Black Bull Signal Report' },
          { href: '/narratives/attention-markets', label: 'Attention Markets Thesis' }
        ]} />}
        {surface.slug === 'black-bull' && <NarrativeLinkCluster links={[
          { href: '/signals/ansem', label: 'Ansem Signal Source' },
          { href: '/narratives/attention-markets', label: 'Attention Markets Thesis' },
          { href: '/narratives', label: 'Narrative Intel Index' }
        ]} />}
        {surface.slug === 'troll' && <NarrativeLinkCluster links={[
          { href: '/narratives/attention-markets', label: 'Attention Markets Thesis' },
          { href: '/narratives', label: 'Narrative Intel Index' }
        ]} />}

        <section className="narrative-section-stack">
          {(surface.type === 'signal_report' ? preVerdictSections : surface.sections).map((section) => <section key={section.id} className="panel narrative-report-section" aria-label={section.title}>
            <div className="narrative-section-head">
              <div>
                <p className="section-kicker">Narrative desk</p>
                <h2>{section.title}</h2>
              </div>
            </div>
            <p>{section.body}</p>
            <div className="narrative-card-grid">
              {section.card_ids.map((cardId) => {
                const card = cardsById.get(cardId);
                return card ? <NarrativeMetricCard key={card.id} card={card} /> : null;
              })}
            </div>
          </section>)}

          {surface.slug === 'black-bull' && <DoNotWorshipSignalCard />}
          {surface.slug === 'black-bull' && <NarrativeMethodModule />}
          {surface.type === 'signal_report' && <LivingEvidenceFeed
            updates={feedUpdates}
            latestUpdate={latestUpdate}
            summary={updates?.summary ?? 'Evidence update summary: no evidence updates yet.'}
          />}
          {surface.slug === 'black-bull' && <ShareLinesModule />}

          {surface.type === 'signal_report' && verdictSection && <section key={verdictSection.id} className="panel narrative-report-section" aria-label={verdictSection.title}>
            <div className="narrative-section-head">
              <div>
                <p className="section-kicker">Narrative desk</p>
                <h2>{verdictSection.title}</h2>
              </div>
            </div>
            <p>{verdictSection.body}</p>
            <div className="narrative-card-grid">
              {verdictSection.card_ids.map((cardId) => {
                const card = cardsById.get(cardId);
                return card ? <NarrativeMetricCard key={card.id} card={card} /> : null;
              })}
            </div>
          </section>}
        </section>

        {surface.asset && <NarrativeEvidenceList artifacts={surface.asset.evidence_artifacts} />}
      </>}
    </main>
  </div>;
}

export function SignalSourcePage({ slug }: { slug: string }) {
  return <SignalSurfacePage slug={slug} expectedType="signal_source" />;
}

export function NarrativeSignalReportPage({ slug }: { slug: string }) {
  return <SignalSurfacePage slug={slug} expectedType="signal_report" />;
}

export function SignalUpdatePermalinkPage({ slug, updateId }: { slug: string; updateId: string }) {
  const [surface, setSurface] = useState<NarrativeSignalSurface | null>(null);
  const [updateDetail, setUpdateDetail] = useState<SignalEvidenceUpdateDetailResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const signalName = surface?.asset ? `${surface.asset.ticker} / ${surface.asset.name}` : surface?.title ?? slug;

  useEffect(() => {
    let active = true;
    setMissing(false);
    Promise.all([
      api<NarrativeSignalSurface>(`/v1/signals/${encodeURIComponent(slug)}`),
      api<SignalEvidenceUpdateDetailResponse>(`/v1/signals/${encodeURIComponent(slug)}/updates/${encodeURIComponent(updateId)}`)
    ])
      .then(([surfaceResponse, updateResponse]) => {
        if (!active) return;
        setSurface(surfaceResponse.data);
        setUpdateDetail(updateResponse.data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isNotFoundError(error)) setMissing(true);
      });
    return () => {
      active = false;
    };
  }, [slug, updateId]);

  useEffect(() => {
    if (!surface || !updateDetail) return;
    syncNarrativeMetadata(`/signals/${slug}/updates/${updateId}`);
  }, [signalName, slug, surface, updateDetail, updateId]);

  if (missing) return <SignalUpdateNotFound slug={slug} />;
  if (!surface || !updateDetail) return <div className="shell narrative-shell"><main className="narrative-page"><section className="panel"><p>Loading update dispatch...</p></section></main></div>;

  const update = updateDetail.update;

  return <div className="shell narrative-shell">
    <main className="narrative-page" aria-label="Signal update dispatch">
      <section className="panel narrative-update-permalink">
        <div className="narrative-update-permalink-head">
          <div>
            <p className="section-kicker">Versioned Evidence Update</p>
            <h1>{signalName}</h1>
            <p>{surface.subtitle}</p>
          </div>
          <span className={`narrative-update-badge type-${update.update_type}`}>{signalUpdateTypeLabel(update.update_type)}</span>
        </div>
        <div className="narrative-update-permalink-meta">
          <span>Signal: {surface.title}</span>
          <span>Timestamp: {formatDate(update.timestamp)}</span>
        </div>
        {surface.verdict_label && <div className="chips narrative-update-chips">
          <span className={`narrative-decision-pill state-${surface.verdict_state ?? 'watch_closely'}`}>{surface.verdict_label}</span>
        </div>}
        <p className="narrative-update-summary">{update.summary}</p>
        <SignalUpdateScoreDelta update={update} />
        <p className="narrative-analyst-note"><b>Analyst note:</b> {update.analyst_note}</p>
        <div className="chips narrative-update-chips">
          {update.evidence_links.map((href) => <EvidenceChip key={`${update.update_id}-${href}`} href={href} />)}
        </div>
        <div className="panel-actions">
          <a className="execute" href={`/signals/${slug}`}>Back to signal</a>
          <a className="execute compact secondary" href="/narratives/attention-markets">Attention Markets</a>
          <a className="execute compact secondary" href="/narratives">Narratives</a>
        </div>
      </section>
      <DeskDispatchCard signalName={signalName} updateType={update.update_type} verdictLabel={surface.verdict_label} />
    </main>
  </div>;
}

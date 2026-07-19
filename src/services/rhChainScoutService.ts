import { getRhChain4663Index, getRhChainDailyReceipts, getRhChainLaunchSurfaces, getRhChainReviewQueue, type RhChainLaunchpadObservatoryPayload, type RhChainReviewItem } from '../data/rhChain';
import { getRhChain100ReceiptsCampaign } from '../data/rhChain100Receipts';
import { resolveRhChainContractIntelligence } from './rhChainContractIntelligenceService';

export const RH_CHAIN_SCOUT_MODES = ['market_pulse', 'risk_memory', 'narrative_mutation', 'token_context', 'launch_context'] as const;
export type RhChainScoutMode = typeof RH_CHAIN_SCOUT_MODES[number];
export type RhChainScoutQuery = { query: string; mode?: RhChainScoutMode };
export type RhChainScoutResponse = { answer: string; answer_type: RhChainScoutMode; supporting_receipts: Array<{ receipt_id: string; headline: string }>; supporting_review_items: Array<Pick<RhChainReviewItem, 'review_id' | 'ticker' | 'review_state' | 'risk_state'>>; supporting_campaign_assets: Array<{ batch_id: string; ticker: string; contract: string; evidence_state: string; classification: string; risk_state: string; reviewed_at: string; outcome_check_due_at: string; seven_day_outcome: string; attribution: string; dossier_route: string }>; supporting_live_snapshots: Array<{ label: string; status: string }>; supporting_launch_context: Array<{ name: string; risk_note: string; launch_surface_status?: string }>; supporting_access_context: Array<{ name: string; source_status: string; risk_note: string }>; limitations: string[]; disclaimer: string; generated_at: string; data_mode: 'manual' };

export function classifyRhChainScoutQuery(query: string, requested?: RhChainScoutMode): RhChainScoutMode {
  if (requested) return requested;
  const text = query.toLowerCase();
  if (/past 36|post[- ]drama|still just a meme|4663.*(?:detected|reviewed)|(?:detected|reviewed).*4663|first 4663 review|discovery.*reviewed|ticker[- ]only|difference between detected and reviewed/.test(text)) return 'narrative_mutation';
  if (/rwa|tokenized|agentic|agents?|programmable|divergence|vlad.*messag|messag.*vlad/.test(text)) return 'narrative_mutation';
  if (/surface|noxa|20lab|uniswap|foundry|hardhat|wallet|bridge|swap|li\.fi|backpack|access|launchpad|fragmentation|flap|trensh|bankr|tokeny|vlad|robindotmarket|fee model|fee change|fee claim|creator revenue|burn|buyback/.test(text)) return 'launch_context';
  if (/clone|risk|deployer|fake.volume|\blp\b|launch/.test(text)) return 'risk_memory';
  if (/narrative|theme|pump|meme|rwa|tokenized|agentic|agents?|vlad|programmable|divergence/.test(text)) return 'narrative_mutation';
  if (/contract|ticker|token|0x[a-f0-9]/.test(text)) return 'token_context';
  return 'market_pulse';
}

export function queryRhChainScout(input: RhChainScoutQuery, reviewItems = getRhChainReviewQueue().items, observatory?: RhChainLaunchpadObservatoryPayload): RhChainScoutResponse {
  const mode = classifyRhChainScoutQuery(input.query, input.mode);
  const receipt = getRhChainDailyReceipts().latest_receipt;
  const surfaceWatch = getRhChainLaunchSurfaces();
  const surfaces = surfaceWatch.launch_surfaces;
  const accessSurfaces = surfaceWatch.access_surfaces;
  const needle = input.query.toLowerCase();
  const campaign = getRhChain100ReceiptsCampaign();
  const requestedContract = input.query.trim();
  const tokenResolution = mode === 'token_context' ? resolveRhChainContractIntelligence(requestedContract, { reviewItems }) : null;
  const placeholderIdentity = mode === 'token_context' && !tokenResolution?.identity_valid;
  const campaignMatches = tokenResolution?.campaign_asset ? [tokenResolution.campaign_asset] : [];
  const campaignMatch = tokenResolution?.campaign_asset ?? null;
  const related = tokenResolution?.review_items ?? [];
  const riskItems = reviewItems.filter((item) => ['high_risk', 'do_not_touch_yet', 'source_required'].includes(item.risk_state)).slice(0, 5);
  const index = getRhChain4663Index().assets.slice(0, 3);
  const noxaStatus = observatory?.surfaces.find((surface) => surface.surface_id === 'noxa_fun')?.status ?? surfaces.find((surface) => surface.id === 'noxa_fun')?.launch_surface_status ?? 'source_required';
  const watchedSurfaceNames = surfaces.filter((surface) => ['noxa_fun', 'flap_sh', 'trensh_today', 'bankr', 'tokeny_fun', 'vlad_fun', 'robindotmarket', 'uniswap_direct_pool'].includes(surface.id)).map((surface) => surface.name).join(', ');
  const launchContextAnswer = /noxa/.test(needle) && /fee|creator|revenue/.test(needle)
    ? `NOXA is recorded as ${noxaStatus} after a reported launch pause, with a reported fee-model shift toward creator revenue. That fee and revenue claim remains source_required unless primary terms or on-chain evidence exists. It matters because launchpad competition is moving from speed and volume toward trust, fee routing, creator incentives, uptime, and source verification.`
    : /noxa/.test(needle)
      ? `NOXA is recorded as ${noxaStatus} in the ${observatory ? 'latest Launchpad Observatory snapshot' : 'manual Launch Surface Watch'} after a reported launch pause and disruption. Reported website/domain issues and fee-model changes are source-dependent context, not findings about intent or conduct. ${receipt.infopunks_verdict}`
      : /fee|creator|burn|buyback/.test(needle)
        ? `Infopunks tracks fee, creator-revenue, burn, and buyback claims as source_required because those claims can reshape incentives before evidence catches up. Primary terms or on-chain routing evidence must exist before the desk promotes them from context into receipt memory.`
        : /fragmentation|launchpad|war/.test(needle)
          ? `Launchpad fragmentation means token attention and origin are spreading across multiple launch surfaces and direct pools instead of one assumed venue. The risks are clone launches, fake relaunches, vampire/copycat mechanics, creator-fee confusion, front-end dependency, direct Uniswap low-liquidity traps, unverified dominance claims, burn or buyback claim laundering, and rival-pad impersonation. Track origin, pair, deployer, LP status, fee claims, and timestamp per surface; source-required competitor claims do not become facts by repetition.`
      : /which|watched|watch/.test(needle)
        ? `The desk is watching ${watchedSurfaceNames}. NOXA is recorded as degraded in manual, source-dependent context; rival-surface claims remain source_required until primary evidence is attached.`
        : `Launch surfaces show where tokens start. Access surfaces show how users arrive. Wallet, bridge, router, and app surfaces are distribution context only; they do not establish token legitimacy, route safety, or endorsement. Backpack Wallet remains source_required until a primary source is attached.`;
  const narrativeAnswer = /first 4663 review/.test(needle)
    ? `The first 4663 review cycle establishes the operational boundary: DEX Screener and Blockscout context feed exact-contract discovery, the Discovery Queue organizes that flow, and the Review Pipeline keeps source-required states, duplicate warnings, paid-attention context, and outcome checks visible. The operational review-cycle receipt remains unpublished until a reviewer approves it; no promotion is inferred from the draft.`
    : /how does discovery become reviewed memory/.test(needle)
      ? `Discovery becomes reviewed memory only after an exact contract moves from auto-discovered context into the Review Pipeline. Review can keep it source_required or watch_only, create a candidate for Market Structure or 100 Receipts, add it to a daily draft, or schedule an outcome check. Provider observations organize the review; they do not make the judgment.`
      : /ticker[- ]only/.test(needle)
        ? `4663 does not trust ticker-only discovery because symbols can be duplicated across contracts and pairs. Exact contract, canonical pair, Blockscout context, source-linked claims, and review state keep a detected label from becoming a mistaken identity or reviewed memory.`
        : /difference between detected and reviewed/.test(needle)
          ? `Detected means a provider or discovery surface observed activity that may still be incomplete, duplicated, paid, or unverified. Reviewed means a human process preserved exact-contract evidence, caveats, and a defined state in desk memory. Detection creates a review cue; it does not create a receipt or market-structure judgment.`
    : /past 36|what changed in rh chain over/.test(needle)
    ? `Over the past 36 hours, the reviewed read is post-drama stabilization: volume remains strong after the NOXA disruption, but behavior is separating into meme, RWA, agent, and infrastructure layers instead of moving as one launch-week trade. Chain-wide metrics remain source/timestamp dependent. The chain is not cooling. It is sorting.`
    : /what does post[- ]drama stabilization mean/.test(needle)
      ? `Post-drama stabilization means the initial launchpad shock no longer explains every move. Visible volume can remain strong while attention becomes more selective and each layer—memes, RWAs, agents, and infrastructure—needs its own evidence. It is a market-structure read, not a claim about exact chain-wide metrics.`
      : /still just a meme/.test(needle)
        ? `No. Memes remain RH Chain's primary attention and liquidity engine, with CASHCAT as the benchmark attention asset, but they are no longer the only layer worth tracking. RWAs create institutional gravity, agents are the next automation primitive, and launchpads, analytics, direct pools, and data infrastructure shape how those layers develop. None of those narratives proves activity without source-linked evidence.`
        : /4663.*(?:detected|reviewed)|(?:detected|reviewed).*4663/.test(needle)
          ? `4663 separates detected activity from reviewed memory because provider observations, paid attention, and fragmented surface signals can be incomplete, duplicated, or misleading. Detected activity is context for review; reviewed memory is a human-approved record with sources, evidence states, and caveats. Provider context never outranks a reviewed receipt or Market Structure classification.`
    : /what changed|vlad|rwa messaging|leadership/.test(needle)
    ? `The reviewed change is a re-centering of programmable RWAs, tokenized assets, global access, DeFi, and agents while meme liquidity remains the visible flow engine. Exact leadership quotes and agent-volume figures are source_required unless primary links are attached; messaging does not establish product usage or availability.`
    : /how.*memes.*rwas?.*agents?|memes?.*rwas?.*agents?/.test(needle)
      ? `Memes are the attention and onboarding layer. RWAs are the institutional thesis. Agents are the automation primitive. Infopunks tracks where meme liquidity, builder tools, and demonstrated programmable-finance usage overlap; none of those layers proves the others.`
      : /divergence|meme.*rwa|rwa.*meme/.test(needle)
        ? `Meme/RWA divergence is the gap between visible meme-led liquidity and attention versus the less-demonstrated RWA, tokenized-finance, and agentic-activity thesis. It matters because narrative momentum can outrun actual usage. Exact metrics and quotes remain source_required without primary links.`
        : `${receipt.strongest_narrative}. Infopunks reads meme activity as attention acquisition, while persistent RWA, DeFi, and Stock Token usage remain the durability test.`;
  const answers: Record<RhChainScoutMode, string> = {
    market_pulse: `${receipt.headline}. ${receipt.infopunks_verdict} The current ranked memory is led by ${index.map((asset) => asset.ticker).join(', ')}; live context never overrides this reviewed receipt.`,
    risk_memory: `Visible risk memory centers on ${receipt.biggest_risk}. Day 1 campaign risk states preserve fee, utility, volatility, liquidity, and provenance checks as reviewed memory; no launch surface or LP claim is an approval signal.`,
    narrative_mutation: narrativeAnswer,
    token_context: placeholderIdentity ? 'Source required before identity-specific context. Paste one exact contract; tickers are not token identities.' : campaignMatch ? `${campaignMatch.ticker} is in Day 1 campaign memory as ${campaignMatch.evidence_state.replace(/_/g, ' ')}, classified ${campaignMatch.classification.replace(/_/g, ' ')}, with ${campaignMatch.risk_state.replace(/_/g, ' ')} risk. Its record is public memory, not endorsement or a safety determination.` : tokenResolution?.market_structure ? `${tokenResolution.name ?? tokenResolution.ticker ?? 'This token'} is a reviewed-intake Market Structure candidate under receipt check. It is classified ${tokenResolution.market_structure.primary_layer} with ${tokenResolution.market_structure.secondary_layers.join(', ')} context. ${tokenResolution.market_structure.caveat ?? 'Claims remain source_required.'} It is not an approved signal.` : related.length ? `${related[0].ticker} is in the desk as ${related[0].review_state.replace(/_/g, ' ')} with ${related[0].risk_state.replace(/_/g, ' ')} risk. Its record is memory, not a safety or trading determination.` : `No matching reviewed token record was found for that exact contract. The Scout will not infer identity from a ticker alone; verify contract and source receipts.`,
    launch_context: launchContextAnswer
  };
  const launchContext = observatory ? observatory.surfaces.slice(0, 8).map((surface) => ({ name: surface.name, risk_note: surface.risk_notes[0] ?? 'Source-required context.', launch_surface_status: surface.status })) : surfaces.slice(0, 8).map(({ name, risk_note, launch_surface_status }) => ({ name, risk_note, launch_surface_status }));
  const supportingCampaign = (mode === 'token_context' ? campaignMatches : mode === 'risk_memory' ? campaign.assets : []).map((item) => ({ batch_id: campaign.batch.batch_id, ticker: item.ticker, contract: item.contract, evidence_state: item.evidence_state, classification: item.classification, risk_state: item.risk_state, reviewed_at: item.reviewed_at, outcome_check_due_at: item.outcome_check_due_at, seven_day_outcome: item.seven_day_outcome, attribution: item.attribution, dossier_route: item.dossier_route }));
  return { answer: answers[mode], answer_type: mode, supporting_receipts: [{ receipt_id: receipt.receipt_id, headline: receipt.headline }], supporting_review_items: (mode === 'token_context' && placeholderIdentity ? [] : mode === 'token_context' ? related : riskItems).map(({ review_id, ticker, review_state, risk_state }) => ({ review_id, ticker, review_state, risk_state })), supporting_campaign_assets: supportingCampaign, supporting_live_snapshots: [{ label: 'Live Snapshot Layer', status: 'external context only; source-stamped when available' }], supporting_launch_context: launchContext, supporting_access_context: accessSurfaces.slice(0, 3).map(({ access_surface_name, source_status, risk_notes }) => ({ name: access_surface_name, source_status, risk_note: risk_notes })), limitations: ['The Scout reads existing desk memory and does not create truth.', 'External snapshots can be unavailable, delayed, or incomplete.', 'Live data never outranks human-reviewed receipts, campaign memory, or review states.', 'Access does not equal legitimacy.'], disclaimer: 'Public intelligence, not endorsement, financial advice, safety verification, listing, or official Robinhood partnership.', generated_at: observatory?.generated_at ?? receipt.generated_at, data_mode: 'manual' };
}

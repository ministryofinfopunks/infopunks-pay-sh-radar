import { getRhChain4663Index, getRhChainDailyReceipts, getRhChainLaunchSurfaces, getRhChainReviewQueue, type RhChainReviewItem } from '../data/rhChain';

export const RH_CHAIN_SCOUT_MODES = ['market_pulse', 'risk_memory', 'narrative_mutation', 'token_context', 'launch_context'] as const;
export type RhChainScoutMode = typeof RH_CHAIN_SCOUT_MODES[number];
export type RhChainScoutQuery = { query: string; mode?: RhChainScoutMode };
export type RhChainScoutResponse = { answer: string; answer_type: RhChainScoutMode; supporting_receipts: Array<{ receipt_id: string; headline: string }>; supporting_review_items: Array<Pick<RhChainReviewItem, 'review_id' | 'ticker' | 'review_state' | 'risk_state'>>; supporting_live_snapshots: Array<{ label: string; status: string }>; supporting_launch_context: Array<{ name: string; risk_note: string }>; supporting_access_context: Array<{ name: string; source_status: string; risk_note: string }>; limitations: string[]; disclaimer: string; generated_at: string; data_mode: 'manual' };

export function classifyRhChainScoutQuery(query: string, requested?: RhChainScoutMode): RhChainScoutMode {
  if (requested) return requested;
  const text = query.toLowerCase();
  if (/clone|risk|deployer|fake.volume|\blp\b|launch/.test(text)) return 'risk_memory';
  if (/narrative|theme|pump|meme/.test(text)) return 'narrative_mutation';
  if (/contract|ticker|token|0x[a-f0-9]/.test(text)) return 'token_context';
  if (/surface|noxa|20lab|uniswap|foundry|hardhat|wallet|bridge|swap|li\.fi|backpack|access/.test(text)) return 'launch_context';
  return 'market_pulse';
}

export function queryRhChainScout(input: RhChainScoutQuery, reviewItems = getRhChainReviewQueue().items): RhChainScoutResponse {
  const mode = classifyRhChainScoutQuery(input.query, input.mode);
  const receipt = getRhChainDailyReceipts().latest_receipt;
  const surfaceWatch = getRhChainLaunchSurfaces();
  const surfaces = surfaceWatch.launch_surfaces;
  const accessSurfaces = surfaceWatch.access_surfaces;
  const needle = input.query.toLowerCase();
  const related = reviewItems.filter((item) => `${item.ticker} ${item.token_contract}`.toLowerCase().includes(needle) || (needle.includes(item.ticker.toLowerCase()))).slice(0, 5);
  const riskItems = reviewItems.filter((item) => ['high_risk', 'do_not_touch_yet', 'source_required'].includes(item.risk_state)).slice(0, 5);
  const index = getRhChain4663Index().assets.slice(0, 3);
  const answers: Record<RhChainScoutMode, string> = {
    market_pulse: `${receipt.headline}. ${receipt.infopunks_verdict} The current ranked memory is led by ${index.map((asset) => asset.ticker).join(', ')}; live context never overrides this reviewed receipt.`,
    risk_memory: `Visible risk memory centers on ${receipt.biggest_risk}. Review states keep clone, deployer, liquidity, and launch-source claims under evidence gates; no launch surface or LP claim is an approval signal.`,
    narrative_mutation: `${receipt.strongest_narrative}. Infopunks reads meme activity as attention acquisition, while persistent RWA, DeFi, and Stock Token usage remain the durability test.`,
    token_context: related.length ? `${related[0].ticker} is in the desk as ${related[0].review_state.replace(/_/g, ' ')} with ${related[0].risk_state.replace(/_/g, ' ')} risk. Its record is memory, not a safety or trading determination.` : `No matching reviewed token record was found for that query. The Scout will not infer identity from a ticker alone; verify contract and source receipts.`,
    launch_context: `Launch surfaces show where tokens start. Access surfaces show how users arrive. Wallet, bridge, router, and app surfaces are distribution context only; they do not establish token legitimacy, route safety, or endorsement. Backpack Wallet remains source_required until a primary source is attached.`
  };
  return { answer: answers[mode], answer_type: mode, supporting_receipts: [{ receipt_id: receipt.receipt_id, headline: receipt.headline }], supporting_review_items: (mode === 'token_context' ? related : riskItems).map(({ review_id, ticker, review_state, risk_state }) => ({ review_id, ticker, review_state, risk_state })), supporting_live_snapshots: [{ label: 'Live Snapshot Layer', status: 'external context only; source-stamped when available' }], supporting_launch_context: surfaces.slice(0, 3).map(({ name, risk_note }) => ({ name, risk_note })), supporting_access_context: accessSurfaces.slice(0, 3).map(({ access_surface_name, source_status, risk_notes }) => ({ name: access_surface_name, source_status, risk_note: risk_notes })), limitations: ['The Scout reads existing desk memory and does not create truth.', 'External snapshots can be unavailable, delayed, or incomplete.', 'Live data never outranks human-reviewed receipts or review states.', 'Access does not equal legitimacy.'], disclaimer: 'Public intelligence, not endorsement, financial advice, safety verification, listing, or official Robinhood partnership.', generated_at: receipt.generated_at, data_mode: 'manual' };
}

import { getSignalSurfaceBySlug } from '../data/narrativeIntel';
import { getSignalUpdate } from '../data/signalUpdates';
import { getRevenueReceipt } from '../services/revenueReceiptService';
import { resolveUnicornRadarCandidate } from '../services/unicornRadarService';
import { narrativeOgImageUrl, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, signalUpdateTypeLabel } from './narrativeOg';

export type NarrativeMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  ogImageWidth: number;
  ogImageHeight: number;
  twitterTitle: string;
  twitterDescription: string;
  twitterImageUrl: string | null;
  twitterCard: 'summary_large_image' | 'summary';
};

export const NARRATIVE_PUBLIC_HOST = 'https://radar.infopunks.fun';

function decodePathPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildMetadata(title: string, description: string, canonicalPath: string): NarrativeMetadata {
  const ogImagePath = narrativeOgImageUrl(canonicalPath);
  const absoluteOgImageUrl = ogImagePath ? `${NARRATIVE_PUBLIC_HOST}${ogImagePath}` : null;
  return {
    title,
    description,
    canonicalPath,
    ogTitle: title,
    ogDescription: description,
    ogImageUrl: absoluteOgImageUrl,
    ogImageWidth: OG_IMAGE_WIDTH,
    ogImageHeight: OG_IMAGE_HEIGHT,
    twitterTitle: title,
    twitterDescription: description,
    twitterImageUrl: absoluteOgImageUrl,
    twitterCard: 'summary_large_image'
  };
}

export function getNarrativeMetadataForPath(pathname: string): NarrativeMetadata | null {
  if (/^\/rh-chain-signal-desk\/market-structure\/cross-layer\/?$/.test(pathname)) {
    return buildMetadata(
      'Cross-Layer Intersections | Infopunks Radar',
      'Reviewed exact-contract intersections across Robinhood Chain, enriched from persisted market memory with visible provenance, freshness, and evidence limits.',
      '/rh-chain-signal-desk/market-structure/cross-layer'
    );
  }

  if (/^\/rh-chain-signal-desk\/market\/?$/.test(pathname)) {
    return buildMetadata(
      'Robinhood Chain Market Pulse | Infopunks Radar',
      'Where Robinhood Chain attention, liquidity, and market power are moving—measured from exact-contract observations with freshness and confidence.',
      '/rh-chain-signal-desk/market'
    );
  }

  if (/^\/solana\/?$/.test(pathname)) {
    return buildMetadata(
      'Solana Radar | Infopunks Radar',
      'Evidence, route intelligence, provider evaluation and machine-market infrastructure for the Solana agentic economy.',
      '/solana'
    );
  }

  if (/^\/narratives\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Narrative Asset Intelligence',
      'Signal reports, evidence updates, and sovereignty checks for narratives that become markets.',
      '/narratives'
    );
  }

  if (/^\/narratives\/attention-markets\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Attention Markets Thesis',
      'Personas become liquidity, memes become coordination rails, and narratives become markets.',
      '/narratives/attention-markets'
    );
  }

  if (/^\/narratives\/attention-market-watch\/?$/.test(pathname) || /^\/attention-market-watch\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Attention Market Watch',
      'Classification engine for persona-backed markets, influencer coins, receipts, control risk, and narrative coherence.',
      '/narratives/attention-market-watch'
    );
  }

  if (/^\/rh-chain-signal-desk\/submit\/?$/.test(pathname)) {
    return buildMetadata(
      'Submit Signal | RH Chain Signal Desk',
      'Submit a Robinhood Chain token or signal for Infopunks public intelligence review.',
      '/rh-chain-signal-desk/submit'
    );
  }

  if (/^\/rh-chain-signal-desk\/review-queue\/?$/.test(pathname)) {
    return buildMetadata(
      'RH Chain Review Queue',
      'Public RH Chain intelligence queue where receipts decide what survives.',
      '/rh-chain-signal-desk/review-queue'
    );
  }

  if (/^\/rh-chain-signal-desk\/4663-index\/?$/.test(pathname)) {
    return buildMetadata(
      '4663 Signal Index',
      'A living index of Robinhood Chain attention assets, risk states, and narrative mutations.',
      '/rh-chain-signal-desk/4663-index'
    );
  }

  if (/^\/rh-chain-signal-desk\/daily-receipts\/?$/.test(pathname)) {
    return buildMetadata(
      'Daily RH Chain Receipts',
      'The market forgets. Infopunks keeps the memory.',
      '/rh-chain-signal-desk/daily-receipts'
    );
  }
  if (/^\/rh-chain-signal-desk\/launch-surfaces\/?$/.test(pathname)) {
    return buildMetadata('Launch Surface Watch | Infopunks', 'Read-only RH Chain launch-source intelligence with evidence and risk context.', '/rh-chain-signal-desk/launch-surfaces');
  }
  if (/^\/rh-chain-signal-desk\/daily-receipts\/[^/]+(?:\/card)?\/?$/.test(pathname)) {
    return buildMetadata(
      'RH Chain Daily Receipt | Infopunks',
      'Public RH Chain market memory: signal, risk, narrative, and judgment without endorsement.',
      pathname.replace(/\/$/, '')
    );
  }
  if (/^\/rh-chain-signal-desk\/live-snapshot\/?$/.test(pathname)) {
    return buildMetadata('RH Chain Live Snapshot', 'Cached external market context for the RH Chain intelligence desk.', '/rh-chain-signal-desk/live-snapshot');
  }

  if (/^\/rh-chain-signal-desk\/?$/.test(pathname) || /^\/narratives\/robinhood-chain\/?$/.test(pathname)) {
    return buildMetadata(
      'RH Chain Signal Desk',
      'Wall Street rails. Meme liquidity. Infopunks intelligence.',
      '/rh-chain-signal-desk'
    );
  }

  if (/^\/abundance\/?$/.test(pathname) || /^\/narratives\/abundance-desk\/?$/.test(pathname)) {
    return buildMetadata(
      'Abundance Desk',
      'Infopunks as the proof, receipt, and judgment layer for the machine-labor economy.',
      '/abundance'
    );
  }

  if (/^\/hermes\/skill-pack\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Hermes Skill Pack',
      'How Hermes learns to investigate before money moves.',
      '/hermes/skill-pack'
    );
  }

  if (/^\/developers\/wallet-safety\/?$/.test(pathname)) {
    return buildMetadata(
      'Wallet Safety Developer Quickstart',
      'The machinery is built. Now make it easy to plug into.',
      '/developers/wallet-safety'
    );
  }

  if (/^\/developers\/wallet-safety\/integrations\/?$/.test(pathname)) {
    return buildMetadata(
      'Wallet Safety Integration Registry',
      'A safety API is useful. A registry makes adoption visible.',
      '/developers/wallet-safety/integrations'
    );
  }

  const walletSafetyIntegrationDetailMatch = pathname.match(/^\/developers\/wallet-safety\/integrations\/([^/]+)\/?$/);
  if (walletSafetyIntegrationDetailMatch) {
    const integrationId = decodePathPart(walletSafetyIntegrationDetailMatch[1]);
    return buildMetadata(
      'Integration Readiness Detail',
      `Wallet Safety readiness detail for ${integrationId}. A registry shows adoption. A detail page shows proof.`,
      `/developers/wallet-safety/integrations/${encodeURIComponent(integrationId)}`
    );
  }

  if (/^\/hermes\/pre-spend-decision\/?$/.test(pathname)) {
    return buildMetadata(
      'Pre-Spend Decision Engine',
      'Before an agent spends, it checks the ledger.',
      '/hermes/pre-spend-decision'
    );
  }

  if (/^\/hermes\/spend-policy\/?$/.test(pathname)) {
    return buildMetadata(
      'Agent Spend Policy Layer',
      'Decision tells an agent what to do. Policy tells an agent what it is allowed to do.',
      '/hermes/spend-policy'
    );
  }

  if (/^\/hermes\/decision-feedback\/?$/.test(pathname)) {
    return buildMetadata(
      'Decision Receipt and Feedback Loop',
      'A decision becomes intelligence when the outcome is recorded.',
      '/hermes/decision-feedback'
    );
  }

  if (/^\/hermes\/wallet-audit-trail\/?$/.test(pathname)) {
    return buildMetadata(
      'Autonomous Wallet Audit Trail',
      'Autonomous wallets need more than logs. They need audit trails with judgment.',
      '/hermes/wallet-audit-trail'
    );
  }

  if (/^\/hermes\/wallet-risk-score\/?$/.test(pathname)) {
    return buildMetadata(
      'Wallet Risk Score',
      'Audit trails explain what happened. Risk scores tell the wallet what to do next.',
      '/hermes/wallet-risk-score'
    );
  }

  if (/^\/hermes\/wallet-safety\/?$/.test(pathname)) {
    return buildMetadata(
      'Wallet Safety API',
      'Agents should not stitch safety together. They should ask once before spend.',
      '/hermes/wallet-safety'
    );
  }

  if (/^\/hermes\/?$/.test(pathname) || /^\/narratives\/hermes-desk\/?$/.test(pathname)) {
    return buildMetadata(
      'Hermes Desk',
      'Agentic investigations before money moves. Hermes runs the loop while Infopunks keeps the receipts.',
      '/hermes'
    );
  }

  const attentionWatchProfileMatch = pathname.match(/^\/attention-market-watch\/([^/]+)\/?$/);
  if (attentionWatchProfileMatch) {
    const slug = decodePathPart(attentionWatchProfileMatch[1]);
    const ticker = slug.toUpperCase();
    return buildMetadata(
      `Infopunks Attention Market Watch: $${ticker}`,
      `Attention market classification for $${ticker}, including source, control risk, coherence, receipts, fragmentation, and verdict.`,
      `/attention-market-watch/${encodeURIComponent(slug)}`
    );
  }

  if (/^\/signal-hunt\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Signal Hunt',
      'Public culture-layer intake for early signal, proof trails, and agent memory before the narrative hardens.',
      '/signal-hunt'
    );
  }

  const signalHuntDetailMatch = pathname.match(/^\/signal-hunt\/([^/]+)\/?$/);
  if (signalHuntDetailMatch) {
    const signalId = decodePathPart(signalHuntDetailMatch[1]);
    return buildMetadata(
      `Infopunks Signal Hunt: ${signalId}`,
      'A Signal Hunt detail page linking public cultural intake to proof checks, loops, route memory, and agent judgment.',
      `/signal-hunt/${encodeURIComponent(signalId)}`
    );
  }

  if (/^\/unicorn-radar\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Unicorn Radar',
      'Finding serious low-cap Solana projects before consensus does.',
      '/unicorn-radar'
    );
  }

  if (/^\/evaluation-request\/?$/.test(pathname)) {
    return buildMetadata(
      'Request an Infopunks Evaluation',
      'Submit receipts for paid evaluation. Payment buys evaluation, not conviction.',
      '/evaluation-request'
    );
  }

  const unicornRadarDetailMatch = pathname.match(/^\/unicorn-radar\/([^/]+)\/?$/);
  if (unicornRadarDetailMatch) {
    const candidateId = decodePathPart(unicornRadarDetailMatch[1]);
    const candidate = resolveUnicornRadarCandidate(candidateId);
    if (candidate) {
      return buildMetadata(
        `Infopunks Unicorn Radar: ${candidate.project} / ${candidate.ticker}`,
        `${candidate.project} (${candidate.ticker}) is an ${candidate.sector} candidate on Infopunks Unicorn Radar, currently marked ${candidate.status} with verdict ${candidate.verdict}.`,
        `/unicorn-radar/${encodeURIComponent(candidateId)}`
      );
    }
    return buildMetadata(
      `Infopunks Unicorn Radar: ${candidateId}`,
      'Low-cap Solana candidate detail with shipping proof, attention quality, token survivability, risk flags, receipts, hunter attribution, and Infopunks verdict.',
      `/unicorn-radar/${encodeURIComponent(candidateId)}`
    );
  }

  if (/^\/revenue-receipts\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Revenue Receipts',
      'Public ledger for paid evaluations, bounties, listings, reports, studio work, and API access.',
      '/revenue-receipts'
    );
  }

  const revenueReceiptMatch = pathname.match(/^\/revenue-receipts\/([^/]+)\/?$/);
  if (revenueReceiptMatch) {
    const receiptId = decodePathPart(revenueReceiptMatch[1]);
    const receipt = getRevenueReceipt(receiptId);
    if (receipt) {
      return buildMetadata(
        `Infopunks Revenue Receipt: ${receipt.receiptNumber} / ${receipt.title}`,
        `Public receipt for ${receipt.clientName}, ${receipt.source}, ${receipt.currency} ${receipt.amount}, with disclosure and independence statement.`,
        `/revenue-receipts/${encodeURIComponent(receiptId)}`
      );
    }
    return buildMetadata(
      `Infopunks Revenue Receipt: ${receiptId}`,
      'Public receipt page with disclosure, use-of-funds, and independence statement.',
      `/revenue-receipts/${encodeURIComponent(receiptId)}`
    );
  }

  if (/^\/signals\/ansem\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Signal Source: Ansem',
      'A Narrative Asset Intelligence profile mapping Ansem as a Solana-native signal source.',
      '/signals/ansem'
    );
  }

  if (/^\/signals\/black-bull\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Signal Report: $ANSEM / The Black Bull',
      'A living Narrative Asset Intelligence report on $ANSEM evolving from persona attention into community coordination.',
      '/signals/black-bull'
    );
  }

  if (/^\/signals\/troll\/?$/.test(pathname)) {
    return buildMetadata(
      'Infopunks Signal Report: $TROLL / The Re-Indexed Archetype',
      'A Narrative Asset Intelligence report on old internet culture reactivated as a Solana-native community asset.',
      '/signals/troll'
    );
  }

  const updateMatch = pathname.match(/^\/signals\/([^/]+)\/updates\/([^/]+)\/?$/);
  if (updateMatch) {
    const slug = decodePathPart(updateMatch[1]);
    const updateId = decodePathPart(updateMatch[2]);
    const surface = getSignalSurfaceBySlug(slug);
    const update = getSignalUpdate(slug, updateId);
    if (!surface || !update) return null;
    const signalName = surface.asset ? `${surface.asset.ticker} / ${surface.asset.name}` : surface.title;
    const title = slug === 'troll'
      ? 'Infopunks Desk Dispatch: Durable Re-index'
      : slug === 'black-bull' && updateId === 'seu_black_bull_007'
        ? 'Infopunks Desk Dispatch: Coordination Market Emerging'
      : `Infopunks Desk Dispatch: ${signalUpdateTypeLabel(update.update_type)}`;
    const description = slug === 'troll'
      ? 'The Re-Indexed Archetype signal update. The signal is not novelty. The signal is survival.'
      : slug === 'black-bull' && updateId === 'seu_black_bull_007'
        ? 'Black Bull signal update. Persona attention is evolving into community coordination.'
      : `${signalName} signal update. Reports are not final. Signals mutate.`;
    return buildMetadata(
      title,
      description,
      `/signals/${encodeURIComponent(slug)}/updates/${encodeURIComponent(updateId)}`
    );
  }

  return null;
}

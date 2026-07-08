import { getSignalSurfaceBySlug } from '../data/narrativeIntel';
import { getSignalUpdate } from '../data/signalUpdates';
import type { RevenueReceipt, UnicornRadarCandidate } from '../schemas/entities';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
const OG_FONT_FAMILY = 'IBM Plex Mono, monospace';

type OgImagePayload = {
  title: string;
  subtitle: string;
  badge: string;
  footer: string;
  accent: string;
  eyebrow: string;
  routeLabel: string;
};

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapText(value: string, maxChars: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function signalUpdateTypeLabel(value: string) {
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
    default:
      return 'Signal Update';
  }
}

export function narrativeOgImageUrl(pathname: string) {
  if (/^\/narratives\/?$/.test(pathname)) {
    return '/og/narratives.png';
  }

  if (/^\/narratives\/attention-market-watch\/?$/.test(pathname) || /^\/attention-market-watch\/?$/.test(pathname)) {
    return '/og/attention-market-watch.png';
  }

  if (/^\/signal-hunt\/?$/.test(pathname) || /^\/signal-hunt\/[^/]+\/?$/.test(pathname)) {
    return '/og/signal-hunt.png';
  }

  if (/^\/unicorn-radar\/?$/.test(pathname)) {
    return '/og/unicorn-radar.png';
  }

  if (/^\/evaluation-request\/?$/.test(pathname)) {
    return '/og/evaluation-request.png';
  }

  if (/^\/revenue-receipts\/?$/.test(pathname)) {
    return '/og/revenue-receipts.png';
  }

  const unicornRadarMatch = pathname.match(/^\/unicorn-radar\/([^/]+)\/?$/);
  if (unicornRadarMatch) {
    return `/og/unicorn-radar/${encodeURIComponent(unicornRadarMatch[1])}.png`;
  }

  const revenueReceiptMatch = pathname.match(/^\/revenue-receipts\/([^/]+)\/?$/);
  if (revenueReceiptMatch) {
    return `/og/revenue-receipts/${encodeURIComponent(revenueReceiptMatch[1])}.png`;
  }

  if (/^\/signals\/black-bull\/?$/.test(pathname)) {
    return '/og/signals/black-bull.png';
  }

  if (/^\/signals\/troll\/?$/.test(pathname)) {
    return '/og/signals/troll.png';
  }

  const attentionWatchMatch = pathname.match(/^\/attention-market-watch\/([^/]+)\/?$/);
  if (attentionWatchMatch) {
    return `/og/attention-market-watch/${encodeURIComponent(attentionWatchMatch[1])}.png`;
  }

  const updateMatch = pathname.match(/^\/signals\/([^/]+)\/updates\/([^/]+)\/?$/);
  if (updateMatch) {
    return `/og/signals/${encodeURIComponent(updateMatch[1])}/updates/${encodeURIComponent(updateMatch[2])}.png`;
  }

  return null;
}

function formatOgLabel(value: string) {
  if (value === 'high_signal_early') return 'High-Signal, Retention Still Monitored';
  return value.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function clampText(value: string, maxChars: number) {
  const clean = value.trim();
  return clean.length <= maxChars ? clean : `${clean.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function formatCompactNumber(value: number | null | undefined, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: digits
  }).format(value);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function wrapOgText(value: string, maxChars: number, maxLines: number) {
  const words = value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const rawWord of words) {
    const word = rawWord.length > maxChars ? clampText(rawWord, maxChars) : rawWord;
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = clampText(`${visible[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, maxChars);
  return visible;
}

function formatUnicornStatusLabel(status: UnicornRadarCandidate['status']) {
  switch (status) {
    case 'high_signal_lowcap':
      return 'High-Signal Lowcap';
    case 'watchlist':
      return 'Watchlist';
    case 'do_not_touch_yet':
      return 'Do Not Touch Yet';
    case 'consensus_forming':
      return 'Consensus Forming';
    case 'paid_evaluation':
      return 'Paid Evaluation';
    case 'infopunks_missed_it':
      return 'Infopunks Missed It';
    case 'unseen_signal':
      return 'Unseen Signal';
    default:
      return formatOgLabel(status);
  }
}

function formatUnicornVerdictLabel(verdict: UnicornRadarCandidate['verdict']) {
  switch (verdict) {
    case 'high_signal_early':
      return 'High-Signal Early';
    case 'interesting_needs_receipts':
      return 'Interesting, Needs Receipts';
    case 'real_product_weak_attention':
      return 'Real Product, Weak Attention';
    case 'strong_attention_weak_proof':
      return 'Strong Attention, Weak Proof';
    case 'do_not_touch_yet':
      return 'Do Not Touch Yet';
    case 'consensus_already_forming':
      return 'Consensus Already Forming';
    case 'missed_by_infopunks':
      return 'Missed by Infopunks';
    default:
      return formatOgLabel(verdict);
  }
}

function unicornStatusTheme(status: UnicornRadarCandidate['status']) {
  switch (status) {
    case 'high_signal_lowcap':
      return { accent: '#7ef6b2', muted: '#214b38', fill: '#071b13' };
    case 'watchlist':
      return { accent: '#ffd166', muted: '#5b4720', fill: '#211807' };
    case 'do_not_touch_yet':
      return { accent: '#ff7b7b', muted: '#5a2a2a', fill: '#241010' };
    case 'consensus_forming':
      return { accent: '#8bd7ff', muted: '#20465e', fill: '#061824' };
    default:
      return { accent: '#9bf1cc', muted: '#1d4f43', fill: '#071b16' };
  }
}

function formatMoneyCompact(value: number | null | undefined) {
  const formatted = formatCompactNumber(value);
  return formatted === 'N/A' ? formatted : `$${formatted}`;
}

function formatUpdatedDate(value: string | undefined) {
  if (!value) return 'UPDATED PENDING';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'UPDATED PENDING';
  return `UPDATED ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date).toUpperCase()}`;
}

function renderTextLines(lines: string[], x: number, y: number, lineHeight: number, fontSize: number, fill: string, weight = 500) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + (index * lineHeight)}" font-family="${OG_FONT_FAMILY}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`
  )).join('');
}

function renderUnicornScoreTile(x: number, y: number, label: string, score: number, accent: string) {
  const barWidth = Math.max(0, Math.min(126, Math.round((score / 100) * 126)));
  return `<rect x="${x}" y="${y}" width="248" height="78" rx="10" fill="#061411" stroke="#163b32" />
  <text x="${x + 18}" y="${y + 28}" font-family="${OG_FONT_FAMILY}" font-size="14" font-weight="600" fill="#8ab6a8">${escapeXml(label.toUpperCase())}</text>
  <text x="${x + 18}" y="${y + 62}" font-family="${OG_FONT_FAMILY}" font-size="32" font-weight="700" fill="#f2fffb">${score}</text>
  <rect x="${x + 86}" y="${y + 50}" width="126" height="8" rx="4" fill="#10261f" />
  <rect x="${x + 86}" y="${y + 50}" width="${barWidth}" height="8" rx="4" fill="${accent}" />`;
}

function renderMarketCell(x: number, y: number, width: number, label: string, value: string, accent: string) {
  return `<rect x="${x}" y="${y}" width="${width}" height="64" rx="10" fill="#061411" stroke="#163b32" />
  <text x="${x + 18}" y="${y + 25}" font-family="${OG_FONT_FAMILY}" font-size="13" font-weight="600" fill="#8ab6a8">${escapeXml(label)}</text>
  <text x="${x + 18}" y="${y + 51}" font-family="${OG_FONT_FAMILY}" font-size="21" font-weight="700" fill="${accent}">${escapeXml(value)}</text>`;
}

function normalizeEvidenceChip(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getEvidenceChips(candidate: UnicornRadarCandidate) {
  const priority = [
    'LIVE_GAME_ROUTE',
    'TOKEN_REVIEW_PASSED',
    'HOLDER_DISTRIBUTION_HEALTHY',
    'CHARITY_NARRATIVE',
    'REAL_WORLD_PRODUCT',
    'MEME_WITH_PRODUCT',
    'PRODUCT_SURFACE_CONFIRMED',
    'GUILD_ACTIVITY',
    'COMMUNITY_WIKI',
    'FAIR_LAUNCH_RECEIPT',
    'LIQUIDITY_DEPTH_REVIEWED',
    'CONSENSUS_FORMING',
    'WATCHLIST',
    'PURE_MEME_RISK'
  ];
  const sourceLabels = [
    ...(candidate.tags ?? []),
    ...candidate.receipts.map((receipt) => receipt.type === 'LIVE_GAME_ROUTE' ? receipt.type : receipt.label)
  ];
  const unique = Array.from(new Set(sourceLabels.map(normalizeEvidenceChip).filter(Boolean)));
  return [
    ...priority.filter((label) => unique.includes(label)),
    ...unique.filter((label) => !priority.includes(label))
  ];
}

function renderEvidenceChips(candidate: UnicornRadarCandidate, accent: string) {
  const chips = getEvidenceChips(candidate);
  const visible = chips.slice(0, 4);
  const more = chips.length - visible.length;
  const chipMarkup = visible.map((chip, index) => {
    const x = 70 + (index * 222);
    return `<rect x="${x}" y="522" width="204" height="36" rx="8" fill="#081914" stroke="#1d4a3f" />
  <text x="${x + 14}" y="545" font-family="${OG_FONT_FAMILY}" font-size="13" font-weight="700" fill="#d3fff1">${escapeXml(clampText(chip, 22))}</text>`;
  }).join('');
  const moreMarkup = more > 0
    ? `<rect x="960" y="522" width="102" height="36" rx="8" fill="#0a1916" stroke="${accent}" />
  <text x="978" y="545" font-family="${OG_FONT_FAMILY}" font-size="13" font-weight="700" fill="${accent}">+${more} MORE</text>`
    : '';
  return `${chipMarkup}${moreMarkup}`;
}

function renderUnicornMarketStrip(candidate: UnicornRadarCandidate, accent: string) {
  const marketData = candidate.dexScreenerData;
  if (!marketData) {
    return `<rect x="70" y="442" width="992" height="64" rx="10" fill="#061411" stroke="#163b32" />
  <text x="92" y="481" font-family="${OG_FONT_FAMILY}" font-size="22" font-weight="700" fill="#f2fffb">Market data: pending/manual review</text>
  <text x="552" y="481" font-family="${OG_FONT_FAMILY}" font-size="17" font-weight="600" fill="#8ab6a8">${escapeXml(candidate.verificationStatus === 'pending_manual_review' ? 'Canonical token identity not verified' : 'DexScreener data not attached')}</text>`;
  }

  const fourthMetric = typeof marketData.priceChange24h === 'number'
    ? { label: '24H CHANGE', value: formatPercent(marketData.priceChange24h) }
    : { label: 'FDV', value: formatMoneyCompact(marketData.fdv) };

  const metrics = [
    { label: 'MARKET CAP', value: formatMoneyCompact(marketData.marketCap) },
    { label: 'LIQUIDITY', value: formatMoneyCompact(marketData.liquidityUsd) },
    { label: '24H VOLUME', value: formatMoneyCompact(marketData.volume24h) },
    fourthMetric
  ];

  return metrics.map((metric, index) => renderMarketCell(70 + (index * 257), 442, 239, metric.label, metric.value, accent)).join('');
}

export function renderUnicornCandidateOgSvg(candidate: UnicornRadarCandidate) {
  const theme = unicornStatusTheme(candidate.status);
  const title = `${candidate.project} / ${candidate.ticker}`;
  const titleLines = wrapOgText(title, 34, 2);
  const thesisLines = wrapOgText(candidate.thesis, 82, 2);
  const status = formatUnicornStatusLabel(candidate.status);
  const verdict = candidate.displayVerdict ?? formatUnicornVerdictLabel(candidate.verdict);
  const sectorLine = `${candidate.ticker} · ${candidate.sector}`;
  const receiptCount = `${candidate.receipts.length} RECEIPT${candidate.receipts.length === 1 ? '' : 'S'}`;
  const marketSource = candidate.dexScreenerData ? 'DEXSCREENER MARKET DATA' : 'MANUAL MARKET REVIEW';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020504" />
      <stop offset="58%" stop-color="#061411" />
      <stop offset="100%" stop-color="#0b1d18" />
    </linearGradient>
    <radialGradient id="glow" cx="82%" cy="22%" r="48%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="scan" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.08" />
      <stop offset="52%" stop-color="${theme.accent}" stop-opacity="0.32" />
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0.04" />
    </linearGradient>
    <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M 34 0 L 0 0 0 34" fill="none" stroke="#12352e" stroke-width="1" opacity="0.58" />
    </pattern>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glow)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#grid)" opacity="0.5" />
  <rect x="42" y="34" width="1116" height="562" rx="18" fill="#03100d" fill-opacity="0.78" stroke="#1f5b4e" stroke-width="2" />
  <rect x="64" y="56" width="1072" height="2" fill="url(#scan)" />

  <circle cx="1018" cy="158" r="108" fill="none" stroke="#164137" stroke-width="1.4" opacity="0.82" />
  <circle cx="1018" cy="158" r="68" fill="none" stroke="#1d5549" stroke-width="1.4" opacity="0.72" />
  <path d="M930 220C974 190 1009 165 1064 104" stroke="${theme.accent}" stroke-width="4" stroke-linecap="round" opacity="0.94" />
  <circle cx="1064" cy="104" r="8" fill="${theme.accent}" />

  <text x="70" y="82" font-family="${OG_FONT_FAMILY}" font-size="18" font-weight="700" fill="#9bf1cc">INFOPUNKS UNICORN RADAR</text>
  <text x="70" y="111" font-family="${OG_FONT_FAMILY}" font-size="15" font-weight="500" fill="#8ab6a8">Public Intelligence for Low-Cap Signal</text>
  <text x="914" y="82" font-family="${OG_FONT_FAMILY}" font-size="13" font-weight="600" fill="#8ab6a8">${escapeXml(formatUpdatedDate(candidate.updated_at))}</text>
  <text x="914" y="111" font-family="${OG_FONT_FAMILY}" font-size="13" font-weight="600" fill="#8ab6a8">${escapeXml(marketSource)}</text>

  ${renderTextLines(titleLines, 70, 166, 50, 45, '#f2fffb', 700)}
  <text x="72" y="238" font-family="${OG_FONT_FAMILY}" font-size="17" font-weight="600" fill="#8ab6a8">${escapeXml(clampText(sectorLine, 58))}</text>

  <rect x="70" y="258" width="264" height="40" rx="8" fill="${theme.fill}" stroke="${theme.accent}" />
  <text x="92" y="284" font-family="${OG_FONT_FAMILY}" font-size="16" font-weight="700" fill="${theme.accent}">${escapeXml(status)}</text>
  <rect x="350" y="258" width="592" height="40" rx="8" fill="#061411" stroke="${theme.muted}" />
  <text x="372" y="284" font-family="${OG_FONT_FAMILY}" font-size="15" font-weight="700" fill="#d3fff1">${escapeXml(clampText(verdict, 58))}</text>
  <rect x="946" y="258" width="116" height="40" rx="8" fill="#061411" stroke="${theme.muted}" />
  <text x="962" y="284" font-family="${OG_FONT_FAMILY}" font-size="15" font-weight="700" fill="#d3fff1">${escapeXml(receiptCount)}</text>

  ${renderTextLines(thesisLines, 72, 318, 24, 20, '#b7d2c8', 500)}

  <g>
    ${renderUnicornScoreTile(70, 356, 'Signal', candidate.scores.overall_signal_score, theme.accent)}
    ${renderUnicornScoreTile(334, 356, 'Shipping', candidate.scores.shipping_proof, theme.accent)}
    ${renderUnicornScoreTile(598, 356, 'Asymmetry', candidate.scores.asymmetry_potential, theme.accent)}
    ${renderUnicornScoreTile(862, 356, 'Risk', candidate.scores.risk_score, '#ff8a6a')}
  </g>

  ${renderUnicornMarketStrip(candidate, theme.accent)}
  ${renderEvidenceChips(candidate, theme.accent)}

  <text x="70" y="588" font-family="${OG_FONT_FAMILY}" font-size="16" font-weight="700" fill="#d3fff1">Projects can buy evaluation, not conviction.</text>
  <text x="70" y="613" font-family="${OG_FONT_FAMILY}" font-size="16" font-weight="700" fill="#9bf1cc">No receipt, no trust.</text>
  <text x="810" y="613" font-family="${OG_FONT_FAMILY}" font-size="16" font-weight="700" fill="#9bf1cc">radar.infopunks.fun/unicorn-radar</text>
</svg>`;
}

export function renderUnicornRadarOgImage(candidate: UnicornRadarCandidate) {
  return renderUnicornCandidateOgSvg(candidate);
}

export function renderUnicornRadarIndexOgImage() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="Infopunks Unicorn Radar">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#030807" />
      <stop offset="56%" stop-color="#071411" />
      <stop offset="100%" stop-color="#0b1f1b" />
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="22%" r="44%">
      <stop offset="0%" stop-color="#7effb0" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#7effb0" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#17322d" stroke-width="1" opacity="0.72" />
    </pattern>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glow)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#grid)" opacity="0.48" />
  <rect x="42" y="34" width="1116" height="562" rx="28" fill="#04100d" fill-opacity="0.72" stroke="#1b5b4f" stroke-width="2" />
  <rect x="70" y="60" width="346" height="38" rx="19" fill="#0d2420" stroke="#1b5b4f" />
  <text x="94" y="85" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#9bf1cc" letter-spacing="1.1">INFOPUNKS UNICORN RADAR</text>
  <text x="70" y="152" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="62" font-weight="800" fill="#f2fffb">Finding serious low-cap</text>
  <text x="70" y="222" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="62" font-weight="800" fill="#f2fffb">Solana projects before</text>
  <text x="70" y="292" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="62" font-weight="800" fill="#f2fffb">consensus does.</text>
  <text x="72" y="354" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="25" fill="#a9c8bc">Retail doesn’t need less risk.</text>
  <text x="72" y="390" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="25" fill="#a9c8bc">Retail needs better signal before taking risk.</text>
  <rect x="70" y="448" width="470" height="54" rx="14" fill="#071411" stroke="#173c35" />
  <text x="92" y="482" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#fef3c7">5 CANDIDATES · 1 HIGH-SIGNAL · 2 WATCHLIST · 1 CONSENSUS</text>
  <rect x="70" y="522" width="620" height="48" rx="14" fill="#071411" stroke="#173c35" />
  <text x="92" y="552" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="800" fill="#9bf1cc">Projects can buy evaluation, not conviction.</text>
  <circle cx="1038" cy="172" r="96" fill="none" stroke="#173c35" stroke-width="1.5" />
  <circle cx="1038" cy="172" r="60" fill="none" stroke="#1e4c43" stroke-width="1.5" />
  <path d="M962 232C1000 206 1030 184 1078 130" stroke="#7effb0" stroke-width="4" stroke-linecap="round" />
  <circle cx="1078" cy="130" r="8" fill="#7effb0" />
</svg>`;
}

export function renderRevenueReceiptsIndexOgImage() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="Infopunks Revenue Receipts">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0905" />
      <stop offset="56%" stop-color="#18130a" />
      <stop offset="100%" stop-color="#271c10" />
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="22%" r="44%">
      <stop offset="0%" stop-color="#ffd166" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#ffd166" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#4f3920" stroke-width="1" opacity="0.72" />
    </pattern>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glow)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#grid)" opacity="0.48" />
  <rect x="42" y="34" width="1116" height="562" rx="28" fill="#120d07" fill-opacity="0.8" stroke="#8b5e1f" stroke-width="2" />
  <rect x="70" y="60" width="406" height="38" rx="19" fill="#2a1d0e" stroke="#8b5e1f" />
  <text x="94" y="85" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#ffd166" letter-spacing="1.1">INFOPUNKS REVENUE RECEIPTS</text>
  <text x="70" y="152" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="62" font-weight="800" fill="#fff7ea">No receipt, no trust.</text>
  <text x="70" y="222" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="28" fill="#f2d8a7">Public ledger for paid evaluations, bounties, reports, listings, studio work, and API access.</text>
  <rect x="70" y="316" width="542" height="54" rx="14" fill="#1a130b" stroke="#6f4d17" />
  <text x="92" y="350" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#fff1c7">PROJECTS CAN BUY EVALUATION, NOT CONVICTION.</text>
  <rect x="70" y="394" width="690" height="48" rx="14" fill="#1a130b" stroke="#6f4d17" />
  <text x="92" y="424" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="800" fill="#ffd166">Open slots, templates, and internal build receipts only until paid work is real.</text>
  <rect x="70" y="488" width="342" height="54" rx="14" fill="#1a130b" stroke="#6f4d17" />
  <text x="92" y="522" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#fff1c7">PUBLIC COMMERCIAL LEDGER</text>
</svg>`;
}

export function renderRevenueReceiptOgImage(receipt: RevenueReceipt) {
  const source = formatOgLabel(receipt.source);
  const status = formatOgLabel(receipt.status);
  const titleLines = wrapText(receipt.title, 30).slice(0, 2);
  const titleMarkup = titleLines.map((line, index) => (
    `<text x="70" y="${166 + (index * 52)}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="46" font-weight="800" fill="#fff7ea">${escapeXml(line)}</text>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeXml(receipt.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0905" />
      <stop offset="56%" stop-color="#18130a" />
      <stop offset="100%" stop-color="#271c10" />
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="24%" r="44%">
      <stop offset="0%" stop-color="#ffd166" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#ffd166" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#4f3920" stroke-width="1" opacity="0.72" />
    </pattern>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glow)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#grid)" opacity="0.48" />
  <rect x="42" y="34" width="1116" height="562" rx="28" fill="#120d07" fill-opacity="0.8" stroke="#8b5e1f" stroke-width="2" />
  <rect x="70" y="60" width="406" height="38" rx="19" fill="#2a1d0e" stroke="#8b5e1f" />
  <text x="94" y="85" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#ffd166" letter-spacing="1.1">INFOPUNKS REVENUE RECEIPT</text>
  <text x="70" y="126" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" fill="#ffdd9b" letter-spacing="2">${escapeXml(receipt.receiptNumber.toUpperCase())}</text>
  ${titleMarkup}
  <rect x="72" y="282" width="262" height="42" rx="21" fill="#1a130b" stroke="#8b5e1f" />
  <text x="94" y="309" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="800" fill="#fff1c7">${escapeXml(status)}</text>
  <rect x="352" y="282" width="386" height="42" rx="21" fill="#1a130b" stroke="#8b5e1f" />
  <text x="374" y="309" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="800" fill="#fff1c7">${escapeXml(source)}</text>
  <rect x="70" y="358" width="430" height="72" rx="16" fill="#1a130b" stroke="#6f4d17" />
  <text x="92" y="388" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="15" fill="#ffdd9b">CLIENT</text>
  <text x="92" y="420" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="30" font-weight="800" fill="#fff7ea">${escapeXml(receipt.clientName)}</text>
  <rect x="528" y="358" width="320" height="72" rx="16" fill="#1a130b" stroke="#6f4d17" />
  <text x="550" y="388" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="15" fill="#ffdd9b">AMOUNT</text>
  <text x="550" y="420" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="30" font-weight="800" fill="#fff7ea">${escapeXml(formatMoney(receipt.amount, receipt.currency))}</text>
  <rect x="876" y="358" width="184" height="72" rx="16" fill="#1a130b" stroke="#6f4d17" />
  <text x="898" y="388" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="15" fill="#ffdd9b">PRODUCT</text>
  <text x="898" y="420" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="24" font-weight="800" fill="#fff7ea">${escapeXml(clampText(receipt.relatedProduct, 12))}</text>
  <rect x="70" y="470" width="610" height="48" rx="14" fill="#1a130b" stroke="#6f4d17" />
  <text x="92" y="500" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#fff1c7">No receipt, no trust.</text>
  <rect x="70" y="536" width="838" height="48" rx="14" fill="#1a130b" stroke="#6f4d17" />
  <text x="92" y="566" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#ffd166">Projects can buy evaluation, not conviction.</text>
</svg>`;
}

function renderSignalCardSvg(payload: OgImagePayload) {
  const titleLines = wrapText(payload.title, 26);
  const subtitleLines = wrapText(payload.subtitle, 68);
  const footerLines = wrapText(payload.footer, 58);
  const titleY = 218;
  const subtitleY = 406;
  const footerY = 558;

  const titleMarkup = titleLines.map((line, index) => (
    `<text x="86" y="${titleY + (index * 68)}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="56" font-weight="700" fill="#f2fffb" letter-spacing="-1.2">${escapeXml(line)}</text>`
  )).join('');
  const subtitleMarkup = subtitleLines.map((line, index) => (
    `<text x="86" y="${subtitleY + (index * 34)}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="24" fill="#a9c8bc">${escapeXml(line)}</text>`
  )).join('');
  const footerMarkup = footerLines.map((line, index) => (
    `<text x="86" y="${footerY + (index * 24)}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" fill="#7fa195" letter-spacing="1.1">${escapeXml(line.toUpperCase())}</text>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeXml(payload.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#040b0a" />
      <stop offset="65%" stop-color="#071715" />
      <stop offset="100%" stop-color="#0b1f1b" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${payload.accent}" stop-opacity="0.92" />
      <stop offset="100%" stop-color="#7effd4" stop-opacity="0.18" />
    </linearGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#17322d" stroke-width="1" opacity="0.8" />
    </pattern>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)" />
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#grid)" opacity="0.55" />
  <circle cx="982" cy="180" r="210" fill="none" stroke="#14312b" stroke-width="1.5" />
  <circle cx="982" cy="180" r="152" fill="none" stroke="#173c35" stroke-width="1.5" />
  <circle cx="982" cy="180" r="94" fill="none" stroke="#1e4c43" stroke-width="1.5" />
  <path d="M782 180H1188" stroke="#173c35" stroke-width="1.5" />
  <path d="M982 -22V382" stroke="#173c35" stroke-width="1.5" />
  <path d="M820 325C895 274 941 245 1031 193C1084 163 1120 145 1168 124" stroke="url(#accent)" stroke-width="4" stroke-linecap="round" />
  <circle cx="1168" cy="124" r="8" fill="${payload.accent}" />
  <rect x="70" y="58" width="280" height="40" rx="20" fill="#0d2420" stroke="#1b5b4f" />
  <text x="98" y="84" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="700" fill="#9bf1cc">${escapeXml(payload.badge)}</text>
  <text x="86" y="138" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" fill="#4cc0a0" letter-spacing="2.4">${escapeXml(payload.eyebrow)}</text>
  ${titleMarkup}
  ${subtitleMarkup}
  <rect x="86" y="472" width="324" height="42" rx="10" fill="#0a1916" stroke="#173c35" />
  <text x="106" y="499" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="700" fill="#d3fff1">${escapeXml(payload.routeLabel)}</text>
  ${footerMarkup}
  <rect x="1042" y="494" width="86" height="86" rx="14" fill="#09110f" stroke="#1f4a41" />
  <path d="M1064 548H1106" stroke="${payload.accent}" stroke-width="3" stroke-linecap="round" />
  <path d="M1085 527V569" stroke="${payload.accent}" stroke-width="3" stroke-linecap="round" />
  <circle cx="1085" cy="548" r="27" fill="none" stroke="${payload.accent}" stroke-width="2" opacity="0.85" />
  <text x="86" y="602" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="15" fill="#54756b">radar.infopunks.fun</text>
</svg>`;
}

export function renderNarrativesOgImage() {
  return renderSignalCardSvg({
    title: 'Narrative Asset Intelligence',
    subtitle: 'Signal reports, evidence updates, and sovereignty checks for narratives that become markets.',
    badge: 'INFOPUNKS RADAR',
    footer: 'Signal reports / evidence updates / sovereignty checks / reflexivity watch',
    accent: '#62ffc7',
    eyebrow: 'NARRATIVE INTEL INDEX',
    routeLabel: '/narratives'
  });
}

export function renderAttentionMarketWatchOgImage(slug?: string | null) {
  if (!slug) {
    return renderSignalCardSvg({
      title: 'Attention Market Watch',
      subtitle: 'Before you follow the meta, check the receipts.',
      badge: 'INFOPUNKS RADAR',
      footer: 'Persona-backed markets / control risk / receipts / coherence / fragmentation',
      accent: '#9fd6ff',
      eyebrow: 'NARRATIVE ASSET INTELLIGENCE',
      routeLabel: '/narratives/attention-market-watch'
    });
  }

  const title = slug.toUpperCase();
  return renderSignalCardSvg({
    title: `$${title} Attention Watch`,
    subtitle: 'Attention market classification across source, control, coherence, receipts, fragmentation, and verdict.',
    badge: 'INFOPUNKS RADAR',
    footer: 'Before you follow the meta, check the receipts.',
    accent: '#9fd6ff',
    eyebrow: 'ATTENTION MARKET PROFILE',
    routeLabel: `/attention-market-watch/${slug}`
  });
}

export function renderSignalHuntOgImage() {
  return renderSignalCardSvg({
    title: 'Signal Hunt',
    subtitle: 'Find what matters before it trends.',
    badge: 'INFOPUNKS RADAR',
    footer: 'Culture intake / proof trail / loop memory / pre-spend judgment',
    accent: '#ffe36d',
    eyebrow: 'PUBLIC CULTURE LAYER',
    routeLabel: '/signal-hunt'
  });
}

export function renderSignalReportOgImage(slug: string) {
  const surface = getSignalSurfaceBySlug(slug);
  if (!surface) return null;

  if (slug === 'black-bull') {
    return renderSignalCardSvg({
      title: '$ANSEM / The Black Bull',
      subtitle: 'Living signal report on persona attention evolving into community coordination.',
      badge: 'SIGNAL REPORT',
      footer: 'Evidence map / myth compression / power concentration / reflexivity risk',
      accent: '#7bfec4',
      eyebrow: 'NARRATIVE SIGNAL SURFACE',
      routeLabel: `/signals/${slug}`
    });
  }

  if (slug === 'troll') {
    return renderSignalCardSvg({
      title: '$TROLL / The Re-Indexed Archetype',
      subtitle: 'Old internet culture reactivated by Solana trench memory.',
      badge: 'SIGNAL REPORT',
      footer: 'The signal is not novelty. The signal is survival.',
      accent: '#ffb35c',
      eyebrow: 'NARRATIVE SIGNAL SURFACE',
      routeLabel: `/signals/${slug}`
    });
  }

  return null;
}

export function renderSignalUpdateOgImage(slug: string, updateId: string) {
  const surface = getSignalSurfaceBySlug(slug);
  const update = getSignalUpdate(slug, updateId);
  if (!surface || !update) return null;

  if (slug === 'troll') {
    return renderSignalCardSvg({
      title: 'Infopunks Desk Dispatch',
      subtitle: 'Durable Re-index verdict issued for $TROLL',
      badge: 'VERSIONED EVIDENCE UPDATE',
      footer: 'The signal is not novelty. The signal is survival.',
      accent: '#ff8a6a',
      eyebrow: 'DESK DISPATCH PERMALINK',
      routeLabel: `/signals/${slug}/updates/${updateId}`
    });
  }

  if (slug === 'black-bull' && updateId === 'seu_black_bull_007') {
    return renderSignalCardSvg({
      title: 'Infopunks Desk Dispatch',
      subtitle: 'Coordination Market Emerging for $ANSEM',
      badge: 'VERSIONED EVIDENCE UPDATE',
      footer: 'Persona attention is becoming community coordination.',
      accent: '#ff8a6a',
      eyebrow: 'DESK DISPATCH PERMALINK',
      routeLabel: `/signals/${slug}/updates/${updateId}`
    });
  }

  return renderSignalCardSvg({
    title: 'Infopunks Desk Dispatch',
    subtitle: `${signalUpdateTypeLabel(update.update_type)} detected for ${surface.title}`,
    badge: 'VERSIONED EVIDENCE UPDATE',
    footer: 'Reports are not final. Signals mutate.',
    accent: '#ff8a6a',
    eyebrow: 'DESK DISPATCH PERMALINK',
    routeLabel: `/signals/${slug}/updates/${updateId}`
  });
}

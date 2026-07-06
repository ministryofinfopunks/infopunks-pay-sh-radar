import { getSignalSurfaceBySlug } from '../data/narrativeIntel';
import { getSignalUpdate } from '../data/signalUpdates';
import type { RevenueReceipt, UnicornRadarCandidate } from '../schemas/entities';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

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

function renderScoreTile(x: number, y: number, label: string, score: number, accent: string) {
  return `<rect x="${x}" y="${y}" width="226" height="82" rx="14" fill="#071411" stroke="#173c35" />
  <text x="${x + 18}" y="${y + 30}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="15" fill="#8ab6a8" letter-spacing="1.1">${escapeXml(label.toUpperCase())}</text>
  <text x="${x + 18}" y="${y + 64}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="34" font-weight="800" fill="#f2fffb">${score}</text>
  <rect x="${x + 72}" y="${y + 51}" width="124" height="8" rx="4" fill="#10261f" />
  <rect x="${x + 72}" y="${y + 51}" width="${Math.max(0, Math.min(124, Math.round((score / 100) * 124)))}" height="8" rx="4" fill="${accent}" />`;
}

export function renderUnicornRadarOgImage(candidate: UnicornRadarCandidate) {
  const accent = candidate.status === 'do_not_touch_yet'
    ? '#ff7b7b'
    : candidate.status === 'paid_evaluation'
      ? '#ffd166'
      : '#7effb0';
  const title = `${candidate.project} / ${candidate.ticker}`;
  const status = formatOgLabel(candidate.status);
  const verdict = formatOgLabel(candidate.verdict);
  const paidLine = candidate.paid_evaluation_disclosure.is_paid
    ? `PAID EVALUATION DISCLOSED · ${clampText(candidate.paid_evaluation_disclosure.note, 56)}`
    : candidate.paid_evaluation_disclosure.label.toUpperCase();
  const hunter = candidate.hunter_credit?.handle ? `HUNTER ${candidate.hunter_credit.handle}` : 'HUNTER NOT RECORDED';
  const receipts = `${candidate.receipts.length} RECEIPT${candidate.receipts.length === 1 ? '' : 'S'}`;
  const marketData = candidate.dexScreenerData;
  const marketSummary = marketData
    ? `MCAP ${formatCompactNumber(marketData.marketCap)} · LIQ ${formatCompactNumber(marketData.liquidityUsd)} · VOL ${formatCompactNumber(marketData.volume24h)} · 24H ${formatPercent(marketData.priceChange24h)}`
    : 'NO DEXSCREENER MARKET DATA ATTACHED';
  const titleLines = wrapText(title, 28).slice(0, 2);
  const thesisLines = wrapText(candidate.thesis, 70).slice(0, 2);
  const titleMarkup = titleLines.map((line, index) => (
    `<text x="70" y="${154 + (index * 56)}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="48" font-weight="800" fill="#f2fffb">${escapeXml(line)}</text>`
  )).join('');
  const thesisMarkup = thesisLines.map((line, index) => (
    `<text x="72" y="${286 + (index * 28)}" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="21" fill="#a9c8bc">${escapeXml(line)}</text>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#030807" />
      <stop offset="58%" stop-color="#071411" />
      <stop offset="100%" stop-color="#0b1f1b" />
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="24%" r="44%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.32" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
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
  <text x="70" y="124" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" fill="#5ee0af" letter-spacing="2.2">${escapeXml(candidate.sector.toUpperCase())}</text>
  ${titleMarkup}
  <rect x="72" y="226" width="212" height="42" rx="21" fill="#0a1916" stroke="${accent}" />
  <text x="94" y="253" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="800" fill="#d3fff1">${escapeXml(status)}</text>
  <rect x="300" y="226" width="342" height="42" rx="21" fill="#0a1916" stroke="#28584f" />
  <text x="322" y="253" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="800" fill="#d3fff1">${escapeXml(verdict)}</text>
  ${thesisMarkup}
  <g>
    ${renderScoreTile(70, 358, 'Shipping Proof', candidate.scores.shipping_proof, accent)}
    ${renderScoreTile(318, 358, 'Attention Quality', candidate.scores.attention_quality, accent)}
    ${renderScoreTile(566, 358, 'Token Survival', candidate.scores.token_survivability, accent)}
    ${renderScoreTile(814, 358, 'Risk Score', candidate.scores.risk_score, '#ff8a6a')}
  </g>
  <rect x="70" y="468" width="492" height="54" rx="14" fill="#071411" stroke="#173c35" />
  <text x="92" y="501" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="17" font-weight="800" fill="#fef3c7">${escapeXml(receipts)} · ${escapeXml(hunter)}</text>
  <rect x="584" y="468" width="476" height="54" rx="14" fill="#071411" stroke="#173c35" />
  <text x="606" y="501" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="15" font-weight="800" fill="#fef3c7">${escapeXml(paidLine)}</text>
  <rect x="70" y="530" width="990" height="46" rx="14" fill="#071411" stroke="#173c35" />
  <text x="92" y="559" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="16" font-weight="800" fill="#9bf1cc">${escapeXml(marketSummary)}</text>
  <text x="72" y="598" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#d3fff1">Market data via DexScreener. Infopunks verdict is independent.</text>
  <text x="72" y="620" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="15" fill="#7fa195">Projects can buy evaluation, not conviction.</text>
  <circle cx="1044" cy="154" r="92" fill="none" stroke="#173c35" stroke-width="1.5" />
  <circle cx="1044" cy="154" r="56" fill="none" stroke="#1e4c43" stroke-width="1.5" />
  <path d="M968 214C1006 188 1036 166 1084 112" stroke="${accent}" stroke-width="4" stroke-linecap="round" />
  <circle cx="1084" cy="112" r="8" fill="${accent}" />
</svg>`;
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
  <text x="92" y="482" font-family="'SFMono-Regular', 'Menlo', monospace" font-size="18" font-weight="800" fill="#fef3c7">3 CANDIDATES · 2 WATCHLIST · 1 CONSENSUS FORMING</text>
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

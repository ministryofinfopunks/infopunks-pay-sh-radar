import { getSignalSurfaceBySlug } from '../data/narrativeIntel';
import { getSignalUpdate } from '../data/signalUpdates';

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

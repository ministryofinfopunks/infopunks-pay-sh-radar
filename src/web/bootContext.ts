import { DEFAULT_PULSE_PUBLIC_HOST } from '../shared/rhPulseRouteCore';

export type RadarNetworkId = 'solana' | 'robinhood-chain';
export type RadarNavigationContext = 'universal' | RadarNetworkId;
export type RadarBootContext = RadarNavigationContext | 'rh-pulse';

export const BOOT_LOADING_LABELS: Record<RadarBootContext, string> = {
  universal: 'INFOPUNKS RADAR // INTELLIGENCE SYSTEM BOOTING...',
  solana: 'INFOPUNKS RADAR // SOLANA INTELLIGENCE BOOTING...',
  'robinhood-chain': 'INFOPUNKS RADAR // RH CHAIN INTELLIGENCE BOOTING...',
  'rh-pulse': 'INFOPUNKS / RH PULSE // REFINING SIGNAL...'
};

export const BOOT_INITIALIZATION_DELAYED_LABEL = 'INFOPUNKS RADAR // INITIALIZATION DELAYED';

// Keep this small routing boundary independent from React so the document shell can
// resolve its label without loading the application entry chunk.
const RH_CHAIN_ROUTE_PREFIXES = [
  '/rh-chain-signal-desk',
  '/rh-chain-meme-pulse',
  '/narratives/robinhood-chain',
  '/internal/rh-chain'
] as const;

const RH_PULSE_ROUTE_PREFIXES = ['/rh-pulse'] as const;

const SOLANA_ROUTE_PREFIXES = [
  '/solana',
  '/providers',
  '/routes',
  '/receipts',
  '/benchmarks',
  '/services',
  '/claim',
  '/claims',
  '/check',
  '/loops',
  '/signal-hunt',
  '/unicorn-radar',
  '/evaluation-request',
  '/revenue-receipts',
  '/graph',
  '/narratives',
  '/attention-market-watch',
  '/abundance',
  '/signals',
  '/hermes',
  '/spend-terminal',
  '/developers',
  '/radar',
  '/propagation',
  '/machine-market',
  '/machine-rail-coverage',
  '/machine-route-risk-matrix',
  '/machine-first-safe-routes',
  '/machine-benchmark-readiness',
  '/machine-benchmark-methodology',
  '/machine-comparable-routes',
  '/machine-translation-evidence',
  '/machine-proof-ladder',
  '/machine-execution-shortlist',
  '/machine-execution-blockers',
  '/machine-market-changelog',
  '/machine-no-claim-ledger',
  '/machine-readiness-matrix',
  '/machine-market-map',
  '/machine-receipts',
  '/machine-economy-snapshot',
  '/machine-preflight',
  '/machine-execution',
  '/machine-execution-plan',
  '/machine-service',
  '/machine-dossier'
] as const;

function normalizedPathname(pathname: string | null | undefined) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return '/';
  return pathname.replace(/\/{2,}/g, '/');
}

function hasRoutePrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function radarNetworkForPath(pathname: string | null | undefined): RadarNavigationContext {
  const normalized = normalizedPathname(pathname);
  if (normalized === '/') return 'universal';
  if (hasRoutePrefix(normalized, RH_CHAIN_ROUTE_PREFIXES)) return 'robinhood-chain';
  if (hasRoutePrefix(normalized, SOLANA_ROUTE_PREFIXES)) return 'solana';
  return 'universal';
}

export function bootLoadingLabelForPath(pathname: string | null | undefined) {
  if (hasRoutePrefix(normalizedPathname(pathname), RH_PULSE_ROUTE_PREFIXES)) return BOOT_LOADING_LABELS['rh-pulse'];
  return BOOT_LOADING_LABELS[radarNetworkForPath(pathname)];
}

export function currentBootLoadingLabel() {
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  if (typeof window !== 'undefined' && (
    window.__RH_PULSE_CONTEXT__?.surface === 'rh-pulse'
    || window.location.hostname.toLowerCase() === DEFAULT_PULSE_PUBLIC_HOST
  )) return BOOT_LOADING_LABELS['rh-pulse'];
  return bootLoadingLabelForPath(pathname);
}

// Vite injects this parser-blocking script into the static document shell. It
// serializes the same route prefixes above, keeping the pre-React path lookup
// independent from (and smaller than) the React application bundle.
export function initialBootShellScript() {
  const labels = JSON.stringify(BOOT_LOADING_LABELS);
  const pulsePrefixes = JSON.stringify(RH_PULSE_ROUTE_PREFIXES);
  const rhPrefixes = JSON.stringify(RH_CHAIN_ROUTE_PREFIXES);
  const solanaPrefixes = JSON.stringify(SOLANA_ROUTE_PREFIXES);
  return `(function(){var p=(window.location.pathname||'/').replace(/\\/{2,}/g,'/');var h=(window.location.hostname||'').toLowerCase();var m=function(a){return a.some(function(x){return p===x||p.indexOf(x+'/')===0;});};var l=${labels};var q=window.__RH_PULSE_CONTEXT__;var u=(q&&q.surface==='rh-pulse')||h==='${DEFAULT_PULSE_PUBLIC_HOST}'||m(${pulsePrefixes});var c=u?'rh-pulse':p==='/'?'universal':m(${rhPrefixes})?'robinhood-chain':m(${solanaPrefixes})?'solana':'universal';var e=document.querySelector('[data-radar-boot-label]');if(e){e.textContent=l[c];var r=e.closest('[data-radar-initial-boot]');if(r)r.setAttribute('data-ready','true');}})();`;
}

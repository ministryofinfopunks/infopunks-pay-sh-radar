import { PRODUCT_LINKS, RADAR_NAVIGATION } from './radarNavigationCatalog';
export type RadarPageIdentity = { index: string; title: string; subtitle: string };
const families: [RegExp, RadarPageIdentity][] = [
  [/^\/$/, { index: '01', title: 'INFOPUNKS RADAR', subtitle: 'TWO ECONOMIES' }],
  [/^\/solana/, { index: '02', title: 'SOLANA RADAR', subtitle: 'PRE-SPEND INTELLIGENCE' }],
  [/^\/economic-os\/overview\/?$/, { index: '06', title: 'ECONOMIC OS', subtitle: 'ONE RADAR. TWO ECONOMIES. ONE STANDARD OF PROOF.' }],
  [/^\/routes/, { index: '03', title: 'ROUTES', subtitle: 'SERVICE INTELLIGENCE' }],
  [/^\/(receipts|revenue-receipts|proof)/, { index: '04', title: 'RECEIPTS', subtitle: 'PROOF ARCHIVE' }],
  [/^\/providers/, { index: '05', title: 'PROVIDERS', subtitle: 'PROVIDER EVIDENCE' }],
  [/^\/services/, { index: '06', title: 'SERVICES', subtitle: 'SERVICE DOSSIERS' }],
  [/^\/(spend-terminal|check|claim|radar\/cards)/, { index: '07', title: 'JUDGMENT', subtitle: 'PRE-SPEND INTELLIGENCE' }],
  [/^\/loops/, { index: '08', title: 'LOOPLAB', subtitle: 'COLLECTIVE MEMORY' }],
  [/^\/4663\/reflexive\/preflight\/ipx-pltr/, { index: '13', title: 'IPX PLTR', subtitle: 'RESEARCH LAB' }],
  [/^\/4663\/reflexive/, { index: '12', title: 'REFLEXIVE RADAR', subtitle: 'MARKET STRUCTURE' }],
  [/^\/(4663|rh-chain|internal\/rh-chain)|^\/narratives\/robinhood-chain/, { index: '11', title: 'ROBINHOOD CHAIN', subtitle: 'ONCHAIN FINANCE' }],
  [/^\/(machine-|benchmarks|radar\/readiness)/, { index: '10', title: 'MACHINE ECONOMY', subtitle: 'EXECUTION EVIDENCE' }],
  [/^\/developers/, { index: '14', title: 'DEVELOPERS', subtitle: 'INTEGRATION REFERENCE' }],
  [/^\/hermes|^\/narratives\/hermes-desk/, { index: '15', title: 'HERMES', subtitle: 'WALLET MEMORY' }],
  [/^\/evaluation-request/, { index: '16', title: 'EVALUATION', subtitle: 'COMMERCIAL EVIDENCE' }],
  [/^\/(signals|signal-hunt|graph|narratives|attention-market-watch|abundance|unicorn-radar|propagation)/, { index: '09', title: 'SIGNALS', subtitle: 'MARKET INTELLIGENCE' }]
];
export function radarPageIdentity(path: string): RadarPageIdentity {
  return families.find(([pattern]) => pattern.test(path))?.[1] ?? { index: '01', title: 'INFOPUNKS RADAR', subtitle: 'INTELLIGENCE TERMINAL' };
}
export function radarPageLabel(path: string) {
  const items = Object.values(RADAR_NAVIGATION).flatMap(nav => [...nav.primaryItems, ...nav.overflowGroups.flatMap(group => group.items)]);
  return [...PRODUCT_LINKS, ...items].find(item => item.href === path)?.label ?? path.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') ?? 'Two economies';
}

import type { RadarNavigationContext, RadarNetworkId } from './bootContext';

export type RadarSurfaceGroup =
  | 'intelligence'
  | 'agent-tools'
  | 'hermes'
  | 'commercial'
  | 'machine-economy'
  | 'developers';

export type RadarSurfaceStatus = 'live' | 'new' | 'experimental' | 'evidence-backed';

export type RadarNetwork = {
  id: RadarNetworkId;
  label: string;
  shortLabel: string;
  contextLabel: string;
  economy: string;
  description: string;
  selectorDescription: string;
  href: string;
  statusLabel: string;
  features: readonly string[];
};

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  featured?: boolean;
  status?: RadarSurfaceStatus;
  compactPriority?: boolean;
  external?: boolean;
  activePrefixes?: readonly string[];
};

export type NavigationGroup = {
  id: string;
  label: string;
  description?: string;
  items: readonly NavigationItem[];
};

export type NetworkNavigation = {
  networkId: RadarNavigationContext;
  primaryItems: readonly NavigationItem[];
  overflowGroups: readonly NavigationGroup[];
};

export const SOLANA_GROUP_ORDER = [
  'intelligence',
  'agent-tools',
  'hermes',
  'commercial',
  'machine-economy',
  'developers'
] as const satisfies readonly RadarSurfaceGroup[];

export const RADAR_NETWORKS: Readonly<Record<RadarNetworkId, RadarNetwork>> = {
  solana: {
    id: 'solana',
    label: 'Solana Radar',
    shortLabel: 'Solana',
    contextLabel: 'Solana',
    economy: 'The agentic economy',
    description: 'Pre-spend intelligence for services, providers, routes, projects and machine payments.',
    selectorDescription: 'Agent routes, Pay.sh and project intelligence',
    href: '/solana',
    statusLabel: 'Core network',
    features: [
      'Pre-Spend Intelligence',
      'Providers and endpoints',
      'Routes and claims',
      'Benchmarks and receipts',
      'Signal Graph and LoopLab'
    ]
  },
  'robinhood-chain': {
    id: 'robinhood-chain',
    label: 'Robinhood Chain',
    shortLabel: 'RH Chain',
    contextLabel: 'Robinhood Chain',
    economy: 'The onchain finance economy',
    description: 'Evidence-led intelligence for tokens, memes, liquidity, launchpads and emerging Robinhood Chain markets.',
    selectorDescription: 'Tokens, memes and ecosystem signals',
    href: '/rh-chain-signal-desk',
    statusLabel: 'New network',
    features: [
      'Meme Pulse',
      'Token dossiers',
      'Signal and risk review',
      'Launchpad observatory',
      'Receipts and live snapshots'
    ]
  }
};

export const RADAR_NETWORK_LIST = [RADAR_NETWORKS.solana, RADAR_NETWORKS['robinhood-chain']] as const;

export const SOLANA_SURFACE_GROUPS: readonly (NavigationGroup & { id: RadarSurfaceGroup })[] = [
  {
    id: 'intelligence',
    label: 'Intelligence',
    description: 'Narrative, market and cultural signal surfaces.',
    items: [
      { id: 'signal-hunt', href: '/signal-hunt', label: 'Signal Hunt', description: 'Emerging signals with evidence', featured: true, status: 'evidence-backed', activePrefixes: ['/signal-hunt/'] },
      { id: 'narratives', href: '/narratives', label: 'Narratives', description: 'Cultural intelligence desk', featured: true },
      { id: 'unicorn-radar', href: '/unicorn-radar', label: 'Unicorn Radar', description: 'Early company and project watch', featured: true, activePrefixes: ['/unicorn-radar/'] },
      { id: 'signal-graph', href: '/graph', label: 'Signal Graph', description: 'Claims, receipts and relationships', featured: true },
      { id: 'attention-markets', href: '/narratives/attention-markets', label: 'Attention Markets', description: 'Markets formed around attention' },
      { id: 'attention-market-watch', href: '/narratives/attention-market-watch', label: 'Attention Market Watch', description: 'Live attention market profiles', activePrefixes: ['/attention-market-watch/'] },
      { id: 'abundance-desk', href: '/abundance', label: 'Abundance Desk', description: 'Machine abundance intelligence', activePrefixes: ['/narratives/abundance-desk'] },
      { id: 'ansem', href: '/signals/ansem', label: 'Ansem', description: 'Source intelligence file' },
      { id: 'black-bull', href: '/signals/black-bull', label: 'Black Bull', description: 'Narrative signal report' },
      { id: 'troll', href: '/signals/troll', label: 'TROLL', description: 'Narrative signal report' }
    ]
  },
  {
    id: 'agent-tools',
    label: 'Agent Tools',
    description: 'Decision and evidence infrastructure before an agent spends.',
    items: [
      { id: 'check', href: '/check', label: 'Check', description: 'Verify a claim before action', featured: true, activePrefixes: ['/check/'] },
      { id: 'loops', href: '/loops', label: 'Loops', description: 'Run and inspect proof loops', featured: true, activePrefixes: ['/loops/'] },
      { id: 'hermes-desk', href: '/hermes', label: 'Hermes Desk', description: 'Agentic investigations before spend', featured: true },
      { id: 'agent-benchmarks', href: '/#agent-benchmark-api', label: 'Agent Benchmarks', description: 'Benchmark agent readiness', featured: true },
      { id: 'preflight-cards', href: '/radar/cards', label: 'Preflight Cards', description: 'Shareable decision artifacts', activePrefixes: ['/radar/cards/'] },
      { id: 'claims', href: '/claim', label: 'Claims', description: 'Judgments backed by receipts', activePrefixes: ['/claim/'] },
      { id: 'route-mappings', href: '/#route-mapping-registry', label: 'Route Mappings', description: 'Provider-to-endpoint coverage' },
      { id: 'preflight', href: '/#preflight', label: 'Preflight', description: 'Check a route before payment' },
      { id: 'compare', href: '/#compare', label: 'Compare', description: 'Compare routes and providers' },
      { id: 'provider-dossier', href: '/#dossier', label: 'Provider Dossier', description: 'Inspect provider evidence' },
      { id: 'pre-spend-terminal', href: '/spend-terminal', label: 'Pre-Spend Terminal', description: 'Decision surface for agents' }
    ]
  },
  {
    id: 'hermes',
    label: 'Hermes',
    description: 'Wallet memory, spend policy and accountable decision loops.',
    items: [
      { id: 'memory-loop', href: '/hermes/memory-loop', label: 'Memory Loop', description: 'Outcomes that change future action', featured: true },
      { id: 'pre-spend-decision', href: '/hermes/pre-spend-decision', label: 'Pre-Spend Decision', description: 'Check the ledger before spend', featured: true },
      { id: 'spend-policy', href: '/hermes/spend-policy', label: 'Spend Policy', description: 'Bound wallet authority', featured: true },
      { id: 'decision-feedback', href: '/hermes/decision-feedback', label: 'Decision Feedback', description: 'Record what happened next', featured: true },
      { id: 'wallet-audit-trail', href: '/hermes/wallet-audit-trail', label: 'Wallet Audit Trail', description: 'Explain every wallet decision' },
      { id: 'wallet-risk-score', href: '/hermes/wallet-risk-score', label: 'Wallet Risk Score', description: 'Actionable wallet risk' },
      { id: 'wallet-safety-api', href: '/hermes/wallet-safety', label: 'Wallet Safety API', description: 'One safety check before spend' },
      { id: 'reputation-ledger', href: '/hermes/reputation-ledger', label: 'Reputation Ledger', description: 'Judgment accumulated over time' },
      { id: 'skill-pack', href: '/hermes/skill-pack', label: 'Skill Pack', description: 'Investigation skills for agents' },
      { id: 'hermes-narrative', href: '/narratives/hermes-desk', label: 'Narrative', description: 'The Hermes intelligence thesis' }
    ]
  },
  {
    id: 'commercial',
    label: 'Commercial',
    description: 'Evaluation and outcome evidence for commercial work.',
    items: [
      { id: 'evaluation-request', href: '/evaluation-request', label: 'Evaluation Request', description: 'Request a commercial evaluation', featured: true },
      { id: 'revenue-receipts', href: '/revenue-receipts', label: 'Revenue Receipts', description: 'Evidence of commercial outcomes', featured: true, status: 'evidence-backed', activePrefixes: ['/revenue-receipts/'] }
    ]
  },
  {
    id: 'machine-economy',
    label: 'Machine Economy',
    description: 'Market, rail and execution-readiness intelligence for machines.',
    items: [
      { id: 'machine-market', href: '/machine-market', label: 'Machine Market', description: 'Machine-service market map', featured: true },
      { id: 'machine-rail-coverage', href: '/machine-rail-coverage', label: 'Rail Coverage', description: 'Payment rail availability', featured: true },
      { id: 'machine-route-risk', href: '/machine-route-risk-matrix', label: 'Route Risk', description: 'Risk across machine routes', featured: true },
      { id: 'machine-first-safe-queue', href: '/machine-first-safe-routes', label: 'First Safe Queue', description: 'Safest candidates to test first', featured: true },
      { id: 'machine-benchmark-readiness', href: '/machine-benchmark-readiness', label: 'Benchmark Readiness', description: 'Evidence readiness by service', featured: true },
      { id: 'machine-benchmark-methodology', href: '/machine-benchmark-methodology', label: 'Benchmark Methodology', description: 'How readiness is measured' },
      { id: 'machine-comparable-routes', href: '/machine-comparable-routes', label: 'Comparable Routes', description: 'Like-for-like route evidence' },
      { id: 'machine-translation-evidence', href: '/machine-translation-evidence', label: 'Translation Evidence', description: 'Translation route proof' },
      { id: 'machine-proof-ladder', href: '/machine-proof-ladder', label: 'Proof Ladder', description: 'Progress from listing to proof' },
      { id: 'machine-execution-shortlist', href: '/machine-execution-shortlist', label: 'Proof Plans', description: 'Controlled execution shortlist' },
      { id: 'machine-execution-blockers', href: '/machine-execution-blockers', label: 'Execution Blockers', description: 'What prevents a safe run' },
      { id: 'machine-market-changelog', href: '/machine-market-changelog', label: 'Changelog', description: 'Market intelligence changes' },
      { id: 'machine-no-claim-ledger', href: '/machine-no-claim-ledger', label: 'No-Claim Ledger', description: 'Claims Radar refuses to make' },
      { id: 'machine-readiness-matrix', href: '/machine-readiness-matrix', label: 'Readiness Matrix', description: 'Readiness across the market' },
      { id: 'machine-market-map', href: '/machine-market-map', label: 'Market Map', description: 'Services, rails and sources' },
      { id: 'machine-receipts', href: '/machine-receipts', label: 'Machine Receipts', description: 'Execution evidence ledger' },
      { id: 'machine-economy-snapshot', href: '/machine-economy-snapshot', label: 'Snapshot', description: 'Current machine economy state' }
    ]
  },
  {
    id: 'developers',
    label: 'Developers',
    description: 'APIs, health surfaces and implementation references.',
    items: [
      { id: 'api', href: '/openapi.json', label: 'API', description: 'OpenAPI specification', featured: true, external: true },
      { id: 'developer-documentation', href: '/developers', label: 'Developer Documentation', description: 'Integration guides and examples', featured: true, activePrefixes: ['/developers/'] },
      { id: 'hermes-json', href: '/v1/hermes', label: 'Hermes JSON', description: 'Machine-readable Hermes state', featured: true, external: true },
      { id: 'hermes-health', href: '/v1/hermes/health', label: 'Hermes Health', description: 'Service health endpoint', featured: true, external: true },
      { id: 'methodology', href: '/#methodology', label: 'Methodology', description: 'How Radar forms judgment', featured: true },
      { id: 'events', href: '/#events', label: 'Events', description: 'Recent evidence events' }
    ]
  }
] as const;

export function featuredItemsForGroup(group: NavigationGroup) {
  return group.items.filter((item) => item.featured);
}

export const RADAR_NAVIGATION: Readonly<Record<RadarNavigationContext, NetworkNavigation>> = {
  universal: {
    networkId: 'universal',
    primaryItems: [
      { id: 'universal-overview', href: '/', label: 'Overview', compactPriority: true },
      { id: 'universal-networks', href: '/#radar-network-entry-title', label: 'Networks', compactPriority: true }
    ],
    overflowGroups: [
      {
        id: 'networks',
        label: 'Networks',
        items: [
          { id: 'solana-radar', href: '/solana', label: 'Solana Radar', description: 'Pre-spend intelligence for the agentic economy' },
          { id: 'rh-chain', href: '/rh-chain-signal-desk', label: 'Robinhood Chain Signal Desk', description: 'Token, meme and ecosystem intelligence' }
        ]
      },
      {
        id: 'reference',
        label: 'Reference',
        items: [
          { id: 'universal-methodology', href: '/#methodology', label: 'Methodology', description: 'How Radar forms judgment' },
          { id: 'universal-developers', href: '/developers', label: 'Developer Documentation', description: 'Integration guides and examples' },
          { id: 'universal-api', href: '/openapi.json', label: 'API', description: 'OpenAPI specification', external: true }
        ]
      }
    ]
  },
  solana: {
    networkId: 'solana',
    primaryItems: [
      { id: 'solana-overview', href: '/solana', label: 'Overview', compactPriority: true },
      { id: 'solana-providers', href: '/providers', label: 'Providers', compactPriority: true, activePrefixes: ['/providers/'] },
      { id: 'solana-routes', href: '/routes', label: 'Routes', compactPriority: true, activePrefixes: ['/routes/'] },
      { id: 'solana-receipts', href: '/receipts', label: 'Receipts', activePrefixes: ['/receipts/'] },
      { id: 'solana-benchmarks', href: '/benchmarks', label: 'Benchmarks', activePrefixes: ['/benchmarks/'] }
    ],
    overflowGroups: SOLANA_SURFACE_GROUPS
  },
  'robinhood-chain': {
    networkId: 'robinhood-chain',
    primaryItems: [
      { id: 'rh-signal-desk', href: '/rh-chain-signal-desk', label: 'Signal Desk', compactPriority: true },
      { id: 'rh-meme-pulse', href: '/rh-chain-signal-desk/meme-pulse', label: 'Meme Pulse', compactPriority: true },
      { id: 'rh-4663-index', href: '/rh-chain-signal-desk/4663-index', label: '4663 Index' },
      { id: 'rh-receipts', href: '/rh-chain-signal-desk/daily-receipts', label: 'Receipts', compactPriority: true, activePrefixes: ['/rh-chain-signal-desk/daily-receipts/'] },
      { id: 'rh-submit', href: '/rh-chain-signal-desk/submit', label: 'Submit' }
    ],
    overflowGroups: [
      {
        id: 'rh-intelligence',
        label: 'Intelligence',
        items: [
          { id: 'rh-risk', href: '/rh-chain-signal-desk/clone-radar', label: 'Risk' },
          { id: 'rh-patterns', href: '/rh-chain-signal-desk/risk-patterns', label: 'Patterns' },
          { id: 'rh-observatory', href: '/rh-chain-signal-desk/launchpad-observatory', label: 'Observatory' },
          { id: 'rh-market-structure', href: '/rh-chain-signal-desk/market-structure', label: 'Market Structure' },
          { id: 'rh-snapshot', href: '/rh-chain-signal-desk/live-snapshot', label: 'Snapshot' }
        ]
      },
      {
        id: 'rh-scouting',
        label: 'Scouting',
        items: [
          { id: 'rh-scout-network', href: '/rh-chain-signal-desk/scouts', label: 'Scout Network' },
          { id: 'rh-scout-agent', href: '/rh-chain-signal-desk/scout', label: 'Scout Agent' }
        ]
      },
      {
        id: 'rh-operations',
        label: 'Operations',
        items: [
          { id: 'rh-100-receipts', href: '/rh-chain-signal-desk/100-receipts', label: '100 Receipts' },
          { id: 'rh-review-pipeline', href: '/rh-chain-signal-desk/review-pipeline', label: 'Review Pipeline', activePrefixes: ['/rh-chain-signal-desk/review-pipeline/'] },
          { id: 'rh-review-queue', href: '/rh-chain-signal-desk/review-queue', label: 'Review Queue' },
          { id: 'rh-review-console', href: '/internal/rh-chain/review-console', label: 'Review Console' },
          { id: 'rh-surface-watch', href: '/rh-chain-signal-desk/launch-surfaces', label: 'Surface Watch' },
          { id: 'rh-distribution-packs', href: '/rh-chain-signal-desk/distribution-pack', label: 'Distribution Packs' }
        ]
      },
      {
        id: 'rh-developers',
        label: 'Developers',
        items: [{ id: 'rh-api', href: '/openapi.json', label: 'API', external: true }]
      }
    ]
  }
};

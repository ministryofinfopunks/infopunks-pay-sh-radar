import React, { useEffect, useId, useRef, useState } from 'react';
import { radarNetworkForPath, type RadarNavigationContext, type RadarNetworkId } from './bootContext';

export { radarNetworkForPath, type RadarNavigationContext, type RadarNetworkId } from './bootContext';

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
  label: string;
  href: string;
  description?: string;
  compactPriority?: boolean;
  external?: boolean;
  activePrefixes?: readonly string[];
};

export type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
};

export type NetworkNavigation = {
  networkId: RadarNavigationContext;
  primaryItems: readonly NavigationItem[];
  overflowGroups: readonly NavigationGroup[];
};

export const RADAR_NETWORKS: Record<RadarNetworkId, RadarNetwork> = {
  solana: {
    id: 'solana',
    label: 'Solana Radar',
    shortLabel: 'Solana',
    contextLabel: 'Solana',
    economy: 'The agentic economy',
    description: 'Pre-spend intelligence for services, providers, routes, projects and machine payments.',
    selectorDescription: 'Agent routes, Pay.sh and project intelligence',
    href: '/#global-pulse',
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

export const RADAR_NAVIGATION: Record<RadarNavigationContext, NetworkNavigation> = {
  universal: {
    networkId: 'universal',
    primaryItems: [
      { href: '/', label: 'Overview', compactPriority: true },
      { href: '/#radar-network-entry-title', label: 'Networks', compactPriority: true }
    ],
    overflowGroups: [
      {
        label: 'Radar',
        items: [
          { href: '/#methodology', label: 'Methodology' },
          { href: '/#events', label: 'Events' }
        ]
      },
      {
        label: 'Developers',
        items: [
          { href: '/openapi.json', label: 'API', external: true },
          { href: '/developers', label: 'Developer Documentation' }
        ]
      }
    ]
  },
  solana: {
    networkId: 'solana',
    primaryItems: [
      { href: '/#global-pulse', label: 'Overview', compactPriority: true },
      { href: '/providers', label: 'Providers', compactPriority: true, activePrefixes: ['/providers/'] },
      { href: '/routes', label: 'Routes', compactPriority: true, activePrefixes: ['/routes/'] },
      { href: '/receipts', label: 'Receipts', activePrefixes: ['/receipts/'] },
      { href: '/benchmarks', label: 'Benchmarks', activePrefixes: ['/benchmarks/'] }
    ],
    overflowGroups: [
      {
        label: 'Intelligence',
        items: [
          { href: '/signal-hunt', label: 'Signal Hunt', description: 'Emerging signals with evidence', activePrefixes: ['/signal-hunt/'] },
          { href: '/narratives', label: 'Narratives', description: 'Cultural intelligence desk' },
          { href: '/unicorn-radar', label: 'Unicorn Radar', description: 'Early company and project watch', activePrefixes: ['/unicorn-radar/'] },
          { href: '/graph', label: 'Signal Graph', description: 'Claims, receipts and relationships' },
          { href: '/narratives/attention-markets', label: 'Attention Markets', description: 'Markets formed around attention' },
          { href: '/narratives/attention-market-watch', label: 'Attention Market Watch', description: 'Live attention market profiles', activePrefixes: ['/attention-market-watch/'] },
          { href: '/abundance', label: 'Abundance Desk', description: 'Machine abundance intelligence', activePrefixes: ['/narratives/abundance-desk'] },
          { href: '/signals/ansem', label: 'Ansem', description: 'Source intelligence file' },
          { href: '/signals/black-bull', label: 'Black Bull', description: 'Narrative signal report' },
          { href: '/signals/troll', label: 'TROLL', description: 'Narrative signal report' }
        ]
      },
      {
        label: 'Agent Tools',
        items: [
          { href: '/check', label: 'Check', description: 'Verify a claim before action', activePrefixes: ['/check/'] },
          { href: '/loops', label: 'Loops', description: 'Run and inspect proof loops', activePrefixes: ['/loops/'] },
          { href: '/hermes', label: 'Hermes Desk', description: 'Agentic investigations before spend' },
          { href: '/#agent-benchmark-api', label: 'Agent Benchmarks', description: 'Benchmark agent readiness' },
          { href: '/radar/cards', label: 'Preflight Cards', description: 'Shareable decision artifacts', activePrefixes: ['/radar/cards/'] },
          { href: '/claim', label: 'Claims', description: 'Judgments backed by receipts', activePrefixes: ['/claim/'] },
          { href: '/#route-mapping-registry', label: 'Route Mappings', description: 'Provider-to-endpoint coverage' },
          { href: '/#preflight', label: 'Preflight', description: 'Check a route before payment' },
          { href: '/#compare', label: 'Compare', description: 'Compare routes and providers' },
          { href: '/#dossier', label: 'Provider Dossier', description: 'Inspect provider evidence' },
          { href: '/spend-terminal', label: 'Pre-Spend Terminal', description: 'Decision surface for agents' }
        ]
      },
      {
        label: 'Hermes',
        items: [
          { href: '/hermes/memory-loop', label: 'Memory Loop', description: 'Outcomes that change future action' },
          { href: '/hermes/pre-spend-decision', label: 'Pre-Spend Decision', description: 'Check the ledger before spend' },
          { href: '/hermes/spend-policy', label: 'Spend Policy', description: 'Bound wallet authority' },
          { href: '/hermes/decision-feedback', label: 'Decision Feedback', description: 'Record what happened next' },
          { href: '/hermes/wallet-audit-trail', label: 'Wallet Audit Trail', description: 'Explain every wallet decision' },
          { href: '/hermes/wallet-risk-score', label: 'Wallet Risk Score', description: 'Actionable wallet risk' },
          { href: '/hermes/wallet-safety', label: 'Wallet Safety API', description: 'One safety check before spend' },
          { href: '/hermes/reputation-ledger', label: 'Reputation Ledger', description: 'Judgment accumulated over time' },
          { href: '/hermes/skill-pack', label: 'Skill Pack', description: 'Investigation skills for agents' },
          { href: '/narratives/hermes-desk', label: 'Narrative', description: 'The Hermes intelligence thesis' }
        ]
      },
      {
        label: 'Commercial',
        items: [
          { href: '/evaluation-request', label: 'Evaluation Request', description: 'Request a commercial evaluation' },
          { href: '/revenue-receipts', label: 'Revenue Receipts', description: 'Evidence of commercial outcomes', activePrefixes: ['/revenue-receipts/'] }
        ]
      },
      {
        label: 'Machine Economy',
        items: [
          { href: '/machine-market', label: 'Machine Market', description: 'Machine-service market map' },
          { href: '/machine-rail-coverage', label: 'Rail Coverage', description: 'Payment rail availability' },
          { href: '/machine-route-risk-matrix', label: 'Route Risk', description: 'Risk across machine routes' },
          { href: '/machine-first-safe-routes', label: 'First Safe Queue', description: 'Safest candidates to test first' },
          { href: '/machine-benchmark-readiness', label: 'Benchmark Readiness', description: 'Evidence readiness by service' },
          { href: '/machine-benchmark-methodology', label: 'Benchmark Methodology', description: 'How readiness is measured' },
          { href: '/machine-comparable-routes', label: 'Comparable Routes', description: 'Like-for-like route evidence' },
          { href: '/machine-translation-evidence', label: 'Translation Evidence', description: 'Translation route proof' },
          { href: '/machine-proof-ladder', label: 'Proof Ladder', description: 'Progress from listing to proof' },
          { href: '/machine-execution-shortlist', label: 'Proof Plans', description: 'Controlled execution shortlist' },
          { href: '/machine-execution-blockers', label: 'Execution Blockers', description: 'What prevents a safe run' },
          { href: '/machine-market-changelog', label: 'Changelog', description: 'Market intelligence changes' },
          { href: '/machine-no-claim-ledger', label: 'No-Claim Ledger', description: 'Claims Radar refuses to make' },
          { href: '/machine-readiness-matrix', label: 'Readiness Matrix', description: 'Readiness across the market' },
          { href: '/machine-market-map', label: 'Market Map', description: 'Services, rails and sources' },
          { href: '/machine-receipts', label: 'Machine Receipts', description: 'Execution evidence ledger' },
          { href: '/machine-economy-snapshot', label: 'Snapshot', description: 'Current machine economy state' }
        ]
      },
      {
        label: 'Developers',
        items: [
          { href: '/openapi.json', label: 'API', description: 'OpenAPI specification', external: true },
          { href: '/developers', label: 'Developer Documentation', description: 'Integration guides and examples', activePrefixes: ['/developers/'] },
          { href: '/v1/hermes', label: 'Hermes JSON', description: 'Machine-readable Hermes state', external: true },
          { href: '/v1/hermes/health', label: 'Hermes Health', description: 'Service health endpoint', external: true },
          { href: '/#methodology', label: 'Methodology', description: 'How Radar forms judgment' },
          { href: '/#events', label: 'Events', description: 'Recent evidence events' }
        ]
      }
    ]
  },
  'robinhood-chain': {
    networkId: 'robinhood-chain',
    primaryItems: [
      { href: '/rh-chain-signal-desk', label: 'Signal Desk', compactPriority: true },
      { href: '/rh-chain-signal-desk/meme-pulse', label: 'Meme Pulse', compactPriority: true },
      { href: '/rh-chain-signal-desk/4663-index', label: '4663 Index' },
      { href: '/rh-chain-signal-desk/daily-receipts', label: 'Receipts', compactPriority: true, activePrefixes: ['/rh-chain-signal-desk/daily-receipts/'] },
      { href: '/rh-chain-signal-desk/submit', label: 'Submit' }
    ],
    overflowGroups: [
      {
        label: 'Intelligence',
        items: [
          { href: '/rh-chain-signal-desk/clone-radar', label: 'Risk' },
          { href: '/rh-chain-signal-desk/risk-patterns', label: 'Patterns' },
          { href: '/rh-chain-signal-desk/launchpad-observatory', label: 'Observatory' },
          { href: '/rh-chain-signal-desk/live-snapshot', label: 'Snapshot' }
        ]
      },
      {
        label: 'Scouting',
        items: [
          { href: '/rh-chain-signal-desk/scouts', label: 'Scout Network' },
          { href: '/rh-chain-signal-desk/scout', label: 'Scout Agent' }
        ]
      },
      {
        label: 'Operations',
        items: [
          { href: '/rh-chain-signal-desk/review-queue', label: 'Review Queue' },
          { href: '/internal/rh-chain/review-console', label: 'Review Console' },
          { href: '/rh-chain-signal-desk/launch-surfaces', label: 'Surface Watch' },
          { href: '/rh-chain-signal-desk/distribution-pack', label: 'Distribution Packs' }
        ]
      },
      {
        label: 'Developers',
        items: [{ href: '/openapi.json', label: 'API', external: true }]
      }
    ]
  }
};

function menuItems(menu: HTMLElement | null) {
  const compactNavigation = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 1180px)').matches
    : false;
  return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]') ?? [])
    .filter((item) => compactNavigation || !item.classList.contains('compact-primary-duplicate'));
}

function PopupMenu({
  className,
  triggerClassName,
  triggerLabel,
  triggerAriaLabel,
  menuClassName,
  menuLabel,
  active = false,
  children
}: {
  className: string;
  triggerClassName: string;
  triggerLabel: React.ReactNode;
  triggerAriaLabel: string;
  menuClassName: string;
  menuLabel: string;
  active?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const closeOnFocusLeave = (event: FocusEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('focusin', closeOnFocusLeave);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('focusin', closeOnFocusLeave);
    };
  }, [open]);

  function focusItem(index: number) {
    const items = menuItems(menuRef.current);
    if (!items.length) return;
    items[(index + items.length) % items.length]?.focus();
  }

  function openAndFocus(index: number) {
    setOpen(true);
    window.requestAnimationFrame(() => focusItem(index));
  }

  return <div className={`${className}${open ? ' open' : ''}${active ? ' active' : ''}`} ref={controlRef}>
    <button
      ref={triggerRef}
      className={triggerClassName}
      type="button"
      aria-label={triggerAriaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openAndFocus(event.key === 'ArrowDown' ? 0 : -1);
      }}
    >
      {triggerLabel}
    </button>
    <div
      ref={menuRef}
      id={menuId}
      className={menuClassName}
      role="menu"
      aria-label={menuLabel}
      hidden={!open}
      onKeyDown={(event) => {
        const items = menuItems(menuRef.current);
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          focusItem(currentIndex + (event.key === 'ArrowDown' ? 1 : -1));
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          focusItem(event.key === 'Home' ? 0 : -1);
        }
      }}
    >
      {children(() => setOpen(false))}
    </div>
  </div>;
}

export function RadarNetworkSelector({ active }: { active: RadarNetworkId | null }) {
  const activeNetwork = active ? RADAR_NETWORKS[active] : null;
  const triggerLabel = activeNetwork?.shortLabel ?? 'All Networks';

  return <PopupMenu
    className={`radar-network-control ${active ? `network-${active}` : 'network-universal'}`}
    triggerClassName="radar-network-trigger"
    triggerAriaLabel={activeNetwork ? `${activeNetwork.contextLabel} network. Switch Radar network` : 'All Networks. Choose Radar network'}
    triggerLabel={<>
      <span className="radar-network-trigger-label">{activeNetwork ? 'Network' : 'Scope'}</span>
      <strong><span className="network-status-dot" aria-hidden="true" />{triggerLabel}</strong>
      <span className="radar-network-chevron" aria-hidden="true">⌄</span>
    </>}
    menuClassName="radar-network-menu"
    menuLabel="Radar networks"
  >
    {(close) => <>
      <p className="radar-network-menu-heading">One Radar. Two economies.</p>
      {RADAR_NETWORK_LIST.map((network) => <a
        key={network.id}
        className={`radar-network-option network-${network.id}${network.id === active ? ' active' : ''}`}
        href={network.href}
        role="menuitem"
        aria-current={network.id === active ? 'page' : undefined}
        onClick={close}
      >
        <span className="network-option-mark" aria-hidden="true" />
        <span><strong>{network.contextLabel}</strong><small>{network.selectorDescription}</small></span>
        <span className="network-option-state">{network.id === active ? 'Active' : 'Open'}</span>
      </a>)}
    </>}
  </PopupMenu>;
}

function currentLocation() {
  return typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.hash}`;
}

export function navigationItemIsActive(item: NavigationItem, current: string) {
  const [currentPath, currentHash = ''] = current.split('#');
  const [itemPath, itemHash = ''] = item.href.split('#');
  if (itemHash) return currentPath === itemPath && currentHash === itemHash;
  if (currentPath === itemPath || (itemPath !== '/' && currentPath === `${itemPath}/`)) return true;
  return item.activePrefixes?.some((prefix) => currentPath.startsWith(prefix)) ?? false;
}

function NavigationLink({ item, current, onNavigate, compactDuplicate = false }: { item: NavigationItem; current: string; onNavigate?: () => void; compactDuplicate?: boolean }) {
  const active = navigationItemIsActive(item, current);
  return <a
    href={item.href}
    role={onNavigate ? 'menuitem' : undefined}
    className={`${active ? 'active' : ''}${compactDuplicate ? ' compact-primary-duplicate' : ''}`.trim()}
    aria-current={active ? 'page' : undefined}
    target={item.external ? '_blank' : undefined}
    rel={item.external ? 'noreferrer' : undefined}
    onClick={onNavigate}
  >
    <span className="radar-navigation-link-copy">
      <strong>{item.label}</strong>
      {item.description && <small>{item.description}</small>}
    </span>
    {item.external && <span className="radar-navigation-link-state" aria-label="Opens in a new tab">↗</span>}
  </a>;
}

function NavigationGroups({ groups, current, onNavigate, directory = false }: { groups: readonly NavigationGroup[]; current: string; onNavigate?: () => void; directory?: boolean }) {
  return <>{groups.map((group) => <div className={`radar-menu-group${directory ? ' radar-directory-group' : ''}`} key={group.label} role="group" aria-label={group.label}>
    <span className="radar-menu-heading">{group.label}</span>
    {group.items.map((item) => <NavigationLink key={`${group.label}-${item.href}-${item.label}`} item={item} current={current} onNavigate={onNavigate} />)}
  </div>)}</>;
}

export function SolanaRadarDirectory({ current = currentLocation() }: { current?: string }) {
  return <section className="radar-route-directory" id="explore-solana-radar" aria-labelledby="explore-solana-radar-title">
    <div className="radar-route-directory-head">
      <div>
        <p className="section-kicker">All intelligence surfaces</p>
        <h2 id="explore-solana-radar-title">Explore Solana Radar</h2>
      </div>
      <p>Signal extraction, pre-spend decisions, wallet memory and machine-economy evidence—organized by the job you need done.</p>
    </div>
    <div className="radar-route-directory-grid">
      <NavigationGroups groups={RADAR_NAVIGATION.solana.overflowGroups} current={current} directory />
    </div>
  </section>;
}

export function RadarHeaderIdentity({ active, context = active ?? 'universal', homeHref = '/' }: { active?: RadarNetworkId; context?: RadarNavigationContext; homeHref?: string }) {
  const selectedNetwork = context === 'universal' ? null : context;
  return <div className="radar-network-identity">
    <a className="nav-brand" href={homeHref} aria-label="Infopunks Radar home">
      <span>Infopunks</span>
      <strong>Radar</strong>
    </a>
    <RadarNetworkSelector active={selectedNetwork} />
  </div>;
}

export type RadarViewSettings = {
  agentMode: boolean;
  densityMode: 'comfortable' | 'dense';
  onToggleAgentMode: () => void;
  onToggleDensity: () => void;
};

export function RadarProductNavigation({
  context,
  current = currentLocation(),
  onOpenCommandPalette,
  viewSettings,
  className = ''
}: {
  context: RadarNavigationContext;
  current?: string;
  onOpenCommandPalette?: () => void;
  viewSettings?: RadarViewSettings;
  className?: string;
}) {
  const navigation = RADAR_NAVIGATION[context];
  const contextLabel = context === 'universal' ? 'Radar' : context === 'solana' ? 'Solana' : 'Robinhood Chain';
  const overflowActive = navigation.overflowGroups.some((group) => group.items.some((item) => navigationItemIsActive(item, current)));
  const hasOverflow = navigation.overflowGroups.length > 0;

  const allGroups: NavigationGroup[] = [
    { label: 'Primary', items: navigation.primaryItems },
    ...navigation.overflowGroups
  ];

  return <nav className={`global-toolbar radar-product-navigation context-${context} ${className}`.trim()} aria-label={`${context === 'universal' ? 'Infopunks Radar' : RADAR_NETWORKS[context].contextLabel} navigation`}>
    <RadarHeaderIdentity context={context} />
    <div className="terminal-nav radar-primary-navigation" aria-label="Primary destinations">
      {navigation.primaryItems.map((item) => <span className={item.compactPriority ? 'radar-primary-priority' : 'radar-primary-collapsible'} key={item.href}><NavigationLink item={item} current={current} /></span>)}
    </div>
    {hasOverflow && <PopupMenu
      className="radar-overflow-menu"
      triggerClassName="methodology-trigger radar-menu-trigger"
      triggerLabel={<>Explore <span aria-hidden="true">⌄</span></>}
      triggerAriaLabel={`Explore ${contextLabel} destinations`}
      menuClassName="radar-grouped-menu"
      menuLabel={`${contextLabel} destination directory`}
      active={overflowActive}
    >
      {(close) => <>
        <div className="radar-menu-group radar-compact-primary-group" role="group" aria-label="Collapsed primary destinations">
          <span className="radar-menu-heading">Primary</span>
          {navigation.primaryItems.filter((item) => !item.compactPriority).map((item) => <NavigationLink key={`compact-${item.href}`} item={item} current={current} onNavigate={close} compactDuplicate />)}
        </div>
        <NavigationGroups groups={navigation.overflowGroups} current={current} onNavigate={close} />
      </>}
    </PopupMenu>}
    <PopupMenu
      className="radar-mobile-product-menu"
      triggerClassName="methodology-trigger radar-mobile-menu-trigger"
      triggerLabel={<>Menu <span aria-hidden="true">⌄</span></>}
      triggerAriaLabel={`Open ${context === 'universal' ? 'Radar' : RADAR_NETWORKS[context].shortLabel} product navigation`}
      menuClassName="radar-grouped-menu radar-mobile-menu-panel"
      menuLabel={`${context === 'universal' ? 'Radar' : RADAR_NETWORKS[context].shortLabel} product navigation`}
      active={navigation.primaryItems.some((item) => navigationItemIsActive(item, current)) || overflowActive}
    >
      {(close) => <NavigationGroups groups={allGroups} current={current} onNavigate={close} />}
    </PopupMenu>
    {(onOpenCommandPalette || viewSettings) && <div className="radar-interface-actions" aria-label="Interface controls">
      {onOpenCommandPalette && <button
        className="methodology-trigger radar-command-trigger"
        type="button"
        onClick={onOpenCommandPalette}
        aria-label="Open command palette (Command K or Control K)"
        title="Command palette (⌘K / Ctrl+K)"
      >
        <span aria-hidden="true">⌕</span><kbd>⌘K</kbd>
      </button>}
      {viewSettings && <PopupMenu
        className="radar-settings-menu"
        triggerClassName="methodology-trigger radar-settings-trigger"
        triggerLabel={<><span aria-hidden="true">⚙</span><span className="radar-settings-trigger-label">View</span></>}
        triggerAriaLabel="Open view settings"
        menuClassName="radar-grouped-menu radar-settings-panel"
        menuLabel="View settings"
      >
        {(close) => <div className="radar-menu-group" role="group" aria-label="View Settings">
          <span className="radar-menu-heading">View Settings</span>
          <button role="menuitemcheckbox" aria-checked={viewSettings.agentMode} type="button" onClick={() => { viewSettings.onToggleAgentMode(); close(); }}>
            <span>Agent Mode</span><strong>{viewSettings.agentMode ? 'On' : 'Off'}</strong>
          </button>
          <button role="menuitemcheckbox" aria-checked={viewSettings.densityMode === 'comfortable'} type="button" onClick={() => { viewSettings.onToggleDensity(); close(); }}>
            <span>Comfortable Density</span><strong>{viewSettings.densityMode === 'comfortable' ? 'On' : 'Off'}</strong>
          </button>
        </div>}
      </PopupMenu>}
    </div>}
  </nav>;
}

export function RadarContextHeader({ active = 'solana', current }: { active?: RadarNetworkId; current?: string }) {
  return <header className="site-header radar-context-header">
    <RadarProductNavigation context={active} current={current} />
  </header>;
}

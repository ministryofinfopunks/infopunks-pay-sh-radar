import React, { useEffect, useId, useRef, useState } from 'react';

export type RadarNetworkId = 'solana' | 'robinhood-chain';

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
      'Pay.sh route intelligence',
      'Provider and endpoint evaluation',
      'Preflight checks',
      'Benchmarks and receipts',
      'Unicorn Radar',
      'Narrative intelligence'
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
      'Token Dossiers',
      'Clone Radar',
      'Signal submissions',
      'Review Queue',
      'Live Snapshots'
    ]
  }
};

export const RADAR_NETWORK_LIST = [RADAR_NETWORKS.solana, RADAR_NETWORKS['robinhood-chain']] as const;

export function radarNetworkForPath(pathname: string): RadarNetworkId {
  return /^\/(?:rh-chain-signal-desk|narratives\/robinhood-chain)(?:\/|$)/.test(pathname)
    || /^\/internal\/rh-chain(?:\/|$)/.test(pathname)
    ? 'robinhood-chain'
    : 'solana';
}

export function RadarNetworkSelector({ active }: { active: RadarNetworkId }) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const activeNetwork = RADAR_NETWORKS[active];

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
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function focusMenuItem(index: number) {
    const items = menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]');
    if (!items?.length) return;
    items[(index + items.length) % items.length]?.focus();
  }

  return <div className={`radar-network-control network-${active}`} ref={controlRef}>
    <button
      ref={triggerRef}
      className="radar-network-trigger"
      type="button"
      aria-label={`Network: ${activeNetwork.contextLabel}. Switch Radar network`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        setOpen(true);
        window.requestAnimationFrame(() => focusMenuItem(0));
      }}
    >
      <span className="radar-network-trigger-label">Network</span>
      <strong><span className="network-status-dot" aria-hidden="true" />{activeNetwork.shortLabel}</strong>
      <span className="radar-network-chevron" aria-hidden="true">⌄</span>
    </button>
    <div
      ref={menuRef}
      id={menuId}
      className="radar-network-menu"
      role="menu"
      aria-label="Radar networks"
      hidden={!open}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
        const currentIndex = items.indexOf(document.activeElement as HTMLAnchorElement);
        focusMenuItem(currentIndex + (event.key === 'ArrowDown' ? 1 : -1));
      }}
    >
      <p className="radar-network-menu-heading">One Radar. Two economies.</p>
      {RADAR_NETWORK_LIST.map((network) => <a
        key={network.id}
        className={`radar-network-option network-${network.id}${network.id === active ? ' active' : ''}`}
        href={network.href}
        role="menuitem"
        aria-current={network.id === active ? 'page' : undefined}
        onClick={() => setOpen(false)}
      >
        <span className="network-option-mark" aria-hidden="true" />
        <span><strong>{network.contextLabel}</strong><small>{network.selectorDescription}</small></span>
        <span className="network-option-state">{network.id === active ? 'Active' : 'Open'}</span>
      </a>)}
    </div>
  </div>;
}

export function RadarHeaderIdentity({ active, homeHref = '/' }: { active: RadarNetworkId; homeHref?: string }) {
  const network = RADAR_NETWORKS[active];
  return <div className="radar-network-identity">
    <a className="nav-brand" href={homeHref} aria-label={`Infopunks / ${network.contextLabel} home`}>
      <span>Infopunks</span>
      <strong><span className="radar-brand-divider" aria-hidden="true">/</span> {network.contextLabel}</strong>
    </a>
    <RadarNetworkSelector active={active} />
  </div>;
}

export function RadarContextHeader({ active = 'solana' }: { active?: RadarNetworkId }) {
  const links = active === 'solana'
    ? [
        ['/#global-pulse', 'Radar'],
        ['/providers', 'Providers'],
        ['/routes', 'Routes'],
        ['/receipts', 'Receipts'],
        ['/benchmarks', 'Benchmarks']
      ] as const
    : [
        ['/rh-chain-signal-desk', 'Signal Desk'],
        ['/rh-chain-signal-desk/meme-pulse', 'Meme Pulse'],
        ['/rh-chain-signal-desk/daily-receipts', 'Receipts']
      ] as const;

  return <header className="site-header radar-context-header">
    <nav className="global-toolbar radar-context-toolbar" aria-label={`${RADAR_NETWORKS[active].contextLabel} Radar navigation`}>
      <RadarHeaderIdentity active={active} />
      <div className="terminal-nav terminal-nav-scroll-rail" aria-label={`${RADAR_NETWORKS[active].contextLabel} routes`}>
        {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
      </div>
    </nav>
  </header>;
}

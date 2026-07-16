import React, { useEffect, useId, useRef, useState } from 'react';
import { radarNetworkForPath, type RadarNavigationContext, type RadarNetworkId } from './bootContext';
import {
  RADAR_NAVIGATION,
  RADAR_NETWORKS,
  RADAR_NETWORK_LIST,
  featuredItemsForGroup,
  type NavigationGroup,
  type NavigationItem
} from './radarNavigationCatalog';

export { radarNetworkForPath, type RadarNavigationContext, type RadarNetworkId } from './bootContext';
export {
  RADAR_NAVIGATION,
  RADAR_NETWORKS,
  RADAR_NETWORK_LIST,
  SOLANA_GROUP_ORDER,
  SOLANA_SURFACE_GROUPS,
  featuredItemsForGroup,
  type NavigationGroup,
  type NavigationItem,
  type NetworkNavigation,
  type RadarNetwork,
  type RadarSurfaceGroup,
  type RadarSurfaceStatus
} from './radarNavigationCatalog';

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

function NavigationLink({ item, current, onNavigate, compactDuplicate = false, showDescription = false }: { item: NavigationItem; current: string; onNavigate?: () => void; compactDuplicate?: boolean; showDescription?: boolean }) {
  const active = navigationItemIsActive(item, current);
  return <a
    href={item.href}
    role={onNavigate ? 'menuitem' : undefined}
    className={`${active ? 'active ' : ''}${item.featured ? 'featured-route ' : 'secondary-route '}${compactDuplicate ? 'compact-primary-duplicate' : ''}`.trim()}
    aria-current={active ? 'page' : undefined}
    data-route-id={item.id}
    target={item.external ? '_blank' : undefined}
    rel={item.external ? 'noreferrer' : undefined}
    onClick={onNavigate}
  >
    <span className="radar-navigation-link-copy">
      <strong>{item.label}</strong>
      {showDescription && item.description && <small>{item.description}</small>}
    </span>
    {item.external && <span className="radar-navigation-link-state" aria-label="Opens in a new tab">↗</span>}
  </a>;
}

function NavigationGroups({ groups, current, onNavigate }: { groups: readonly NavigationGroup[]; current: string; onNavigate?: () => void }) {
  return <>{groups.map((group) => <div className="radar-menu-group" key={group.id} role="group" aria-label={group.label} data-group-id={group.id}>
    <span className="radar-menu-heading">{group.label}</span>
    {group.items.map((item) => <NavigationLink key={`${group.label}-${item.href}-${item.label}`} item={item} current={current} onNavigate={onNavigate} />)}
  </div>)}</>;
}

function SolanaExploreMenuIntro() {
  return <div className="radar-menu-intro" role="presentation">
    <strong>Explore Solana Radar</strong>
    <span>Intelligence, agent tools, machine markets and evidence infrastructure.</span>
  </div>;
}

export function SolanaRadarDirectory({ current = currentLocation() }: { current?: string }) {
  return <section className="radar-route-directory" id="explore-solana-radar" aria-labelledby="explore-solana-radar-title">
    <div className="radar-route-directory-head">
      <div>
        <p className="section-kicker">Featured product surfaces</p>
        <h2 id="explore-solana-radar-title">Explore Solana Radar</h2>
      </div>
      <p>A map of the intelligence, evidence and execution surfaces available across the Solana environment.</p>
    </div>
    <div className="radar-route-directory-grid">
      {RADAR_NAVIGATION.solana.overflowGroups.map((group) => {
        const featuredItems = featuredItemsForGroup(group);
        const groupTitleId = `solana-directory-${group.id}`;
        return <article className="radar-directory-card" key={group.id} aria-labelledby={groupTitleId} data-group-id={group.id}>
          <div className="radar-directory-card-head">
            <h3 id={groupTitleId}>{group.label}</h3>
            <span>{featuredItems.length.toString().padStart(2, '0')}</span>
          </div>
          <p>{group.description}</p>
          <div className="radar-directory-featured-routes">
            {featuredItems.map((item) => <NavigationLink key={item.id} item={item} current={current} showDescription />)}
          </div>
          {featuredItems[0] && <a className="radar-directory-explore-action" href={featuredItems[0].href}>
            Explore {group.label.toLocaleLowerCase()}<span aria-hidden="true"> →</span>
          </a>}
        </article>;
      })}
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

  const primaryGroup: NavigationGroup = { id: 'primary', label: 'Primary', items: navigation.primaryItems };
  const allGroups: NavigationGroup[] = [
    primaryGroup,
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
        {context === 'solana' && <SolanaExploreMenuIntro />}
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
      {(close) => context === 'solana' ? <>
        <NavigationGroups groups={[primaryGroup]} current={current} onNavigate={close} />
        <SolanaExploreMenuIntro />
        <NavigationGroups groups={navigation.overflowGroups} current={current} onNavigate={close} />
      </> : <NavigationGroups groups={allGroups} current={current} onNavigate={close} />}
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

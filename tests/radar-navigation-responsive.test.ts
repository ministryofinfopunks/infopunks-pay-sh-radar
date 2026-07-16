import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Radar navigation responsive CSS contracts', () => {
  it('hides desktop primary navigation behind the single mobile menu', async () => {
    const styles = await readFile(new URL('../src/web/styles.css', import.meta.url), 'utf8');

    expect(styles).toContain(`@media (max-width: 820px) {
  .site-header .radar-product-navigation`);
    expect(styles).toContain(`.site-header .radar-primary-navigation,
  .site-header .radar-overflow-menu {
    display: none;
  }`);
    expect(styles).toContain(`.radar-mobile-product-menu {
    display: block;`);
  });

  it('contains desktop and mobile route directories inside the viewport', async () => {
    const styles = await readFile(new URL('../src/web/styles.css', import.meta.url), 'utf8');

    expect(styles).toContain('width: min(1040px, calc(100vw - 48px));');
    expect(styles).toContain('max-height: min(74vh, calc(100vh - 104px));');
    expect(styles).toContain(`.radar-mobile-menu-panel {
    right: 0;
    left: 0;`);
    expect(styles).toContain(`.radar-route-directory-grid {
    grid-template-columns: minmax(0, 1fr);`);
    expect(styles).toContain('min-height: 44px;');
  });

  it('keeps pure route data separate from React rendering and removes the old duplicated arrays', async () => {
    const catalog = await readFile(new URL('../src/web/radarNavigationCatalog.ts', import.meta.url), 'utf8');
    const components = await readFile(new URL('../src/web/radarNetworks.tsx', import.meta.url), 'utf8');

    expect(catalog).not.toMatch(/import React/);
    expect(catalog).toContain('export const SOLANA_SURFACE_GROUPS');
    expect(catalog).toContain('featured?: boolean;');
    expect(components).not.toContain('overflowGroups: [');
  });
});

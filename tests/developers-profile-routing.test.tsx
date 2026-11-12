// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/web/main';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Developers profile route selection', () => {
  let root: Root | undefined;
  let container: HTMLDivElement;
  let originalPath: string;
  let profileMeta: HTMLMetaElement;

  beforeEach(() => {
    originalPath = window.location.pathname;
    container = document.createElement('div');
    document.body.append(container);
    profileMeta = document.createElement('meta');
    profileMeta.name = 'radar-operating-profile';
    document.head.append(profileMeta);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    container.remove();
    profileMeta.remove();
    window.history.replaceState({}, '', originalPath);
  });

  async function render(profile: 'frontdoor-only' | 'full-stack', path: string) {
    if (profile === 'full-stack') await import('../src/web/radarApp');
    else await import('../src/web/developersStaticPage');
    profileMeta.content = profile;
    window.history.replaceState({}, '', path);
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
      await Promise.resolve();
    });
  }

  it('selects the original full-stack app at /developers when front-door mode is disabled', async () => {
    await render('full-stack', '/developers');
    expect(container.querySelector('.developers-page')).not.toBeNull();
    expect(container.textContent).toContain('Before your agent pays, it checks Infopunks.');
    expect(container.textContent).toContain('createInfopunksPreSpendClient');
    expect(container.querySelector('.developers-static')).toBeNull();
  });

  it('selects the static guide only for the exact front-door Developers route', async () => {
    await render('frontdoor-only', '/developers');
    expect(container.querySelector('.developers-static')).not.toBeNull();
    expect(container.querySelector('.developers-page')).toBeNull();
    expect(container.textContent).toContain('Documentation only.');
  });
});

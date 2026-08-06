// @vitest-environment jsdom
import React, { lazy, Suspense } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '../src/web/appErrorBoundary';
import { UniversalHomepage } from '../src/web/homepage';

describe('root Radar error containment', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows the accessible Radar fallback for a child render error and retries successfully', async () => {
    let shouldThrow = true;
    function FragileRoute() {
      if (shouldThrow) throw new Error('render failed');
      return <p>Route recovered</p>;
    }

    await act(async () => {
      root = createRoot(container);
      root.render(<AppErrorBoundary><FragileRoute /></AppErrorBoundary>);
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('INITIALIZATION DELAYED');
    shouldThrow = false;
    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Route recovered');
  });

  it('contains a rejected lazy route import instead of leaving a blank screen', async () => {
    const RejectedRoute = lazy(() => Promise.reject(new Error('route chunk unavailable')));
    await act(async () => {
      root = createRoot(container);
      root.render(<AppErrorBoundary><Suspense fallback={<p>Loading route</p>}><RejectedRoute /></Suspense></AppErrorBoundary>);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Retry');
  });

  it('offers a document reload recovery path for a failed route chunk', async () => {
    const onReload = vi.fn();
    function BrokenRoute(): never { throw new Error('route failed'); }
    await act(async () => {
      root = createRoot(container);
      root.render(<AppErrorBoundary onReload={onReload}><BrokenRoute /></AppErrorBoundary>);
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reload')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('leaves the universal homepage rendering normally', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await act(async () => {
      root = createRoot(container);
      root.render(<AppErrorBoundary><UniversalHomepage /></AppErrorBoundary>);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Intelligence before the wallet acts.');
  });

  it('keeps radarApp behind React.lazy in the root entry', async () => {
    const source = await readFile(join(process.cwd(), 'src/web/main.tsx'), 'utf8');
    expect(source).toContain("lazy(() => import('./radarApp'))");
    expect(source).not.toContain("from './radarApp'");
    expect(source).toContain('<AppErrorBoundary><App /></AppErrorBoundary>');
  });
});

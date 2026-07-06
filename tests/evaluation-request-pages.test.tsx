// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/web/main';

function pathOf(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, 'http://localhost').pathname;
}

function mockFetch() {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const path = pathOf(input);
    if (path === '/v1/evaluation-request') {
      return Promise.resolve(new Response(JSON.stringify({
        data: {
          request_id: 'er_20260706103000_abc123',
          status: 'manual_delivery_required',
          generated_at: '2026-07-06T10:30:00.000Z',
          disclosure_acknowledged: true,
          revenue_receipt_policy: 'Paid evaluations may receive public Revenue Receipts. Payment buys evaluation, not conviction.',
          next_steps: [
            'Copy the request packet below.',
            'Send it to Infopunks through the current manual intake channel.'
          ],
          request_packet: '{\"request_id\":\"er_20260706103000_abc123\"}'
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return Promise.resolve(new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
  }));
}

describe('evaluation request pages', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockFetch();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('renders /evaluation-request hero, doctrine line, form fields, and disclosure checkbox', async () => {
    window.history.pushState({}, '', '/evaluation-request');

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('Request an Infopunks Evaluation');
    expect(container.textContent).toContain('Payment buys evaluation, not conviction.');
    expect(container.textContent).toContain('Submit receipts for Unicorn Radar, token survivability, risk review, agent readiness, or narrative positioning.');
    expect(container.textContent).toContain('Project name');
    expect(container.textContent).toContain('Upside thesis');
    expect(container.textContent).toContain('I understand payment buys evaluation, not conviction. Any paid status may be publicly disclosed.');
  });

  it('submit UI shows manual delivery state if API returns manual_delivery_required', async () => {
    window.history.pushState({}, '', '/evaluation-request');

    await act(async () => {
      root.render(<App />);
    });

    const form = container.querySelector('form');
    const projectName = container.querySelector('input[name="projectName"]') as HTMLInputElement | null;
    const ticker = container.querySelector('input[name="ticker"]') as HTMLInputElement | null;
    const chain = container.querySelector('input[name="chain"]') as HTMLInputElement | null;
    const contact = container.querySelector('input[name="contact"]') as HTMLInputElement | null;
    const upsideThesis = container.querySelector('textarea[name="upsideThesis"]') as HTMLTextAreaElement | null;
    const riskFlags = container.querySelector('textarea[name="riskFlags"]') as HTMLTextAreaElement | null;
    const disclosure = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

    if (!form || !projectName || !ticker || !chain || !contact || !upsideThesis || !riskFlags || !disclosure) throw new Error('form not rendered');

    await act(async () => {
      projectName.value = 'Kintara';
      projectName.dispatchEvent(new Event('input', { bubbles: true }));
      ticker.value = 'KINS';
      ticker.dispatchEvent(new Event('input', { bubbles: true }));
      chain.value = 'solana';
      chain.dispatchEvent(new Event('input', { bubbles: true }));
      contact.value = 'founder@kintara.com';
      contact.dispatchEvent(new Event('input', { bubbles: true }));
      upsideThesis.value = 'Playable MMO economy.';
      upsideThesis.dispatchEvent(new Event('input', { bubbles: true }));
      riskFlags.value = 'Retention risk.';
      riskFlags.dispatchEvent(new Event('input', { bubbles: true }));
      disclosure.checked = true;
      disclosure.dispatchEvent(new Event('change', { bubbles: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Manual delivery required');
    expect(container.textContent).toContain('Copy the request packet below.');
    expect((container.querySelector('.evaluation-request-packet') as HTMLTextAreaElement | null)?.value).toContain('er_20260706103000_abc123');
  });
});

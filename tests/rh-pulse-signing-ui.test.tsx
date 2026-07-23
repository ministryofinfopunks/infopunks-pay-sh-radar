// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { RhPulseParticipationService } from '../src/services/rhPulseParticipationService';
import { InMemoryRhPulseParticipationStore } from '../src/services/rhPulseParticipationStore';
import { RhPulseService } from '../src/services/rhPulseService';
import { RH_PULSE_CALL_METHODOLOGY_VERSION } from '../src/shared/rhPulseCalls';
import { RhPulseSigningSheet } from '../src/web/rhPulse/RhPulseSigningSheet';
import * as wallet from '../src/web/rhPulse/rhPulseWallet';

vi.mock('../src/web/rhPulse/rhPulseWallet', () => ({
  hasInjectedWallet: vi.fn(() => true),
  walletConnectConfigured: vi.fn(() => false),
  connectInjectedWallet: vi.fn(async () => ({
    kind: 'injected',
    address: '0x82b3C2C59621F9470E7BE242ec4F5b390b05BD00',
    provider: { request: vi.fn() }
  })),
  connectWalletConnect: vi.fn(async () => {
    throw Object.assign(new Error('not configured'), { code: 'walletconnect_unavailable' });
  }),
  signRhPulseMessage: vi.fn(async () => `0x${'11'.repeat(65)}`)
}));

const NOW = new Date('2026-07-23T12:00:00.000Z');
const selected = {
  id: 'agents_to_rwas' as const,
  label: 'Agents → RWAs',
  thesis: 'Agent coordination becomes the next bridge into reviewed real-world-asset markets.',
  supporting_observations: ['One', 'Two'],
  under_watch: true
};

describe('RH Pulse mobile signing sheet', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  async function renderWithAuthority() {
    const store = new InMemoryRhPulseParticipationStore();
    const evidence = new RhPulseService({
      crossLayer: async () => ({
        entries: [],
        captured_at: '2026-07-23T11:55:00.000Z',
        freshness: 'partial',
        confidence: 'low'
      }),
      now: () => NOW,
      cacheTtlMs: 0
    });
    const participation = new RhPulseParticipationService({
      store,
      callsEnabled: true,
      now: () => NOW,
      verify: vi.fn(async () => true) as never,
      readModel: () => evidence.getReadModel(),
      challengeRateLimit: { walletMax: 20, originMax: 20 }
    });
    const window = await participation.createWindow({
      opens_at: NOW.toISOString(),
      closes_at: '2026-07-24T12:00:00.000Z',
      call_submission_closes_at: '2026-07-24T12:00:00.000Z',
      methodology_version: RH_PULSE_CALL_METHODOLOGY_VERSION,
      source_health: {
        state: 'delayed',
        observed_at: NOW.toISOString(),
        detail: 'Test evidence.'
      },
      audit_note: 'Create UI test window.'
    });
    await participation.openWindow(window.id, { audit_note: 'Open UI test window.' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      const payload = 'wallet_address' in body
        ? await participation.createChallenge(body, 'ui-test')
        : await participation.submitCall(body, 'ui-test');
      return new Response(JSON.stringify(buildRhChainApiResponse(payload)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    await act(async () => {
      root = createRoot(container);
      root.render(<RhPulseSigningSheet selected={selected} onClose={vi.fn()} />);
    });
    await vi.waitFor(() => {
      expect(container.querySelector('.rh-pulse-wallet-options')).not.toBeNull();
    });
  }

  it('uses a bottom sheet, honest wallet states and reveals conviction only after a committed call', async () => {
    await renderWithAuthority();
    expect(container.querySelector('[role="dialog"].rh-pulse-signing-sheet')).not.toBeNull();
    expect(container.textContent).toContain('This signature records your prediction. It cannot move funds or approve transactions.');
    expect(container.textContent).toContain('Unavailable — project ID not configured');
    expect(container.textContent).not.toContain('Community conviction');

    const injected = Array.from(container.querySelectorAll<HTMLButtonElement>('.rh-pulse-wallet-options button'))[0];
    await act(async () => injected.click());
    await vi.waitFor(() => {
      expect(container.querySelector('.rh-pulse-message-review pre')?.textContent).toContain('Domain: pulse.infopunks.fun');
    });
    expect(container.querySelector('.rh-pulse-message-review pre')?.textContent).toContain('Call ID: agents_to_rwas');
    expect(container.querySelector('.rh-pulse-message-review pre')?.textContent).toContain('It cannot move funds or approve transactions.');

    const sign = container.querySelector<HTMLButtonElement>('.rh-pulse-sign-action')!;
    await act(async () => sign.click());
    await vi.waitFor(() => {
      expect(container.querySelector('.rh-pulse-accepted-receipt.is-sealed')).not.toBeNull();
    });
    expect(container.textContent).toContain('Your call is on the record.');
    expect(container.textContent).toContain('GENESIS CALL');
    expect(container.textContent).toContain('#0001 / 4663');
    expect(container.textContent).toContain('Community conviction');
    expect(container.textContent).toContain('100%');
  });

  it('reports user rejection without showing an accepted receipt', async () => {
    vi.mocked(wallet.signRhPulseMessage).mockRejectedValueOnce(
      Object.assign(new Error('User rejected'), { code: 'user_rejected' })
    );
    await renderWithAuthority();
    const injected = Array.from(container.querySelectorAll<HTMLButtonElement>('.rh-pulse-wallet-options button'))[0];
    await act(async () => injected.click());
    await vi.waitFor(() => expect(container.querySelector('.rh-pulse-sign-action')).not.toBeNull());
    await act(async () => container.querySelector<HTMLButtonElement>('.rh-pulse-sign-action')!.click());
    await vi.waitFor(() => expect(container.textContent).toContain('Nothing was recorded.'));
    expect(container.querySelector('.rh-pulse-accepted-receipt')).toBeNull();
  });
});

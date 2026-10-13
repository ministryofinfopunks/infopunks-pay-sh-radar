// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RhChainObservedMovers } from '../src/web/rhChainMarketMovers';
import { deriveRhChainMarketMovers } from '../src/services/rhChainMarketMoversService';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';

let cleanup = () => {};
afterEach(() => cleanup());
function render(projection: ReturnType<typeof deriveRhChainMarketMovers>) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  act(() => root.render(<RhChainObservedMovers projection={projection} now={new Date(projection.generated_at)} />));
  cleanup = () => { act(() => root.unmount()); host.remove(); }; return host;
}
describe('observed market rendering', () => {
  it('renders exact identities, source time, coverage and investigation links without reviewed risk labels', () => {
    const host = render(deriveRhChainMarketMovers({ [contract]: moverSamples() }, new Date(moverNow)));
    expect(host.textContent).toContain('Observed significance'); expect(host.textContent).toContain('13 observations');
    expect(host.textContent).toContain(contract); expect(host.querySelector('time')?.getAttribute('datetime')).toBe(moverNow);
    expect([...host.querySelectorAll('a')].some((a) => a.textContent === 'Investigate observation' && a.getAttribute('href')?.includes('observation_id='))).toBe(true);
    expect(host.textContent).not.toMatch(/durable signal|deployer trust|safe to buy|capital inflow/i);
  });
  it('shows an evidence gap rather than an old manual mover when all inputs expire', () => {
    const host = render(deriveRhChainMarketMovers({ [contract]: moverSamples() }, new Date(Date.parse(moverNow) + 16 * 60000)));
    expect(host.textContent).toContain('No current mover meets'); expect(host.textContent).toContain('stale observation');
    expect(host.querySelectorAll('.rh-v2-mover-card')).toHaveLength(0); expect(host.querySelector('details summary')).toBeTruthy();
  });
  it('uses exact-contract card identities for duplicate tickers and exposes semantic region and links', () => {
    const second = '0x' + '2'.repeat(40);
    const host = render(deriveRhChainMarketMovers({ [contract]: moverSamples(), [second]: moverSamples(second, '0x' + 'b'.repeat(64)) }, new Date(moverNow)));
    expect(host.querySelectorAll('.rh-v2-mover-card')).toHaveLength(2);
    expect(host.querySelector('section')?.getAttribute('aria-label')).toBe('Observed 4663 Movers');
    expect([...host.querySelectorAll('a')].filter((a) => a.textContent === 'Investigate observation').map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining([
      expect.stringContaining(contract), expect.stringContaining(second)
    ]));
  });
});

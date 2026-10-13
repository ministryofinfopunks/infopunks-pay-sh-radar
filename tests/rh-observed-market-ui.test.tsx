// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhChainProvenance } from '../src/web/rhChainUi';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { RhChainSignalDeskV2 } from '../src/web/rhChainSignalDeskV2';
import { getRhChainPayload, getRhChainDailyReceipts } from '../src/data/rhChain';
import { assembleRhChain4663Index } from '../src/services/rhChainIntelligenceService';
import { assembleRhChainTodayOn4663 } from '../src/services/rhChainTodayOn4663Service';
import { RhChainObservedMovers } from '../src/web/rhChainMarketMovers';
import { deriveRhChainMarketMovers } from '../src/services/rhChainMarketMoversService';
import { moverSamples, moverContract as contract, moverNow } from './helpers/rhMoverObservations';

let cleanup = () => {};
afterEach(() => { cleanup(); vi.useRealTimers(); });
function renderElement(element: React.ReactElement) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  act(() => root.render(element));
  cleanup = () => { act(() => root.unmount()); host.remove(); }; return host;
}
function render(projection: ReturnType<typeof deriveRhChainMarketMovers>) { return renderElement(<RhChainObservedMovers projection={projection} now={new Date(projection.generated_at)} />); }
describe('observed market rendering', () => {
  it('does not imply that persistence confers review and does not use computation time as observation time', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(moverNow));
    const empty = deriveRhChainMarketMovers({}, new Date(moverNow));
    const host = renderElement(<RhChainProvenance envelope={buildRhChainApiResponse(assembleRhChain4663Index(empty))} />);
    const values = [...host.querySelectorAll('.rh-chain-provenance-grid strong')].map((element) => element.textContent);
    expect(values[0]).toBe('Persisted records'); expect(values[1]).toBe('Source required'); expect(values[2]).toBe('Timestamp unavailable');
  });
  it('marks cached projection provenance stale after its actual observation window expires', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(Date.parse(moverNow) + 16 * 60000));
    const projection = deriveRhChainMarketMovers({ [contract]: moverSamples() }, new Date(moverNow));
    const host = renderElement(<RhChainProvenance envelope={buildRhChainApiResponse(assembleRhChain4663Index(projection))} />);
    expect(host.querySelector('.freshness-stale')).toBeTruthy(); expect(host.textContent).not.toContain('Persisted review memory');
  });
  it('keeps summary-rail observation labels and market freshness separate from stale reviewed receipts', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(moverNow));
    const projection = deriveRhChainMarketMovers({ [contract]: moverSamples() }, new Date(moverNow));
    const host = renderElement(<RhChainSignalDeskV2 desk={getRhChainPayload()} envelope={null} reviewQueue={null} signalIndex={assembleRhChain4663Index(projection)} dailyReceipts={getRhChainDailyReceipts()} memePulse={null} todayOn4663={assembleRhChainTodayOn4663({ marketMovers: projection })} launchSurfaces={null} liveSnapshot={null} failures={{ reviewQueue: null, signalIndex: null, dailyReceipts: null, launchSurfaces: null }} />);
    const rail = host.querySelector('aside[aria-label="Today on 4663 summary"]')!;
    expect(rail.textContent).toContain('Liquidity change'); expect(rail.textContent).not.toContain('Biggest risk');
    expect(rail.querySelector('dl div dd')?.textContent).toBe('fresh');
    expect(rail.textContent).toContain('Reviewed receipt memory'); expect(rail.textContent).toContain('Observation sources1');
  });
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

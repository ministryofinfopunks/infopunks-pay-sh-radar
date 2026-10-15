// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRhChain4663Index, getRhChainDailyReceipts, getRhChainLaunchSurfaces, getRhChainPayload, getRhChainReviewQueue } from '../src/data/rhChain';
import { assembleRhChainMemePulseScreen } from '../src/services/rhChainMemePulseService';
import { assembleRhChainTodayOn4663 } from '../src/services/rhChainTodayOn4663Service';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { RhChainSignalDeskV2 } from '../src/web/rhChainSignalDeskV2';
import type { RhChainDailyReceipt } from '../src/data/rhChain';

describe('Signal Desk presentation boundaries', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderDesk(terminalHome: boolean, receiptOverrides: Partial<RhChainDailyReceipt> = {}) {
    const desk = getRhChainPayload();
    const receipts = getRhChainDailyReceipts();
    await act(async () => root.render(<RhChainSignalDeskV2
      terminalHome={terminalHome}
      desk={desk}
      envelope={buildRhChainApiResponse(desk)}
      reviewQueue={getRhChainReviewQueue()}
      signalIndex={getRhChain4663Index()}
      dailyReceipts={{ ...receipts, latest_receipt: { ...receipts.latest_receipt, ...receiptOverrides } }}
      memePulse={assembleRhChainMemePulseScreen()}
      todayOn4663={assembleRhChainTodayOn4663()}
      launchSurfaces={getRhChainLaunchSurfaces()}
      liveSnapshot={null}
      failures={{ reviewQueue: null, signalIndex: null, dailyReceipts: null, launchSurfaces: null }}
    />));
  }

  it('adds only the requested home section labels and preserves the narrative presentation', async () => {
    await renderDesk(true);
    const labels = () => Array.from(container.querySelectorAll('.radar-section-header'));
    expect(labels().map((label) => label.textContent?.match(/\[\s*(\d+)\s*\]/)?.[1])).toEqual(['12', '13', '14']);
    expect(labels().map((label) => label.closest('section')?.querySelector('h2')?.textContent)).toEqual([
      'Today on 4663', getRhChainDailyReceipts().latest_receipt.headline, 'What is moving'
    ]);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('#rh-v2-title')?.textContent).toBe('Know what is moving.Know what is real.');

    await renderDesk(false);
    expect(labels()).toEqual([]);
    expect(container.querySelector('.rh-v2-today .rh-v2-section-heading p')?.textContent).toBe('Daily pulse');
    expect(container.querySelector('.rh-v2-movers .rh-v2-section-heading p')?.textContent).toBe('4663 movers');
    expect(container.querySelector('.rh-v2-methodology > div > p')?.textContent).toBe('Methodology');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('.rh-v2-observation-status')).toHaveLength(0);
  });

  it.each(['stale', 'aging', 'fresh', undefined] as const)('promotes the actual %s state and existing observation time without asserting new freshness', async (freshness) => {
    await renderDesk(true, { freshness_state: freshness });
    const statuses = Array.from(container.querySelectorAll<HTMLElement>('.rh-v2-observation-status'));
    const originalObserved = Array.from(container.querySelectorAll('.rh-v2-intelligence-rail dl > div')).find(row => row.querySelector('dt')?.textContent === 'Observed')?.querySelector('dd')?.textContent;
    expect(statuses).toHaveLength(2);
    for (const status of statuses) {
      expect(status.dataset.state).toBe(freshness ?? 'source_required');
      expect(status.querySelector('.rh-v2-evidence-state')?.textContent).toBe(freshness ?? 'source required');
      expect(status.querySelector('time')?.textContent).toBe(originalObserved);
      expect(status.querySelector('time')?.getAttribute('datetime')).toBeTruthy();
      expect(status.textContent?.includes('Historical observation')).toBe(freshness === 'stale');
    }
    const pulseStatus = container.querySelector('.rh-v2-today > .rh-v2-observation-status')!;
    expect(pulseStatus.compareDocumentPosition(container.querySelector('.rh-v2-today-grid')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('.rh-v2-today-card')).toHaveLength(4);
  });

  it('retains every Daily Receipt field, identifier, timestamp, stale state, link and share control', async () => {
    const receipt = getRhChainDailyReceipts().latest_receipt;
    await renderDesk(true, { freshness_state: 'stale' });
    const panel = container.querySelector('.rh-v2-receipt')!;
    expect(panel.querySelector('h2')?.textContent).toBe(receipt.headline);
    const values = [receipt.top_signal, receipt.biggest_risk, receipt.strongest_narrative, receipt.infopunks_verdict, receipt.liquidity_note, receipt.deployer_watch_note, receipt.stock_token_spillover_note, receipt.solana_base_migration_note];
    expect(panel.querySelectorAll('.rh-v2-receipt-intelligence article, .rh-v2-receipt-secondary p')).toHaveLength(values.length);
    for (const value of values) expect(panel.textContent).toContain(value);
    expect(panel.textContent).toContain(receipt.date);
    expect(panel.querySelector('.state-stale')?.textContent).toBe('stale');
    expect(panel.querySelector('a[href="/rh-chain-signal-desk/daily-receipts/rh_daily_006"]')).not.toBeNull();
    expect(panel.querySelector('.rh-v2-share > button')?.textContent).toContain('Share Receipt');
    expect(panel.querySelector('.rh-v2-share > button')?.getAttribute('aria-expanded')).toBe('false');
    expect(panel.querySelector('.rh-v2-receipt-foot')?.textContent).toContain('Observed');
    expect(panel.querySelector('.rh-v2-receipt-foot')?.textContent).toContain(`${receipt.sources.length}`);
  });

  it('keeps both analyst tables named and keyboard reachable without discarding ranked evidence', async () => {
    await renderDesk(true);
    const analyst = Array.from(container.querySelectorAll<HTMLButtonElement>('.rh-v2-mode-control button')).find((button) => button.textContent === 'analyst')!;
    await act(async () => analyst.click());

    const regions = Array.from(container.querySelectorAll<HTMLElement>('.rh-v2-table-wrap'));
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      expect(region.getAttribute('role')).toBe('region');
      expect(region.getAttribute('aria-label')).toMatch(/scroll horizontally for all columns/);
      expect(region.tabIndex).toBe(0);
      region.focus();
      expect(document.activeElement).toBe(region);
      expect(region.querySelector('table > caption')?.textContent).toBeTruthy();
    }
    expect(container.querySelectorAll('.rh-v2-analyst .rh-v2-table tbody tr')).toHaveLength(getRhChain4663Index().assets.length);
    expect(container.querySelectorAll('.rh-v2-today-card')).toHaveLength(4);
    expect(container.querySelector('a[href="/rh-chain-signal-desk/daily-receipts/rh_daily_006"]')).not.toBeNull();
  });
});

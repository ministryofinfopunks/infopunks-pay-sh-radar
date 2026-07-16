// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRhChain100ReceiptsCampaign } from '../src/data/rhChain100Receipts';
import { assembleRhChainTokenDossier } from '../src/services/rhChainTokenDossierService';
import { buildRhChainApiResponse } from '../src/services/rhChainIntelligenceService';
import { queryRhChainScout } from '../src/services/rhChainScoutService';
import { rhChainTokenDossierRoute } from '../src/web/rhChainSignalDeskPages';
import { RhChain100ReceiptsCampaignPage } from '../src/web/rhChain100ReceiptsCampaignPage';

const campaign = getRhChain100ReceiptsCampaign();
const tokenSnapshot = (contract: string) => ({
  contract,
  token_pair: null,
  explorer: null,
  provider_statuses: [],
  cache_status: 'disabled' as const,
  generated_at: campaign.generated_at,
  live_snapshots_enabled: false,
  judgment_policy: 'External data gives context.',
  disclaimer: 'Context only.'
});
const liveSnapshot = {
  title: 'RH Chain Live Snapshot' as const,
  generated_at: campaign.generated_at,
  live_snapshots_enabled: false,
  judgment_policy: 'External data gives context.',
  chain_metrics: { tvl_usd: null, dex_volume_24h_usd: null, stablecoin_market_cap_usd: null, protocol_count: null, source_timestamp: null, freshness: 'seeded' as const },
  meme_category: { market_cap_usd: null, volume_24h_usd: null, top_assets: [], source_timestamp: null, freshness: 'seeded' as const },
  provider_statuses: [],
  cache_status: 'disabled' as const,
  disclaimer: 'Context only.'
};

describe('RH Chain 100 Receipts campaign', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(buildRhChainApiResponse(campaign)), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('seeds Day 1 with five reviewed assets and campaign totals', () => {
    expect(campaign.batch).toMatchObject({
      batch_id: 'rh_100_receipts_day_001',
      day_number: 1,
      reviewed_count: 5,
      total_reviewed_count: 5
    });
    expect(campaign.assets.map((asset) => asset.ticker)).toEqual(['CASHCAT', 'TENDIES', 'PONS', 'HOODRAT', 'ARROW']);
  });

  it.each(campaign.assets)('$ticker exact contract resolves to its dossier route and campaign dossier memory', (asset) => {
    expect(rhChainTokenDossierRoute(asset.contract)).toBe(asset.dossier_route);
    const dossier = assembleRhChainTokenDossier(asset.contract, [], tokenSnapshot(asset.contract), liveSnapshot);
    expect(dossier.contract).toBe(asset.contract);
    expect(dossier.ticker).toBe(asset.ticker);
    expect(dossier.memory.campaign_asset).toMatchObject({ contract: asset.contract, evidence_state: asset.evidence_state, classification: asset.classification, risk_state: asset.risk_state });
  });

  it('keeps source-required PONS fee claims and ARROW utility claims explicit', () => {
    const pons = campaign.assets.find((asset) => asset.ticker === 'PONS');
    const arrow = campaign.assets.find((asset) => asset.ticker === 'ARROW');
    expect(pons).toMatchObject({ evidence_state: 'under_receipt_check', risk_state: 'fee_claim_source_required' });
    expect(arrow).toMatchObject({ evidence_state: 'source_required', risk_state: 'utility_claim_source_required' });
  });

  it('schedules the seven-day outcome check for every reviewed asset', () => {
    const expectedQuestions = [
      'Did liquidity remain?',
      'Did volume collapse or normalize?',
      'Did evidence improve?',
      'Did deployer/creator context become clearer?',
      'Did clone risk rise?',
      'Did classification need downgrade or upgrade?'
    ];
    for (const asset of campaign.assets) {
      expect(asset).toMatchObject({
        reviewed_at: '2026-07-16T00:00:00.000Z',
        outcome_check_due_at: '2026-07-23T00:00:00.000Z',
        seven_day_outcome: 'pending'
      });
      expect(asset.outcome_check_questions).toEqual(expectedQuestions);
    }
  });

  it('keeps the CASHCAT approved-signal caveat attached', () => {
    const cashcat = campaign.assets.find((asset) => asset.ticker === 'CASHCAT');
    expect(cashcat?.evidence_state).toBe('approved_signal');
    expect(cashcat?.classification_note).toContain('not endorsement or safety');
  });

  it('connects exact-contract campaign memory to Scout and Risk retrieval', () => {
    const pons = campaign.assets.find((asset) => asset.ticker === 'PONS')!;
    const token = queryRhChainScout({ query: pons.contract, mode: 'token_context' });
    const risk = queryRhChainScout({ query: 'campaign risk memory', mode: 'risk_memory' });
    expect(token.answer).toContain('PONS is in Day 1 campaign memory');
    expect(token.supporting_campaign_assets).toEqual([expect.objectContaining({ contract: pons.contract, risk_state: 'fee_claim_source_required' })]);
    expect(risk.supporting_campaign_assets).toHaveLength(5);
  });

  it('renders all five Daily Top 5 roles and source-required claim states', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<RhChain100ReceiptsCampaignPage />);
      await Promise.resolve();
    });
    await act(async () => { await Promise.resolve(); });

    const text = container.textContent ?? '';
    for (const role of ['Top Signal', 'Biggest Rotation', 'Strongest Meme Culture Fit', 'Narrative Watch', 'Utility Claim Under Review']) {
      expect(container.querySelector(`[data-role="${role}"]`)).not.toBeNull();
    }
    expect(text).toContain('fee_claim_source_required');
    expect(text).toContain('utility_claim_source_required');
    expect(text).toContain('not endorsement or safety');
    expect(text).toContain('2026-07-23T00:00:00.000Z');
    expect(text).toContain('Did classification need downgrade or upgrade?');
    expect(container.querySelectorAll('.campaign-top-card')).toHaveLength(5);
  });

  it('contains no prohibited promotional language', () => {
    expect(JSON.stringify(campaign).toLowerCase()).not.toMatch(/\b(?:buy|sell|ape|100x|raid)\b/);
  });
});

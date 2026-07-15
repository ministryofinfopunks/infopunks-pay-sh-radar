import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { assembleRhChainLaunchpadObservatory } from '../src/services/rhChainLaunchpadObservatoryService';

describe('RH Chain Launchpad Observatory', () => {
  it('models every requested surface with conservative status and source-required claims', () => {
    const observatory = assembleRhChainLaunchpadObservatory();
    expect(observatory).toEqual(expect.objectContaining({
      title: 'RH Chain Launchpad Observatory',
      data_mode: 'manual',
      surfaces: expect.arrayContaining([
        expect.objectContaining({ surface_id: 'noxa_fun', name: 'NOXA Fun', status: 'degraded' }),
        expect.objectContaining({ surface_id: 'flap_sh' }),
        expect.objectContaining({ surface_id: 'trensh_today' }),
        expect.objectContaining({ surface_id: 'bankr' }),
        expect.objectContaining({ surface_id: 'tokeny_fun' }),
        expect.objectContaining({ surface_id: 'vlad_fun' }),
        expect.objectContaining({ surface_id: 'robindotmarket' }),
        expect.objectContaining({ surface_id: 'uniswap_direct_launches' }),
        expect.objectContaining({ surface_id: 'unknown_manual', status: 'unknown' })
      ]),
      claim_ledger: expect.arrayContaining([
        expect.objectContaining({ claim_type: 'launch_count', status: 'source_required' }),
        expect.objectContaining({ claim_type: 'fee_claim', status: 'source_required' }),
        expect.objectContaining({ claim_type: 'outage_claim', status: 'source_required' }),
        expect.objectContaining({ claim_type: 'rival_share_claim', status: 'source_required' }),
        expect.objectContaining({ claim_type: 'notable_token_claim', status: 'source_required' })
      ])
    }));
    expect(observatory.surfaces.every((surface) => Boolean(surface.last_observed_at) && surface.data_mode === 'manual' && surface.surface_risks.length > 0)).toBe(true);
  });

  it('keeps the source record cautious and free of execution language', () => {
    const text = JSON.stringify(assembleRhChainLaunchpadObservatory());
    expect(text).toContain('source_required');
    expect(text).toContain('unverified');
    expect(text).toMatch(/human-reviewed receipts outrank external or live context/i);
    expect(text).not.toMatch(/\b(buy|sell|snipe|launch[- ]now)\b/i);
    expect(text).not.toMatch(/\b(is|are|treated as) safe\b|\bguaranteed\b|\bproven misconduct\b/i);
  });

  it('serves the public observatory API in the RH Chain provenance envelope', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/launchpad-observatory' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({
        data_mode: 'manual',
        sources: expect.any(Array),
        disclaimer: expect.stringContaining('read-only'),
        data: expect.objectContaining({ title: 'RH Chain Launchpad Observatory', claim_ledger: expect.any(Array) })
      }));
    } finally { await app.close(); }
  });
});

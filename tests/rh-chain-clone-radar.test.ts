import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { assembleRhChainCloneRadar } from '../src/services/rhChainCloneRadarService';

describe('RH Chain Clone & Impersonator Radar', () => {
  it('returns cautious, typed suspected-risk entries', () => {
    const radar = assembleRhChainCloneRadar();
    expect(radar).toEqual(expect.objectContaining({ title: 'Clone & Impersonator Radar', active_warnings: expect.any(Array), liquidity_watch: expect.any(Array) }));
    expect(radar.active_warnings).toEqual(expect.arrayContaining([expect.objectContaining({ suspicion_type: expect.any(String), confidence_level: expect.any(String), evidence_links: expect.any(Array) })]));
  });

  it('uses non-defamatory risk language', () => {
    const text = JSON.stringify(assembleRhChainCloneRadar()).toLowerCase();
    expect(text).toContain('suspected');
    expect(text).toContain('requires review');
    expect(text).not.toContain('is a scam');
    expect(text).not.toContain('proven scam');
  });

  it('serves the public clone radar API with safety caveats', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/clone-radar' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ title: 'Clone & Impersonator Radar', doctrine: expect.stringContaining('External data') }), disclaimer: expect.stringContaining('not definitive misconduct') }));
    } finally { await app.close(); }
  });
});

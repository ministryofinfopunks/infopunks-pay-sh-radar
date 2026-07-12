import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { assembleRhChainMemePulseScreen } from '../src/services/rhChainMemePulseService';

describe('RH Meme Pulse', () => {
  it('aggregates existing desk memory without granting an approval', () => {
    const pulse = assembleRhChainMemePulseScreen();
    expect(pulse).toEqual(expect.objectContaining({
      title: 'RH Meme Pulse',
      doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.',
      top_attention_assets: expect.arrayContaining([expect.objectContaining({ ticker: expect.any(String), signal_score: expect.any(Number), risk_state: expect.any(String) })]),
      risk_strip: expect.arrayContaining([expect.objectContaining({ title: expect.any(String), risk_state: expect.any(String) })])
    }));
    expect(pulse.disclaimer).toContain('not a trading dashboard');
    expect(pulse.market_translation.find((item) => item.id === 'retail')?.caveat).toContain('does not imply a Robinhood relationship');
  });

  it('serves the public meme pulse API with source metadata', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/meme-pulse' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({
        data: expect.objectContaining({ title: 'RH Meme Pulse', snapshot: expect.any(Object), top_attention_assets: expect.any(Array) }),
        meta: expect.objectContaining({ live_indexing_enabled: false }),
        sources: expect.any(Array),
        disclaimer: expect.stringContaining('not a trading dashboard')
      }));
    } finally { await app.close(); }
  });
});

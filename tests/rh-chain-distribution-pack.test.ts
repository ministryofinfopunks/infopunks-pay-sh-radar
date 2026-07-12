import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { assembleRhChainDistributionPack } from '../src/services/rhChainDistributionPackService';

describe('RH Chain Distribution Pack', () => {
  it('provides copy text for every major artifact without coordination language', () => {
    const pack = assembleRhChainDistributionPack();
    expect(pack.packets.map((packet) => packet.id)).toEqual(['daily-receipt', 'meme-pulse', 'clone-radar', 'token-dossier', 'submit-signal', 'scout-agent', 'launch-surface']);
    expect(pack.packets.every((packet) => packet.copy_text.length > 20 && packet.risk_disclaimer.length > 20)).toBe(true);
    const copy = pack.packets.map((packet) => packet.copy_text).join(' ').toLowerCase();
    expect(copy).not.toContain('raid this');
    expect(copy).not.toMatch(/buy|sell|guaranteed gains/);
  });

  it('serves the public distribution pack API', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/distribution-pack' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ title: 'RH Chain Distribution Pack', packets: expect.arrayContaining([expect.objectContaining({ intended_surface: expect.any(String), copy_text: expect.any(String) })]) }), disclaimer: expect.stringContaining('Do not spam') }));
    } finally { await app.close(); }
  });
});

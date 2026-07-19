import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { assembleRhChainDistributionPack } from '../src/services/rhChainDistributionPackService';
import { assembleRhChainReceiptRelay } from '../src/services/rhChainReceiptRelayService';

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

  it('exports caveated Receipt Relay packets without coordination or market-promise language', () => {
    const relay = assembleRhChainReceiptRelay();
    expect(relay.packets).toHaveLength(18);
    expect(relay.packets.map((packet) => packet.title)).toEqual(expect.arrayContaining(['Daily Receipt #006', 'Meme Pulse', 'Launchpad Observatory', 'Clone Radar', 'Token Dossier source-required state', 'Scout Agent answer excerpt']));
    expect(relay.packets.filter((packet) => packet.title === 'Daily Receipt #006')).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_url: '/v1/rh-chain/daily-receipts/rh_daily_006', artifact_url: '/rh-chain-signal-desk/daily-receipts/rh_daily_006', long_copy: expect.stringContaining('source_required') })
    ]));
    expect(relay.packets.every((packet) => packet.risk_disclaimer.length > 20 && packet.no_raid_notice.length > 20 && packet.source_url.startsWith('/v1/rh-chain/') && packet.artifact_url.startsWith('/rh-chain-signal-desk/'))).toBe(true);
    const values = relay.packets.flatMap((packet) => [packet.title, packet.short_copy, packet.long_copy, packet.risk_disclaimer, packet.no_raid_notice]).join(' ').toLowerCase();
    expect(values).not.toMatch(/\b(buy|sell|ape|raid|guaranteed|100x)\b/);
  });

  it('serves the public Receipt Relay API with the required packet shape', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/receipt-relay' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ data: expect.objectContaining({ title: 'RH Chain Receipt Relay', packets: expect.arrayContaining([expect.objectContaining({ packet_id: expect.any(String), surface: expect.any(String), short_copy: expect.any(String), long_copy: expect.any(String), source_url: expect.any(String), artifact_url: expect.any(String), risk_disclaimer: expect.any(String), no_raid_notice: expect.any(String), generated_at: expect.any(String), data_mode: 'manual' })]) }), disclaimer: expect.stringContaining('does not send messages') }));
    } finally { await app.close(); }
  });
});

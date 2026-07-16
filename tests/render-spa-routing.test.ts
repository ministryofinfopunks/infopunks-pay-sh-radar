import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

function createClientDistFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'radar-client-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><title>Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes</title><meta name="description" content="Generic shell description." /><meta property="og:title" content="Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes" /><meta property="og:description" content="Generic shell description." /><meta property="og:type" content="website" /><meta property="og:url" content="https://radar.infopunks.fun/" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes" /><meta name="twitter:description" content="Generic shell description." /><link rel="canonical" href="https://radar.infopunks.fun/" /></head><body><div id="app">Radar SPA shell</div></body></html>');
  return dir;
}

describe('render-style SPA routing boundaries', () => {
  it('serves JSON for /v1/routes even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/routes' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
      expect(response.json().data.routes.length).toBeGreaterThan(0);
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves JSON for /openapi.json even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/openapi.json' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
      expect(response.json().openapi).toBe('3.1.0');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves JSON content-types for HEAD /openapi.json, /v1/loops, and /v1/checks even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      for (const path of ['/openapi.json', '/v1/loops', '/v1/checks']) {
        const response = await app.inject({ method: 'HEAD', url: path });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body.startsWith('<!doctype html>')).toBe(false);
      }
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves JSON for /v1/pulse even when SPA fallback is enabled', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/pulse' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
      expect(response.json().data).toEqual(expect.objectContaining({
        providerCount: expect.any(Number),
        endpointCount: expect.any(Number),
        data_source: expect.any(Object)
      }));
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves frontend routes and unknown frontend paths through the HTML shell', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const solana = await app.inject({ method: 'GET', url: '/solana' });
      expect(solana.statusCode).toBe(200);
      expect(solana.headers['content-type']).toContain('text/html');
      expect(solana.body).toContain('Radar SPA shell');
      expect(solana.body).toContain('<title>Solana Radar | Infopunks Radar</title>');
      expect(solana.body).toContain('name="description" content="Evidence, route intelligence, provider evaluation and machine-market infrastructure for the Solana agentic economy."');
      expect(solana.body).toContain('<link rel="canonical" href="https://radar.infopunks.fun/solana"');

      const developers = await app.inject({ method: 'GET', url: '/developers' });
      expect(developers.statusCode).toBe(200);
      expect(developers.headers['content-type']).toContain('text/html');
      expect(developers.body).toContain('Radar SPA shell');

      const check = await app.inject({ method: 'GET', url: '/check' });
      expect(check.statusCode).toBe(200);
      expect(check.headers['content-type']).toContain('text/html');
      expect(check.body).toContain('Radar SPA shell');

      const loops = await app.inject({ method: 'GET', url: '/loops' });
      expect(loops.statusCode).toBe(200);
      expect(loops.headers['content-type']).toContain('text/html');
      expect(loops.body).toContain('Radar SPA shell');

      const signalHunt = await app.inject({ method: 'GET', url: '/signal-hunt' });
      expect(signalHunt.statusCode).toBe(200);
      expect(signalHunt.headers['content-type']).toContain('text/html');
      expect(signalHunt.body).toContain('Radar SPA shell');
      expect(signalHunt.body).toContain('<title>Infopunks Signal Hunt</title>');
      expect(signalHunt.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/signal-hunt.png"');

      const signalHuntDetail = await app.inject({ method: 'GET', url: '/signal-hunt/hunt_black_bull_coordination' });
      expect(signalHuntDetail.statusCode).toBe(200);
      expect(signalHuntDetail.headers['content-type']).toContain('text/html');
      expect(signalHuntDetail.body).toContain('Radar SPA shell');
      expect(signalHuntDetail.body).toContain('Infopunks Signal Hunt: hunt_black_bull_coordination');

      const unicornRadar = await app.inject({ method: 'GET', url: '/unicorn-radar' });
      expect(unicornRadar.statusCode).toBe(200);
      expect(unicornRadar.headers['content-type']).toContain('text/html');
      expect(unicornRadar.body).toContain('Radar SPA shell');
      expect(unicornRadar.body).toContain('<title>Infopunks Unicorn Radar</title>');
      expect(unicornRadar.body).toContain('name="description" content="Finding serious low-cap Solana projects before consensus does."');
      expect(unicornRadar.body).toContain('property="og:title" content="Infopunks Unicorn Radar"');
      expect(unicornRadar.body).toContain('property="og:description" content="Finding serious low-cap Solana projects before consensus does."');
      expect(unicornRadar.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/unicorn-radar.png"');
      expect(unicornRadar.body).toContain('name="twitter:card" content="summary_large_image"');
      expect(unicornRadar.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/unicorn-radar.png"');
      expect(unicornRadar.body).not.toContain('Infopunks Pay.sh Radar is an evidence ledger for Pay.sh agent routes');

      const evaluationRequest = await app.inject({ method: 'GET', url: '/evaluation-request' });
      expect(evaluationRequest.statusCode).toBe(200);
      expect(evaluationRequest.headers['content-type']).toContain('text/html');
      expect(evaluationRequest.body).toContain('<title>Request an Infopunks Evaluation</title>');
      expect(evaluationRequest.body).toContain('name="description" content="Submit receipts for paid evaluation. Payment buys evaluation, not conviction."');
      expect(evaluationRequest.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/evaluation-request.png"');
      expect(evaluationRequest.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/evaluation-request.png"');

      const unicornRadarDetail = await app.inject({ method: 'GET', url: '/unicorn-radar/ur_ai_rig_complex' });
      expect(unicornRadarDetail.statusCode).toBe(200);
      expect(unicornRadarDetail.headers['content-type']).toContain('text/html');
      expect(unicornRadarDetail.body).toContain('Radar SPA shell');
      expect(unicornRadarDetail.body).toContain('Infopunks Unicorn Radar: AI Rig Complex / ARC');
      expect(unicornRadarDetail.body).toContain('name="description" content="AI Rig Complex (ARC) is an AI / Agent Rails candidate on Infopunks Unicorn Radar, currently marked watchlist with verdict real_product_weak_attention."');
      expect(unicornRadarDetail.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/unicorn-radar/ur_ai_rig_complex.png"');
      expect(unicornRadarDetail.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/unicorn-radar/ur_ai_rig_complex.png"');

      const revenueReceipts = await app.inject({ method: 'GET', url: '/revenue-receipts' });
      expect(revenueReceipts.statusCode).toBe(200);
      expect(revenueReceipts.headers['content-type']).toContain('text/html');
      expect(revenueReceipts.body).toContain('<title>Infopunks Revenue Receipts</title>');
      expect(revenueReceipts.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/revenue-receipts.png"');
      expect(revenueReceipts.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/revenue-receipts.png"');

      const revenueReceiptDetail = await app.inject({ method: 'GET', url: '/revenue-receipts/rr_open_evaluation_slot' });
      expect(revenueReceiptDetail.statusCode).toBe(200);
      expect(revenueReceiptDetail.headers['content-type']).toContain('text/html');
      expect(revenueReceiptDetail.body).toContain('Infopunks Revenue Receipt: Open Slot / Open Unicorn Radar Evaluation Slot');
      expect(revenueReceiptDetail.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/revenue-receipts/rr_open_evaluation_slot.png"');
      expect(revenueReceiptDetail.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/revenue-receipts/rr_open_evaluation_slot.png"');

      const graph = await app.inject({ method: 'GET', url: '/graph' });
      expect(graph.statusCode).toBe(200);
      expect(graph.headers['content-type']).toContain('text/html');
      expect(graph.body).toContain('Radar SPA shell');

      const narratives = await app.inject({ method: 'GET', url: '/narratives' });
      expect(narratives.statusCode).toBe(200);
      expect(narratives.headers['content-type']).toContain('text/html');
      expect(narratives.body).toContain('Radar SPA shell');
      expect(narratives.body).toContain('<title>Infopunks Narrative Asset Intelligence</title>');
      expect(narratives.body).toContain('property="og:title" content="Infopunks Narrative Asset Intelligence"');
      expect(narratives.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/narratives.png"');
      expect(narratives.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/narratives.png"');

      const attentionMarkets = await app.inject({ method: 'GET', url: '/narratives/attention-markets' });
      expect(attentionMarkets.statusCode).toBe(200);
      expect(attentionMarkets.headers['content-type']).toContain('text/html');
      expect(attentionMarkets.body).toContain('Radar SPA shell');

      const attentionMarketWatch = await app.inject({ method: 'GET', url: '/narratives/attention-market-watch' });
      expect(attentionMarketWatch.statusCode).toBe(200);
      expect(attentionMarketWatch.headers['content-type']).toContain('text/html');
      expect(attentionMarketWatch.body).toContain('<title>Infopunks Attention Market Watch</title>');
      expect(attentionMarketWatch.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/attention-market-watch.png"');

      const attentionMarketWatchShort = await app.inject({ method: 'GET', url: '/attention-market-watch' });
      expect(attentionMarketWatchShort.statusCode).toBe(200);
      expect(attentionMarketWatchShort.headers['content-type']).toContain('text/html');
      expect(attentionMarketWatchShort.body).toContain('<title>Infopunks Attention Market Watch</title>');

      const attentionMarketWatchProfile = await app.inject({ method: 'GET', url: '/attention-market-watch/ansem' });
      expect(attentionMarketWatchProfile.statusCode).toBe(200);
      expect(attentionMarketWatchProfile.headers['content-type']).toContain('text/html');
      expect(attentionMarketWatchProfile.body).toContain('Infopunks Attention Market Watch: $ANSEM');
      expect(attentionMarketWatchProfile.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/attention-market-watch/ansem.png"');

      const ansem = await app.inject({ method: 'GET', url: '/signals/ansem' });
      expect(ansem.statusCode).toBe(200);
      expect(ansem.headers['content-type']).toContain('text/html');
      expect(ansem.body).toContain('Radar SPA shell');

      const blackBull = await app.inject({ method: 'GET', url: '/signals/black-bull' });
      expect(blackBull.statusCode).toBe(200);
      expect(blackBull.headers['content-type']).toContain('text/html');
      expect(blackBull.body).toContain('Radar SPA shell');
      expect(blackBull.body).toContain('<title>Infopunks Signal Report: $ANSEM / The Black Bull</title>');
      expect(blackBull.body).toContain('property="og:description" content="A living Narrative Asset Intelligence report on $ANSEM evolving from persona attention into community coordination."');
      expect(blackBull.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/signals/black-bull.png"');
      expect(blackBull.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/signals/black-bull.png"');

      const blackBullUpdate = await app.inject({ method: 'GET', url: '/signals/black-bull/updates/seu_black_bull_007' });
      expect(blackBullUpdate.statusCode).toBe(200);
      expect(blackBullUpdate.headers['content-type']).toContain('text/html');
      expect(blackBullUpdate.body).toContain('Radar SPA shell');
      expect(blackBullUpdate.body).toContain('Infopunks Desk Dispatch: Coordination Market Emerging');
      expect(blackBullUpdate.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_007.png"');
      expect(blackBullUpdate.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/signals/black-bull/updates/seu_black_bull_007.png"');

      const troll = await app.inject({ method: 'GET', url: '/signals/troll' });
      expect(troll.statusCode).toBe(200);
      expect(troll.headers['content-type']).toContain('text/html');
      expect(troll.body).toContain('Radar SPA shell');
      expect(troll.body).toContain('<title>Infopunks Signal Report: $TROLL / The Re-Indexed Archetype</title>');
      expect(troll.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/signals/troll.png"');
      expect(troll.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/signals/troll.png"');

      const trollUpdate = await app.inject({ method: 'GET', url: '/signals/troll/updates/seu_troll_002' });
      expect(trollUpdate.statusCode).toBe(200);
      expect(trollUpdate.headers['content-type']).toContain('text/html');
      expect(trollUpdate.body).toContain('Radar SPA shell');
      expect(trollUpdate.body).toContain('Infopunks Desk Dispatch: Durable Re-index');
      expect(trollUpdate.body).toContain('property="og:image" content="https://radar.infopunks.fun/og/signals/troll/updates/seu_troll_002.png"');
      expect(trollUpdate.body).toContain('name="twitter:image" content="https://radar.infopunks.fun/og/signals/troll/updates/seu_troll_002.png"');

      const radarCard = await app.inject({ method: 'GET', url: '/radar/cards/provider/alpha' });
      expect(radarCard.statusCode).toBe(200);
      expect(radarCard.headers['content-type']).toContain('text/html');
      expect(radarCard.body).toContain('Radar SPA shell');

      const radarCardIndex = await app.inject({ method: 'GET', url: '/radar/cards' });
      expect(radarCardIndex.statusCode).toBe(200);
      expect(radarCardIndex.headers['content-type']).toContain('text/html');
      expect(radarCardIndex.body).toContain('Radar SPA shell');

      const machineCard = await app.inject({ method: 'GET', url: '/machine-market/cards/cloud-translation' });
      expect(machineCard.statusCode).toBe(200);
      expect(machineCard.headers['content-type']).toContain('text/html');
      expect(machineCard.body).toContain('Radar SPA shell');

      const unknownFrontend = await app.inject({ method: 'GET', url: '/frontend-route-that-does-not-exist' });
      expect(unknownFrontend.statusCode).toBe(200);
      expect(unknownFrontend.headers['content-type']).toContain('text/html');
      expect(unknownFrontend.body).toContain('Radar SPA shell');
      expect(unknownFrontend.body).toContain('<title>Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes</title>');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('serves HEAD for public SPA card routes through the HTML shell', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      for (const path of [
        '/signal-hunt',
        '/signal-hunt/hunt_black_bull_coordination',
        '/unicorn-radar',
        '/evaluation-request',
        '/unicorn-radar/ur_ai_rig_complex',
        '/revenue-receipts',
        '/revenue-receipts/rr_open_evaluation_slot',
        '/narratives',
        '/narratives/attention-markets',
        '/narratives/attention-market-watch',
        '/attention-market-watch',
        '/attention-market-watch/ansem',
        '/signals/ansem',
        '/signals/black-bull',
        '/signals/black-bull/updates/seu_black_bull_007',
        '/signals/troll',
        '/signals/troll/updates/seu_troll_002',
        '/radar/cards',
        '/radar/cards/benchmark/web-search',
        '/machine-market/cards/cloud-translation'
      ]) {
        const response = await app.inject({ method: 'HEAD', url: path });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
      }
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('does not let the SPA fallback swallow unknown API routes', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/not-a-real-route' });
      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.startsWith('<!doctype html>')).toBe(false);
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });
});

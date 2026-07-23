import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const RADAR_TITLE = 'Infopunks Pay.sh Radar | Evidence Ledger for Pay.sh Agent Routes';

function createClientDistFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'rh-pulse-client-dist-'));
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html><head>
    <title>${RADAR_TITLE}</title>
    <meta name="description" content="Radar shell description." />
    <meta name="theme-color" content="#030706" />
    <meta property="og:title" content="${RADAR_TITLE}" />
    <meta property="og:description" content="Radar shell description." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://radar.infopunks.fun/" />
    <meta property="og:image" content="https://radar.infopunks.fun/og/radar.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${RADAR_TITLE}" />
    <meta name="twitter:description" content="Radar shell description." />
    <meta name="twitter:image" content="https://radar.infopunks.fun/og/radar.png" />
    <link rel="canonical" href="https://radar.infopunks.fun/" />
    <script type="application/ld+json">{"@type":"WebSite","name":"Radar"}</script>
  </head><body><div id="app">Radar SPA shell</div></body></html>`);
  return dir;
}

describe('RH Pulse server metadata dispatch', () => {
  it('renders the Pulse shell and canonical metadata at the Pulse hostname root', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: { host: 'pulse.infopunks.fun' }
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('<title>RH Pulse | Call the Rotation</title>');
      expect(response.body).toContain('See the emerging connections between Memes, Agents and RWAs on Robinhood Chain.');
      expect(response.body).toContain('<link rel="canonical" href="https://pulse.infopunks.fun/"');
      expect(response.body).toContain('property="og:url" content="https://pulse.infopunks.fun/"');
      expect(response.body).toContain('name="twitter:card" content="summary_large_image"');
      expect(response.body).toContain('property="og:image" content="https://pulse.infopunks.fun/og/rh-pulse.png"');
      expect(response.body).toContain('name="theme-color" content="#050807"');
      expect(response.body).toContain('"name":"RH Pulse"');
      expect(response.body).toContain('data-rh-pulse-context');
      expect(response.body).not.toContain('og/radar.png');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('renders the same public canonical identity through /rh-pulse without trusting the request host', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/rh-pulse',
        headers: { host: 'attacker.example' }
      });
      expect(response.body).toContain('<title>RH Pulse | Call the Rotation</title>');
      expect(response.body).toContain('<link rel="canonical" href="https://pulse.infopunks.fun/"');
      expect(response.body).not.toContain('https://attacker.example');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('keeps the Radar hostname and unknown host root on the unchanged Radar shell', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      for (const host of ['radar.infopunks.fun', 'unknown.example']) {
        const response = await app.inject({ method: 'GET', url: '/', headers: { host } });
        expect(response.body).toContain(`<title>${RADAR_TITLE}</title>`);
        expect(response.body).toContain('<link rel="canonical" href="https://radar.infopunks.fun/"');
        expect(response.body).not.toContain('data-rh-pulse-context');
      }
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });

  it('supports Pulse methodology and future call/receipt metadata structurally', async () => {
    const clientDistDir = createClientDistFixture();
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir });

    try {
      const methodology = await app.inject({ method: 'GET', url: '/methodology', headers: { host: 'pulse.infopunks.fun' } });
      expect(methodology.body).toContain('<title>RH Pulse Methodology | Infopunks</title>');
      expect(methodology.body).toContain('<link rel="canonical" href="https://pulse.infopunks.fun/methodology"');

      const call = await app.inject({ method: 'GET', url: '/calls/call-01', headers: { host: 'pulse.infopunks.fun' } });
      expect(call.body).toContain('<title>RH Pulse Call call-01 | Infopunks</title>');
      expect(call.body).toContain('<link rel="canonical" href="https://pulse.infopunks.fun/calls/call-01"');

      const receipt = await app.inject({ method: 'GET', url: '/rh-pulse/receipts/receipt-01', headers: { host: 'radar.infopunks.fun' } });
      expect(receipt.body).toContain('<title>RH Pulse Receipt receipt-01 | Infopunks</title>');
      expect(receipt.body).toContain('<link rel="canonical" href="https://pulse.infopunks.fun/receipts/receipt-01"');

      const resolution = await app.inject({ method: 'GET', url: '/resolutions/window-01', headers: { host: 'pulse.infopunks.fun' } });
      expect(resolution.body).toContain('<title>RH Pulse Resolution window-01 | Infopunks</title>');
      expect(resolution.body).toContain('<link rel="canonical" href="https://pulse.infopunks.fun/resolutions/window-01"');

      const rotationReceipt = await app.inject({ method: 'GET', url: '/rh-pulse/rotation-receipts/rotation-01', headers: { host: 'radar.infopunks.fun' } });
      expect(rotationReceipt.body).toContain('<title>RH Pulse Rotation Receipt rotation-01 | Infopunks</title>');
      expect(rotationReceipt.body).toContain('<link rel="canonical" href="https://pulse.infopunks.fun/rotation-receipts/rotation-01"');
    } finally {
      await app.close();
      rmSync(clientDistDir, { recursive: true, force: true });
    }
  });
});

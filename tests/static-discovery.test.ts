import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const projectFileUrl = (path: string) => new URL(`../${path}`, import.meta.url);

describe('static public discovery metadata', () => {
  it('exposes crawler and social metadata in the HTML shell', async () => {
    const html = await readProjectFile('index.html');

    expect(html).toContain('<title>Infopunks Pay.sh Radar | Intelligence Terminal for Solana Agent Payments</title>');
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical" href="https://radar.infopunks.fun/"');
    expect(html).toContain('name="robots" content="index,follow"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('property="og:url" content="https://radar.infopunks.fun/"');
    expect(html).toContain('rel="icon" href="/favicon.ico" sizes="any"');
    expect(html).toContain('rel="icon" href="/favicon.svg" type="image/svg+xml"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(html).toContain('rel="manifest" href="/site.webmanifest"');
    expect(html).toContain('property="og:image" content="https://radar.infopunks.fun/og-radar.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('property="og:image:alt"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image" content="https://radar.infopunks.fun/og-radar.png"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type": "SoftwareApplication"');
    expect(html).toContain('<noscript>');
    expect(html).toContain('<h1>Infopunks Pay.sh Radar</h1>');
    expect(html).toContain('/v1/radar/preflight/batch');
  });

  it('publishes robots, sitemap, llms, and well-known metadata files', async () => {
    const robots = await readProjectFile('public/robots.txt');
    const sitemap = await readProjectFile('public/sitemap.xml');
    const llms = await readProjectFile('public/llms.txt');
    const wellKnown = JSON.parse(await readProjectFile('public/.well-known/infopunks-pay-sh-radar.json'));

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://radar.infopunks.fun/sitemap.xml');
    expect(sitemap).toContain('<loc>https://radar.infopunks.fun/</loc>');
    expect(sitemap).toContain('<loc>https://radar.infopunks.fun/openapi.json</loc>');
    expect(llms).toContain('does not execute paid Pay.sh APIs');
    expect(llms).toContain('Route intelligence and preflight output are advisory');
    expect(llms).toContain('https://radar.infopunks.fun/openapi.json');
    expect(wellKnown.name).toBe('Infopunks Pay.sh Radar');
    expect(wellKnown.openapi).toBe('https://radar.infopunks.fun/openapi.json');
    expect(wellKnown.safety).toBe('safe_metadata_only_no_paid_api_execution');
    expect(wellKnown.capabilities).toContain('agent_preflight');
  });

  it('publishes social preview, favicon, and manifest assets', async () => {
    const image = await readFile(projectFileUrl('public/og-radar.png'));
    const imageStats = await stat(projectFileUrl('public/og-radar.png'));
    const faviconIco = await readFile(projectFileUrl('public/favicon.ico'));
    const faviconSvg = await readFile(projectFileUrl('public/favicon.svg'), 'utf8');
    const appleTouchIcon = await readFile(projectFileUrl('public/apple-touch-icon.png'));
    const icon192 = await readFile(projectFileUrl('public/icon-192.png'));
    const icon512 = await readFile(projectFileUrl('public/icon-512.png'));
    const manifest = JSON.parse(await readProjectFile('public/site.webmanifest'));

    expect(imageStats.isFile()).toBe(true);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
    expect(faviconIco.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x00, 0x01, 0x00]));
    expect(faviconSvg).toContain('<svg');
    expect(faviconSvg).toContain('#06140f');
    expect(appleTouchIcon.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(appleTouchIcon.readUInt32BE(16)).toBe(180);
    expect(appleTouchIcon.readUInt32BE(20)).toBe(180);
    expect(icon192.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(icon192.readUInt32BE(16)).toBe(192);
    expect(icon192.readUInt32BE(20)).toBe(192);
    expect(icon512.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(icon512.readUInt32BE(16)).toBe(512);
    expect(icon512.readUInt32BE(20)).toBe(512);
    expect(manifest.name).toBe('Infopunks Pay.sh Radar');
    expect(manifest.short_name).toBe('Radar');
    expect(manifest.theme_color).toBe('#06140f');
    expect(manifest.background_color).toBe('#06140f');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]);
  });
});

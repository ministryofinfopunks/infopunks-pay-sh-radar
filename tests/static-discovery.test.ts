import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

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
    expect(html).toContain('property="og:image" content="/og-radar.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image" content="/og-radar.png"');
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
});

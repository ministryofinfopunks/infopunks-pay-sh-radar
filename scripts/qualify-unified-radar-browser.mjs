import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

// QA tooling stays outside runtime dependencies. Supply installed package paths explicitly.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.RADAR_QA_PLAYWRIGHT ?? 'playwright');
const axePath = process.env.RADAR_QA_AXE ?? require.resolve('axe-core/axe.min.js');
const base = process.env.RADAR_QA_URL ?? 'http://127.0.0.1:8799';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('local_qualification_only');
const output = path.resolve('docs/evidence/unified-radar/browser');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.RADAR_QA_CHROMIUM ? { executablePath: process.env.RADAR_QA_CHROMIUM } : {}) });
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const reports = [];
const routes = ['/', '/solana', '/4663', '/rh-chain-signal-desk', '/spend-terminal', '/rh-chain-signal-desk/market', '/radar/cards', '/receipts', '/receipts/receipt_001', '/loops', '/developers'];
for (const [viewportName, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } })) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport });
    const network = [], errors = [];
    page.on('pageerror', error => errors.push({ type: 'exception', message: error.message }));
    page.on('console', message => { if (['error','warning'].includes(message.type())) errors.push({ type: message.type(), message: message.text() }); });
    page.on('response', response => { if (response.url().includes('/v1/') || response.status() >= 400) network.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    page.on('requestfailed', request => network.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }));
    const began = Date.now();
    const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('h1, [role="alert"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1400);
    if (route === '/spend-terminal') {
      await page.getByRole('button', { name: 'Run a Check' }).click();
      await page.getByRole('heading', { name: 'Insufficient evidence' }).waitFor({ timeout: 15000 });
    }
    await page.addScriptTag({ path: axePath });
    const accessibility = await page.evaluate(async () => {
      const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } });
      return { violations: result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), incomplete: result.incomplete.map(v => ({ id: v.id, nodes: v.nodes.length })), passes: result.passes.length };
    });
    const dom = await page.evaluate(() => ({ title: document.title, h1: [...document.querySelectorAll('h1')].map(el => el.textContent), width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect();return r.width && (r.right > innerWidth + 2 || r.left < -2) && getComputedStyle(el).position !== 'fixed'; }).slice(0,12).map(el => ({ tag: el.tagName, className: el.className })),
      navigation: [...document.querySelectorAll('.product-wayfinding a')].map(a => ({ label: a.textContent, href: a.getAttribute('href') })),
      performance: performance.getEntriesByType('navigation').map(n => ({ dom_content_loaded_ms: n.domContentLoadedEventEnd, transfer_bytes: n.transferSize })),
      resource_bytes: performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).reduce((sum,r)=>sum+r.transferSize,0),
      form: document.querySelector('.spend-result')?.textContent }));
    const screenshot = `${viewportName}-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}.png`;
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(output, screenshot), fullPage: route === '/' || route === '/spend-terminal' });
    reports.push({ viewportName, viewport, route, http_status: response.status(), elapsed_ms: Date.now()-began, screenshot, dom, accessibility, network, errors });
    await fs.writeFile(path.join(output,'results.json'), JSON.stringify({ source_sha: sourceSha, environment: 'Local compiled API; development fixtures; no paid/execution/signing capability enabled. No external verification asserted.', reports }, null, 2));
    console.log(viewportName, route, 'overflow', dom.scrollWidth > viewport.width, 'axe', accessibility.violations.length);
    await page.close();
  }
}
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await page.goto(base);
const keyboard=[];
for(let i=0;i<8;i++){await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outlineStyle})));}
await fs.writeFile(path.join(output,'keyboard-reduced-motion.json'),JSON.stringify({keyboard,scrollBehavior:await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)},null,2));
await browser.close();

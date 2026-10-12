import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.RADAR_QA_PLAYWRIGHT ?? 'playwright');
const base = process.env.RADAR_QA_URL ?? 'http://127.0.0.1:8799';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('local_qualification_only');
const axePath = process.env.RADAR_QA_AXE ?? require.resolve('axe-core/axe.min.js');
const out = path.resolve('docs/evidence/terminal-ui');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.RADAR_QA_CHROMIUM ? { executablePath: process.env.RADAR_QA_CHROMIUM } : {}) });
const reports = [];
const routes = ['/', '/solana', '/4663', '/rh-chain-signal-desk', '/spend-terminal', '/rh-chain-signal-desk/market', '/radar/cards', '/receipts', '/receipts/receipt_001', '/loops', '/developers'];
for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 }, compact: { width: 320, height: 800 } })) {
  for (const route of name === 'compact' ? ['/', '/spend-terminal'] : routes) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [], failures = [], api = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) failures.push({ url: new URL(r.url()).pathname, status: r.status() }); if (r.url().includes('/v1/')) api.push(new URL(r.url()).pathname); });
    page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }));
    const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 20000 });
    if (route === '/spend-terminal') { await page.getByRole('button', { name: 'Run a Check' }).click(); await page.getByRole('heading', { name: 'Insufficient evidence' }).waitFor(); }
    await page.addScriptTag({ path: axePath });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } });
      return { violations: r.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, message: n.failureSummary })) })), incomplete: r.incomplete.map(v => ({ id: v.id, nodes: v.nodes.length })) };
    });
    const dom = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth, title: document.title, h1: [...document.querySelectorAll('h1')].map(n => n.textContent), nav: [...document.querySelectorAll('.product-wayfinding a')].map(a => ({ label: a.textContent, href: a.getAttribute('href') })), overflowing: [...document.querySelectorAll('body *')].filter(el => { const r=el.getBoundingClientRect(); return r.width && (r.right > innerWidth+2 || r.left < -2) && getComputedStyle(el).position !== 'fixed'; }).slice(0,8).map(el => ({ tag: el.tagName, class: el.className })) }));
    const screenshot = `${name}-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}.png`;
    await page.screenshot({ path: path.join(out, screenshot), fullPage: route === '/' || route === '/spend-terminal' });
    reports.push({ name, route, viewport, status: response.status(), screenshot, axe, dom, errors, failures, initial_api_requests: route === '/' ? api : undefined });
    console.log(name, route, 'axe', axe.violations.length, 'overflow', dom.scrollWidth > viewport.width, 'errors', errors.length);
    await page.close();
  }
}
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await page.goto(base);
const toggle=page.getByRole('button',{name:'Open navigation'});
await toggle.click();
const mobileNav = await page.getByRole('navigation', { name: 'Infopunks product navigation' }).getByRole('link').count();
await page.addScriptTag({path:axePath});
const menuAxe = await page.evaluate(async()=> (await window.axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id));
await page.getByRole('link',{name:'Solana',exact:true}).focus();
await page.keyboard.press('Escape');
const menuDismiss = await toggle.getAttribute('aria-expanded') === 'false' && await toggle.evaluate(el => el === document.activeElement);
await page.locator('.radar-evidence-list summary').first().click();
const evidenceExpanded = await page.locator('.radar-evidence-list details').first().getAttribute('open') !== null;
await page.getByLabel('Route, endpoint, or provider identifier').fill('solana:mainnet:service_route:route/a?b=c&d=1');
await page.getByRole('button',{name:'Run Spend Check'}).click();
await page.waitForURL('**/spend-terminal?**');
const preservedSubject = await page.getByLabel('Subject or route identifier').inputValue();
await page.getByRole('button',{name:'Run a Check'}).click();
await page.getByRole('heading',{name:'Insufficient evidence'}).waitFor();
const realResult = await page.locator('.spend-result').textContent();
await page.goto(base);
await page.keyboard.press('Tab');
const keyboardFocus = await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outlineStyle,scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior}));
const report = { source_sha: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), working_tree_diff: execFileSync('git',['diff','--stat'],{encoding:'utf8'}), environment: 'Local compiled API with development fixtures; payment/execution disabled. No external proof or readiness asserted.', reports, interactions: { mobileNav, menuAxe, menuDismiss, evidenceExpanded, preservedSubject, realResult, keyboardFocus } };
await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(report,null,2));
await browser.close();
if(reports.some(r=>r.axe.violations.length || r.errors.length || r.failures.length || r.dom.scrollWidth>r.viewport.width) || menuAxe.length || !menuDismiss || !evidenceExpanded || mobileNav!==5 || preservedSubject!=='solana:mainnet:service_route:route/a?b=c&d=1')process.exitCode=1;

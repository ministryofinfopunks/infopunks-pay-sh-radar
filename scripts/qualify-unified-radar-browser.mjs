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
const output = path.resolve(process.env.RADAR_QA_OUTPUT_DIR ?? 'docs/evidence/unified-radar/browser');
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
      overflowing: [...document.querySelectorAll('body *')].filter(el => {
        const rect = el.getBoundingClientRect(); const style = getComputedStyle(el);
        if (!rect.width || style.position === 'fixed' || style.clipPath !== 'none' || style.clip !== 'auto') return false;
        if (!(rect.right > innerWidth + 2 || rect.left < -2)) return false;
        for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const parentStyle = getComputedStyle(parent); const bounds = parent.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(parentStyle.overflowX) && (rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1)) return false;
        }
        return true;
      }).slice(0,12).map(el => ({ tag: el.tagName, className: el.className })),
      codeScrollRegions: [...document.querySelectorAll('pre.builder-code-block')].map(el => ({
        label: el.getAttribute('aria-label'), role: el.getAttribute('role'), tabIndex: el.getAttribute('tabindex'),
        bounded: el.clientWidth <= innerWidth && el.getBoundingClientRect().right <= innerWidth + 1,
        horizontalOverflow: el.scrollWidth > el.clientWidth, overflowX: getComputedStyle(el).overflowX
      })),
      navigation: [...document.querySelectorAll('.product-wayfinding a')].map(a => ({ label: a.textContent, href: a.getAttribute('href') })),
      performance: performance.getEntriesByType('navigation').map(n => ({ dom_content_loaded_ms: n.domContentLoadedEventEnd, transfer_bytes: n.transferSize })),
      resource_bytes: performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).reduce((sum,r)=>sum+r.transferSize,0),
      ids: [...document.querySelectorAll('[id]')].map(el => el.id),
      links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), label: a.textContent?.trim().slice(0, 120) })),
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
const routeDocuments = new Map(reports.filter(r => r.viewportName === 'desktop').map(r => [r.route, r.dom.ids]));
const navigationAudit = [];
for (const report of reports.filter(r => r.viewportName === 'desktop')) {
  for (const link of report.dom.links) {
    const destination = new URL(link.href, base + report.route);
    const ids = routeDocuments.get(destination.pathname);
    navigationAudit.push({ from: report.route, ...link, external: destination.origin !== base,
      checked_fragment: destination.origin === base && destination.hash && ids ? destination.hash === '#methodology' && destination.pathname === '/solana' ? 'opens_methodology_dialog' : ids.includes(decodeURIComponent(destination.hash.slice(1))) : null });
  }
}
await fs.writeFile(path.join(output, 'navigation-audit.json'), JSON.stringify({ source_sha: sourceSha, links: navigationAudit, broken_known_fragments: navigationAudit.filter(link => link.checked_fragment === false), unvisited_destination_policy: 'Deep routes outside this viewport matrix remain inventoried; no operation or external action is inferred from a link.' }, null, 2));
const failureScenarios = [];
for (const scenario of ['server_failure', 'timeout']) {
  const failedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await failedPage.route('**/v1/pre-spend/check', async route => {
    if (scenario === 'server_failure') await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"qualification_injected_failure"}' });
    // An intentionally unanswered request exercises the real browser timeout. No success is fabricated.
  });
  await failedPage.goto(base + '/spend-terminal?subject=route_for_qualification&intent=quote');
  await failedPage.getByRole('button', { name: 'Run a Check' }).click();
  await failedPage.getByRole('alert').waitFor({ timeout: 16000 });
  failureScenarios.push({ scenario, classification: 'INJECTED_LOCAL_FAILURE_ONLY', message: await failedPage.getByRole('alert').textContent(), retry_available: await failedPage.getByRole('button', { name: 'Retry check' }).isEnabled(), deep_link_subject: await failedPage.getByLabel('Subject or route identifier').inputValue() });
  await failedPage.close();
}
await fs.writeFile(path.join(output, 'failure-recovery.json'), JSON.stringify({ source_sha: sourceSha, failureScenarios }, null, 2));
const zoomReports = [];
for (const width of [720, 360]) {
  for (const route of ['/developers', '/rh-chain-signal-desk/market', '/4663', '/spend-terminal']) {
    const zoomPage = await browser.newPage({ viewport: { width, height: 900 } });
    const response = await zoomPage.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await zoomPage.waitForTimeout(700);
    const metrics = await zoomPage.evaluate(() => ({ viewport_width: innerWidth, document_width: document.documentElement.scrollWidth, overflowing: document.documentElement.scrollWidth > innerWidth,
      code_regions: [...document.querySelectorAll('pre.builder-code-block')].map(el => ({ label: el.getAttribute('aria-label'), tabIndex: el.getAttribute('tabindex'), bounded: el.getBoundingClientRect().right <= innerWidth + 1, scrollable: el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === 'auto' })) }));
    zoomReports.push({ zoom_equivalent: width === 720 ? '200_percent' : '400_percent', route, http_status: response?.status() ?? null, ...metrics });
    await zoomPage.close();
  }
}
await fs.writeFile(path.join(output, 'zoom-and-code-scroll.json'), JSON.stringify({ source_sha: sourceSha, method: 'Equivalent CSS viewport widths at 100% browser zoom: 720px (200% of 1440 CSS px) and 360px (400% of 1440 CSS px). This is reflow coverage, not browser zoom UI automation.', reports: zoomReports }, null, 2));
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await page.goto(base);
const keyboard=[];
for(let i=0;i<8;i++){await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outlineStyle})));}
const keyboardReducedMotion = { source_sha: sourceSha, keyboard, reduced_motion: await page.evaluate(() => ({ requested: matchMedia('(prefers-reduced-motion: reduce)').matches, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior })) };
await fs.writeFile(path.join(output,'keyboard-reduced-motion.json'),JSON.stringify(keyboardReducedMotion,null,2));
await browser.close();
const failures = [];
for (const report of reports) {
  if (report.http_status !== 200) failures.push(`${report.viewportName}:${report.route}:http_${report.http_status}`);
  if (report.dom.scrollWidth > report.viewport.width || report.dom.overflowing.length) failures.push(`${report.viewportName}:${report.route}:horizontal_overflow`);
  if (report.accessibility.violations.length) failures.push(`${report.viewportName}:${report.route}:axe_violations_${report.accessibility.violations.length}`);
  if (report.route === '/4663' && report.network.some(item => /\/v1\/4663\/(?:me(?:\/|$|\?)|proof\/|pulse\/reputation)/.test(item.path))) failures.push(`${report.viewportName}:/4663:anonymous_private_request`);
  if (report.route === '/developers' && report.dom.codeScrollRegions.some(region => region.role !== 'region' || !region.label || region.tabIndex !== '0' || !region.bounded || region.overflowX !== 'auto')) failures.push(`${report.viewportName}:/developers:code_scroll_region_invalid`);
}
for (const report of zoomReports) {
  if (report.http_status !== 200 || report.overflowing || report.code_regions.some(region => !region.bounded || !region.scrollable || !region.label || region.tabIndex !== '0')) failures.push(`${report.zoom_equivalent}:${report.route}:reflow_or_code_scroll_failure`);
}
if (!keyboardReducedMotion.reduced_motion.requested || keyboard.some(item => item.tag === 'BODY' || item.outline === 'none')) failures.push('keyboard_or_reduced_motion_failure');
const summary = { source_sha: sourceSha, route_count: reports.length, viewport_count: new Set(reports.map(r => r.viewportName)).size, http_failures: reports.filter(r => r.http_status !== 200).length, document_overflow_failures: reports.filter(r => r.dom.scrollWidth > r.viewport.width || r.dom.overflowing.length).length, axe_violation_count: reports.reduce((sum, r) => sum + r.accessibility.violations.length, 0), axe_incomplete_node_count: reports.reduce((sum, r) => sum + r.accessibility.incomplete.reduce((n, item) => n + item.nodes, 0), 0), private_request_failures: failures.filter(f => f.includes('anonymous_private_request')).length, reflow_reports: zoomReports.length, keyboard_reduced_motion_recorded: true, failures };
await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
if (failures.length) throw new Error(`browser_qualification_failed:${failures.join(',')}`);
console.log('browser qualification passed', JSON.stringify(summary));

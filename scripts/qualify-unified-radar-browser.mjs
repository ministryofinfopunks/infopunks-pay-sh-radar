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
const checkRequestKeys = new Map();
const routes = ['/', '/solana', '/4663', '/rh-chain-signal-desk', '/spend-terminal', '/rh-chain-signal-desk/market', '/radar/cards', '/receipts', '/receipts/receipt_001', '/loops', '/developers'];
for (const [viewportName, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } })) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport });
    const network = [], errors = []; let checkRequestCount = 0;
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'POST' && url.pathname === '/v1/pre-spend/check') {
        checkRequestCount++;
        const requestKey = request.headers()['idempotency-key'];
        if (requestKey) checkRequestKeys.set(viewportName, requestKey);
      }
    });
    page.on('pageerror', error => errors.push({ type: 'exception', message: error.message }));
    page.on('console', message => { if (['error','warning'].includes(message.type())) errors.push({ type: message.type(), message: message.text() }); });
    page.on('response', response => { if (response.url().includes('/v1/') || response.status() >= 400) network.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    page.on('requestfailed', request => network.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }));
    const began = Date.now();
    const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('h1, [role="alert"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1400);
    if (route === '/spend-terminal') {
      if (process.env.RADAR_QA_TENANT_KEY) await page.getByLabel('Tenant access key', { exact: true }).fill(process.env.RADAR_QA_TENANT_KEY);
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
          const parentStyle = getComputedStyle(parent);
          // Descendant content may extend past the scrollport by design; the
          // scroll container bounds the page while the dedicated check below
          // verifies that the region itself is visible, labelled and scrollable.
          if (/(auto|scroll|hidden|clip)/.test(parentStyle.overflowX)) return false;
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
    const credentialExposure = route === '/spend-terminal' && process.env.RADAR_QA_TENANT_KEY
      ? await page.evaluate(key => ({ url_contains_key: location.href.includes(key), local_storage_contains_key: Object.values(localStorage).some(value => value.includes(key)), password_input: document.querySelector('input[aria-label="Tenant access key"]')?.getAttribute('type') === 'password' }), process.env.RADAR_QA_TENANT_KEY)
      : null;
    reports.push({ viewportName, viewport, route, http_status: response.status(), elapsed_ms: Date.now()-began, screenshot, dom, accessibility, network, errors, ...(route === '/spend-terminal' ? { check_request_count: checkRequestCount, credential_exposure: credentialExposure } : {}) });
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
  await failedPage.getByLabel('Tenant access key', { exact: true }).fill('radar-ci-tenant-a-static-not-secret');
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
      code_regions: [...document.querySelectorAll('pre.builder-code-block')].map(el => ({ label: el.getAttribute('aria-label'), tabIndex: el.getAttribute('tabindex'), bounded: el.getBoundingClientRect().right <= innerWidth + 1, requiresScroll: el.scrollWidth > el.clientWidth, scrollable: getComputedStyle(el).overflowX === 'auto' })) }));
    let keyboardScroll = null;
    const scrollIndex = metrics.code_regions.findIndex(region => region.requiresScroll);
    if (scrollIndex >= 0) {
      const codeRegion = zoomPage.locator('pre.builder-code-block').nth(scrollIndex);
      await codeRegion.focus();
      const before = await codeRegion.evaluate(el => el.scrollLeft);
      await zoomPage.keyboard.press('ArrowRight');
      await zoomPage.waitForTimeout(100);
      const after = await codeRegion.evaluate(el => el.scrollLeft);
      keyboardScroll = { focused: await codeRegion.evaluate(el => document.activeElement === el), before, after, advanced: after > before };
    }
    zoomReports.push({ zoom_equivalent: width === 720 ? '200_percent' : '400_percent', route, http_status: response?.status() ?? null, ...metrics, ...(route === '/developers' ? { keyboard_scroll: keyboardScroll } : {}) });
    await zoomPage.close();
  }
}
await fs.writeFile(path.join(output, 'zoom-and-code-scroll.json'), JSON.stringify({ source_sha: sourceSha, method: 'Equivalent CSS viewport widths at 100% browser zoom: 720px (200% of 1440 CSS px) and 360px (400% of 1440 CSS px). This is reflow coverage, not browser zoom UI automation.', reports: zoomReports }, null, 2));
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await page.goto(base);
await page.waitForSelector('a.radar-app-skip', { state: 'attached', timeout: 15000 });
const keyboard=[];
for(let i=0;i<8;i++){
  let probe = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.keyboard.press('Tab');
    probe = await page.evaluate(tabAttempts => {
      const active = document.activeElement;
      const style = getComputedStyle(active);
      const outlineVisible = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
      const shadowAlphas = [...style.boxShadow.matchAll(/rgba\([^)]*,\s*([0-9.]+)\s*\)/g)].map(([, alpha]) => Number(alpha));
      const shadowVisible = style.boxShadow !== 'none' && (shadowAlphas.length === 0 || shadowAlphas.some(alpha => alpha > 0));
      return { tag:active.tagName,text:active.textContent,focusVisible:active.matches(':focus-visible'),outline:style.outlineStyle,outlineWidth:style.outlineWidth,boxShadow:style.boxShadow,visibleIndicator:outlineVisible || shadowVisible,tabAttempts };
    }, attempt);
    if (probe.tag !== 'BODY') break;
  }
  keyboard.push(probe);
}
const keyboardReducedMotion = { source_sha: sourceSha, keyboard, reduced_motion: await page.evaluate(() => ({ requested: matchMedia('(prefers-reduced-motion: reduce)').matches, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior })) };
await fs.writeFile(path.join(output,'keyboard-reduced-motion.json'),JSON.stringify(keyboardReducedMotion,null,2));
let authenticatedBrowser = null;
if (process.env.RADAR_QA_TENANT_KEY) {
  const requiredKeys = ['RADAR_QA_OTHER_TENANT_KEY', 'RADAR_QA_WRONG_AGENT_KEY', 'RADAR_QA_EXPIRED_KEY'];
  if (requiredKeys.some(name => !process.env[name])) throw new Error('synthetic_tenant_matrix_configuration_missing');
  const requestKey = checkRequestKeys.get('desktop');
  if (!requestKey) throw new Error('authenticated_check_idempotency_key_missing');
  const authPage = await browser.newPage();
  await authPage.goto(base + '/spend-terminal');
  authenticatedBrowser = await authPage.evaluate(async ({ tenantA, tenantB, wrongAgent, expired, requestKey }) => {
    const get = async (path, token) => {
      const response = await fetch(path, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      return { status: response.status, state: body?.data?.state ?? null, error: body?.error ?? null };
    };
    const proof = `/v1/judgments/requests/${encodeURIComponent(requestKey)}`;
    return {
      tenant_a_own_request: await get(proof, tenantA),
      tenant_b_denied_tenant_a: await get(proof, tenantB),
      same_tenant_wrong_agent: await get(proof, wrongAgent),
      invalid_credential: await get('/v1/judgment/session', 'invalid-synthetic-credential'),
      expired_credential: await get('/v1/judgment/session', expired),
      missing_credential: await get('/v1/judgment/session', null),
      credential_exposure: { url_contains_credential: [tenantA, tenantB, wrongAgent, expired].some(key => location.href.includes(key)), local_storage_contains_credential: [tenantA, tenantB, wrongAgent, expired].some(key => Object.values(localStorage).some(value => value.includes(key))) }
    };
  }, { tenantA: process.env.RADAR_QA_TENANT_KEY, tenantB: process.env.RADAR_QA_OTHER_TENANT_KEY, wrongAgent: process.env.RADAR_QA_WRONG_AGENT_KEY, expired: process.env.RADAR_QA_EXPIRED_KEY, requestKey });
  await fs.writeFile(path.join(output, 'authenticated-tenant-browser.json'), JSON.stringify({ source_sha: sourceSha, environment: 'synthetic tenant credentials; disposable PostgreSQL; payment disabled', results: authenticatedBrowser }, null, 2));
  await authPage.close();
}
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
  if (report.http_status !== 200 || report.overflowing || report.code_regions.some(region => !region.bounded || (region.requiresScroll && !region.scrollable) || !region.label || region.tabIndex !== '0')) failures.push(`${report.zoom_equivalent}:${report.route}:reflow_or_code_scroll_failure`);
  if (report.route === '/developers' && report.code_regions.some(region => region.requiresScroll) && (!report.keyboard_scroll?.focused || !report.keyboard_scroll.advanced)) failures.push(`${report.zoom_equivalent}:/developers:keyboard_code_scroll_failure`);
}
if (!keyboardReducedMotion.reduced_motion.requested || keyboard.some(item => item.tag === 'BODY' || !item.focusVisible || !item.visibleIndicator)) failures.push('keyboard_or_reduced_motion_failure');
if (process.env.RADAR_QA_TENANT_KEY && reports.filter(r => r.route === '/spend-terminal').some(r => r.check_request_count !== 1 || !r.credential_exposure?.password_input || r.credential_exposure.url_contains_key || r.credential_exposure.local_storage_contains_key)) failures.push('authenticated_check_request_or_credential_exposure');
if (authenticatedBrowser && (authenticatedBrowser.tenant_a_own_request.status !== 200 || authenticatedBrowser.tenant_a_own_request.state !== 'assessed_free' || authenticatedBrowser.tenant_b_denied_tenant_a.status !== 404 || authenticatedBrowser.same_tenant_wrong_agent.status !== 404 || authenticatedBrowser.invalid_credential.status !== 401 || authenticatedBrowser.expired_credential.status !== 401 || authenticatedBrowser.missing_credential.status !== 401 || authenticatedBrowser.credential_exposure.url_contains_credential || authenticatedBrowser.credential_exposure.local_storage_contains_credential)) failures.push('authenticated_tenant_browser_failure');
const summary = { source_sha: sourceSha, route_count: reports.length, viewport_count: new Set(reports.map(r => r.viewportName)).size, http_failures: reports.filter(r => r.http_status !== 200).length, document_overflow_failures: reports.filter(r => r.dom.scrollWidth > r.viewport.width || r.dom.overflowing.length).length, axe_violation_count: reports.reduce((sum, r) => sum + r.accessibility.violations.length, 0), axe_incomplete_node_count: reports.reduce((sum, r) => sum + r.accessibility.incomplete.reduce((n, item) => n + item.nodes, 0), 0), private_request_failures: failures.filter(f => f.includes('anonymous_private_request')).length, reflow_reports: zoomReports.length, keyboard_reduced_motion_recorded: true, failures };
await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
if (failures.length) throw new Error(`browser_qualification_failed:${failures.join(',')}`);
console.log('browser qualification passed', JSON.stringify(summary));

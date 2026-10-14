// Controlled client recovery qualification only. No database, payment, or signing capability.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const base = process.env.RADAR_UI_BASE_URL || 'http://127.0.0.1:5189';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('isolated_local_origin_required');
const out = path.resolve(process.env.RADAR_UI_OUTPUT || 'output/radar-v1/ux-qa2');
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/ux-qa2-catalog.json', 'utf8'));
fs.mkdirSync(out, { recursive: true });
const results = [];
(async () => {
 const browser = await chromium.launch(process.env.RADAR_QA_CHROMIUM ? { executablePath: process.env.RADAR_QA_CHROMIUM } : {});
 try {
  for (const width of [390, 1440]) {
   const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
   const page = await context.newPage(); const pageErrors = [];
   page.on('pageerror', error => pageErrors.push(error.message));
   let searchPayload = {}; let shareRequests = 0;
   await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
    // Optional client-only preview replay. Required CI uses the actual API router.
    if (process.env.RADAR_UI_REPLAY_MALFORMED_NAVIGATION === 'true' && route.request().isNavigationRequest() && ['%E0%A4%A', '%FF'].some(id => url.pathname.endsWith(id))) return route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('dist/client/index.html','utf8')});
    if (url.pathname === '/v1/search') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(searchPayload)});
    if (url.pathname.startsWith('/v1/4663/share/')) { shareRequests++; return route.fulfill({status:url.pathname.endsWith('bad-contract') ? 200 : 404,contentType:'application/json',body:url.pathname.endsWith('bad-contract') ? '{"data":{}}' : '{}'}); }
    if (url.pathname.startsWith('/v1/receipt-spine/')) return route.fulfill({status:401,contentType:'application/json',body:'{}'});
    if (url.pathname.startsWith('/v1/')) { const entry = fixture.responses[url.pathname+url.search]; return route.fulfill({status:entry?.status??404,contentType:entry?.contentType??'application/json',body:entry?.body??'{}'}); }
    return route.continue();
   });
   for (const [id, payload] of [['empty-object',{}],['object-data',{data:{}}],['null-data',{data:null}]]) {
    searchPayload = payload; await page.goto(base+'/solana');
    await page.locator('#semantic-search-input').fill('qa2 query');
    await page.locator('.semantic-search-form button[type=submit]').click();
    await page.getByText('Search could not complete. Retry this query or clear it.',{exact:true}).waitFor();
    assert.equal(await page.getByText('No matching providers.',{exact:true}).count(),0);
    results.push({id:'UX-02:'+id,width,pass:true});
   }
   for (const id of ['unknown','%E0%A4%A','%FF']) {
    const navigation = await page.goto(base+'/4663/share/'+id+(id==='unknown'?'?source=watch':''));
    if (id !== 'unknown' && process.env.RADAR_UI_REPLAY_MALFORMED_NAVIGATION !== 'true') {
     assert.equal(navigation.status(), 400);
     assert.ok(navigation.headers()['content-type'].includes('text/html'));
    }
    await page.getByRole('heading',{name:'Shared Robinhood evidence',exact:true}).waitFor();
    assert.ok(await page.locator('main a[href="/4663"]').count());
    assert.ok(!(await page.locator('main').innerText()).includes('Solana'));
    results.push({id:'UX-03:'+id,width,pass:true});
   }
   await page.goto(base+'/4663/share/bad-contract');
   await page.getByRole('heading',{name:'Shared Robinhood evidence',exact:true}).waitFor();
   await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
   const beforeRetry = shareRequests; const retried = page.waitForResponse(response => response.url().endsWith('/v1/4663/share/bad-contract'));
   await page.getByRole('button',{name:'Retry',exact:true}).click(); await retried;
   await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
   assert.ok(shareRequests > beforeRetry); results.push({id:'UX-04:bad-contract',width,pass:true});
   await page.goto(base+'/proof/execution/unknown');
   await page.locator('#receipt-tenant-key').fill('qa2-invalid-synthetic-key');
   await page.getByRole('button',{name:'Inspect receipt',exact:true}).click();
   await page.locator('#receipt-tenant-key[aria-invalid=true]').waitFor();
   assert.equal(await page.locator('#receipt-tenant-key').evaluate(el => document.activeElement === el && !el.disabled),true);
   assert.ok(!(await page.locator('main').innerText()).includes('qa2-invalid-synthetic-key'));
   results.push({id:'Receipt-authentication:401',width,pass:true});
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),true);
   await page.screenshot({path:path.join(out,`receipt-denial-${width}.png`),fullPage:true});
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const axe = await page.evaluate(() => window.axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
   fs.writeFileSync(path.join(out,`axe-receipt-denial-${width}.json`),JSON.stringify({violations:axe.violations,incomplete:axe.incomplete},null,2));
   assert.equal(axe.violations.length,0);
   assert.deepEqual(pageErrors,[]); await context.close();
  }
 } finally { await browser.close(); }
 const source_sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({source_sha,scope:'Automated Chromium client regression; 8 QA2 assertions at 390/1440 CSS pixels; controlled synthetic data responses; malformed navigation uses actual local API HTTP routing unless explicit preview replay is enabled; not device/assistive-technology approval',results},null,2));
 assert.equal(results.length,16); console.log('PASS: 16 browser QA2 cases (8 probes at 2 widths)');
})().catch(error => { fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),results},null,2)); console.error(error); process.exitCode=1; });

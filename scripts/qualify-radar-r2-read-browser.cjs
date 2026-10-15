// Source-bound local public-read qualification. No credentials, payment, or external UI actions.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const base = process.env.RADAR_R2_BASE || 'http://127.0.0.1:8922';
const release = process.env.RADAR_R2_RELEASE_BASE || 'http://127.0.0.1:8923';
const baseline = process.env.RADAR_R1_BASE || 'http://127.0.0.1:8921';
for (const url of [base, baseline, release]) if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw Error('local_origins_only');
const out = path.resolve(process.env.RADAR_R2_OUTPUT || 'output/radar-r2-read'); fs.mkdirSync(out, {recursive:true});
const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const reports = [], hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const browser = await chromium.launch();
 try {
  for (const width of [320,375,390,430,768,1024,1440]) {
   const context = await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   const page = await context.newPage(); const errors=[], methods=[];
   page.on('pageerror', error=>errors.push(error.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/v1/')) methods.push(r.method());});
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   // Compare exact R1 and R2 homepage pixels in the same engine/viewport; never update approved references.
   await page.goto(baseline+'/');await page.getByRole('heading',{name:'Before your agent spends, check the evidence.',exact:true}).waitFor();
   await page.locator('body').press('Home');const before=await page.screenshot({fullPage:true});fs.writeFileSync(path.join(out,`r1-home-${width}.png`),before);
   await page.goto(base+'/');await page.getByRole('heading',{name:'Before your agent spends, check the evidence.',exact:true}).waitFor();
   await page.locator('body').press('Home');const after=await page.screenshot({fullPage:true});fs.writeFileSync(path.join(out,`r2-home-${width}.png`),after);
   assert.equal(hash(before),hash(after),'homepage_pixel_drift');reports.push({case:'homepage exact R1/R2 pixel comparison',width,pass:true,baseline_sha:'8437572e3092f801d7d59ec2cef5f98d7408ad0d',r1_hash:hash(before),r2_hash:hash(after)});
   await page.goto(base+'/#methodology');await page.waitForFunction(()=>location.hash==='#proof'&&document.activeElement?.id==='proof');
   reports.push({case:'legacy methodology focus',width,pass:true});
   await page.goto(base+'/#agent-benchmark-api');await page.waitForURL(base+'/solana#agent-benchmark-api');await page.locator('#agent-benchmark-api').waitFor();
   reports.push({case:'legacy benchmark preserves Solana destination',width,pass:true,scope:'routing regression only; Solana catalogue remains excluded from public read proposal'});
   const profile = await (await page.request.get(release+'/openapi.json')).json();assert.equal(profile['x-radar-public-release'].profile,'public-read-v1');
   for(const route of ['/solana','/signal-hunt','/hermes','/loops','/machine-market','/revenue-receipts','/v1/hermes','/v1/signal-hunt','/v1/unicorn-radar?status=watchlist']){const denied=await page.request.get(release+route);assert.equal(denied.status(),403);assert.equal(denied.headers()['cache-control'],'private, no-store');}
   reports.push({case:'opt-in public profile direct-route and query boundary',width,pass:true});
   await page.goto(release+'/unicorn-radar');await page.getByRole('textbox',{name:'Search',exact:true}).waitFor();
   await page.getByRole('textbox',{name:'Search',exact:true}).fill('no-r2-candidate');await page.getByText('No candidates match this view. Adjust the filters or search.',{exact:true}).first().waitFor();
   await page.getByRole('textbox',{name:'Search',exact:true}).fill('KINS');await page.getByText('1 shown',{exact:true}).waitFor();
   await page.getByLabel('Sector',{exact:true}).selectOption('Gaming / Consumer');
   assert.equal(await page.getByRole('article',{name:'Kintara Unicorn Radar card',exact:true}).count(),1);
   reports.push({case:'actual API empty/search/native-filter journey',width,pass:true});
   await page.getByRole('article',{name:'Kintara Unicorn Radar card',exact:true}).getByRole('link',{name:'Open Candidate',exact:true}).click();
   await page.getByRole('heading',{name:'Kintara',exact:true}).waitFor();await page.getByText(/Archived desk judgments/).waitFor();
   assert.ok((await page.locator('main').innerText()).includes('Observed'));assert.ok((await page.getByRole('link',{name:'Inspect source',exact:true}).count())>0);
   reports.push({case:'dated source inspection, no issuance',width,pass:true});
   const providerState=(await page.locator('main').innerText()).includes('Captured by Radar')?'captured market data':'market observation unavailable';
   // Scoped accessibility/runtime evidence; human AT/native zoom/device approval remains separate.
   for (const [label,url] of [['candidate',await page.url()],['developers',release+'/developers']]) {
    if(url!==await page.url())await page.goto(url);
    await page.locator('main').waitFor();await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const axe=await page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return{violations:r.violations,incomplete:r.incomplete};});
    fs.writeFileSync(path.join(out,`axe-${label}-${width}.json`),JSON.stringify(axe,null,2));
    const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,resources:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).reduce((sum,r)=>sum+r.transferSize,0),navigation:performance.getEntriesByType('navigation').map(r=>({domContentLoadedMs:r.domContentLoadedEventEnd,transferBytes:r.transferSize}))}));
    assert.ok(geometry.scrollWidth<=width+2);assert.equal(axe.violations.length,0);
    await page.screenshot({path:path.join(out,`${label}-${width}.png`),fullPage:true});reports.push({case:label+' scoped axe/reflow/performance',width,pass:true,geometry,providerState:label==='candidate'?providerState:undefined});
   }
   if(width===390){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Close navigation',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Open navigation',exact:true}).evaluate(el=>document.activeElement===el),true);reports.push({case:'mobile menu Escape restores focus',width,pass:true});}
   // Controlled failure responses are explicitly labelled; actual successful retry reaches local backend.
   let failure='malformed';await page.route('**/v1/unicorn-radar',r=>failure==='none'?r.continue():r.fulfill({status:failure==='503'?503:200,contentType:'application/json',body:failure==='503'?'{}':'{"data":{}}'}));
   await page.goto(release+'/unicorn-radar');await page.getByText('Market intelligence unavailable',{exact:true}).waitFor();assert.equal(await page.getByText('No candidates match this view. Adjust the filters or search.',{exact:true}).count(),0);
   failure='503';await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByText('Market intelligence unavailable',{exact:true}).waitFor();
   failure='none';await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('textbox',{name:'Search',exact:true}).waitFor();
   reports.push({case:'malformed/503/retry state recovery',width,pass:true,scope:'controlled failures; success actual local HTTP'});
   assert.deepEqual(errors,[]);assert.ok(methods.every(m=>m==='GET'));await context.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({source_sha:sha,decision:'engineering evidence only',scope:'Local actual API reads plus explicitly controlled error responses; not production or independent approval; opt-in scope verified only on isolated local profile',reports},null,2));
 console.log('PASS',reports.length,'scoped R2 browser cases');
})().catch(error=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({source_sha:sha,error:String(error),reports},null,2));console.error(error);process.exitCode=1;});

// Replays immutable anonymous local evidence. No external requests or mutations.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fixturePath='docs/ux-hardening-2026-10-13/evidence/implementation/performance-fixture.json';
const bytes=fs.readFileSync(fixturePath),fixture=JSON.parse(bytes);
const bases={before:process.env.UX_BEFORE||'http://127.0.0.1:5183',after:process.env.UX_AFTER||'http://127.0.0.1:5188'};
for(const url of Object.values(bases))assert.match(url,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const results=[];
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 for(const width of [390,1440])for(const routePath of ['/','/spend-terminal','/solana','/4663/share/qualification-missing-record'])for(let repeat=0;repeat<3;repeat++)for(const subject of ['before','after']){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1,locale:'en-US',timezoneId:'Asia/Colombo'});const page=await context.newPage();const unknown=[],seen=[],pending=new Set();
  await page.clock.setFixedTime(new Date('2026-10-13T04:35:52Z'));
  await page.addInitScript(()=>{window.qaLongTasks=[];window.qaLcp=[];window.qaCls=[];for(const [type,key]of[['longtask','qaLongTasks'],['largest-contentful-paint','qaLcp'],['layout-shift','qaCls']])new PerformanceObserver(list=>window[key].push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration,value:e.value,hadRecentInput:e.hadRecentInput})))).observe({type,buffered:true});});
  await page.route('**/v1/**',async route=>{const req=route.request(),url=new URL(req.url()),key=url.pathname+url.search;let response=fixture.responses[key];
   if(key==='/v1/4663/share/qualification-missing-record')response={method:'GET',status:404,contentType:'application/json',body:'{"error":"qualification_not_found"}'};
   if(!response||req.method()!==response.method){unknown.push(req.method()+':'+key);return route.fulfill({status:500,contentType:'application/json',body:'{}'});}
   assert.ok(req.method()==='GET'||(req.method()==='POST'&&/\/v1\/radar\/bundles\/(morning-briefing|market-research|talent-market-scanner)\/plan$/.test(key)));
   const token={};pending.add(token);seen.push(key);try{await route.fulfill({status:response.status,contentType:response.contentType,body:response.body});}finally{pending.delete(token);}
  });
  await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort());
  await page.goto(bases[subject]+routePath);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(let i=0;i<50;i++){await page.waitForTimeout(200);if(i>=10&&pending.size===0&&await page.locator('main [aria-busy="true"]').count()===0)break;}
  assert.deepEqual(unknown,[]);assert.equal(pending.size,0);
  if(routePath==='/solana'||(subject==='before'&&routePath.startsWith('/4663/share')))assert.ok((await page.locator('.solana-orientation-summary').innerText()).includes('RECORDED BENCHMARKS'));
  const metrics=await page.evaluate(()=>({heading:document.querySelector('h1')?.textContent,resources:performance.getEntriesByType('resource').filter(e=>/\.(js|css)(\?|$)/.test(e.name)).map(e=>({file:new URL(e.name).pathname.split('/').pop(),encoded_body_bytes:e.encodedBodySize,transfer_bytes:e.transferSize,duration_ms:e.duration})),LCP_ms:window.qaLcp.at(-1)?.start??null,CLS:window.qaCls.filter(e=>!e.hadRecentInput).reduce((sum,e)=>sum+e.value,0),long_tasks:window.qaLongTasks}));
  results.push({subject,width,route:routePath,repeat,fixture_requests:seen,...metrics});await context.close();
 }
}finally{await browser.close();}
const output={source_sha:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baseline_sha:'d3d0a445ec20e8c55170c2fc1f52aff220b2a851',fixture_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),method:'Three paired cold anonymous Chromium contexts per route/width, immutable response replay and fixed Date. Shared macOS host; no simulated mobile CPU/network throttling, field p75, INP or real-device claim. Encoded body bytes exclude HTTP headers.',browser_version:browser.version(),results};
fs.writeFileSync('docs/ux-hardening-2026-10-13/evidence/implementation/performance-final.json',JSON.stringify(output,null,2));console.log(results.length,'paired fixture-controlled samples');})().catch(error=>{console.error(error);process.exitCode=1});

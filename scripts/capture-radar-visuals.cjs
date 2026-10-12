/* Deterministic review candidates; never overwrite or auto-approve a baseline. */
const fs=require('node:fs');const path=require('node:path');const {createRequire}=require('node:module');
const runtime=createRequire(path.join(process.env.RADAR_UI_TEST_RUNTIME||'/tmp/radar-ui-qualification','package.json'));const {chromium}=runtime('playwright');
const base=process.env.RADAR_UI_BASE_URL||'http://127.0.0.1:5182';const out='docs/design-system/recovery/visual-candidates';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();const views=[];
for(const route of ['/','/solana','/spend-terminal','/receipts/judgment_visual_missing','/receipts/receipt_visual_missing','/rh-chain-signal-desk','/routes','/loops','/developers'])for(const width of [390,1440]){
 const c=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC',colorScheme:'dark'});const p=await c.newPage();
 await p.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
 await p.route('**/v1/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'visual_fixture_evidence_unavailable'})}));
 await p.goto(base+route);await p.waitForTimeout(1200);await p.evaluate(()=>document.fonts.ready);
 if(route==='/') { await p.locator('h1').click();await p.locator('.product-menu-toggle').evaluate(e=>e.blur()); }
 const name=(route==='/'?'home':route.slice(1).replaceAll('/','-'))+'-'+width+'.png';await p.screenshot({path:path.join(out,name),fullPage:true});
 if(route==='/'&&width===390){await p.locator('.product-menu-toggle').click();await p.screenshot({path:path.join(out,'mobile-navigation.png'),fullPage:true});}
 views.push({route,width,file:name,state:'No check run; GET evidence unavailable (controlled 503), no fabricated records'});await c.close();
}await browser.close();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({status:'REVIEW_REQUIRED',fixture:'All API responses controlled; fixed time; system fonts; reduced motion; Chromium',views},null,2));console.log(`${views.length} deterministic screenshots awaiting human review.`);})();

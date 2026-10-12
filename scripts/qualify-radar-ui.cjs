/* Run against a local qualification server. Dependencies stay outside production.
   RADAR_UI_TEST_RUNTIME=/path/to/test-runtime node scripts/qualify-radar-ui.cjs
   Runtime packages: playwright, @axe-core/playwright, randexp. */
const fs=require('node:fs');const path=require('node:path');const {createRequire}=require('node:module');
const runtime=createRequire(path.join(process.env.RADAR_UI_TEST_RUNTIME||'/tmp/radar-ui-qualification','package.json'));
const {chromium,webkit}=runtime('playwright');const AxeBuilder=runtime('@axe-core/playwright').default;const RandExp=runtime('randexp');
const base=process.env.RADAR_UI_BASE_URL||'http://127.0.0.1:5178';
const output=path.resolve(process.env.RADAR_UI_OUTPUT || 'docs/design-system/recovery/evidence');fs.mkdirSync(output,{recursive:true});
const patterns=JSON.parse(fs.readFileSync('docs/design-system/route-patterns.json','utf8'));
let seed=142; const random=(a,b)=>{seed=(seed*1664525+1013904223)>>>0;return a+seed%(b-a+1)};
const routes=new Set(['/','/4663','/solana','/spend-terminal','/routes','/providers','/services','/receipts','/routes/route_pay_sh_market_research_01','/providers/provider_pay_sh_lattice','/services/service_market_research','/receipts/receipt_001','/check/monitor','/signals/ansem','/signals/black-bull','/signals/troll','/4663/proof/0x1111111111111111111111111111111111111111']);
for(const {pattern} of patterns){let source=pattern.slice(1,pattern.lastIndexOf('/')).replaceAll('[^/]+','qualification-missing-record').replaceAll('\\d{4}-\\d{2}-\\d{2}','2026-10-12').replaceAll('0x[0-9a-fA-F]{40}','0x1111111111111111111111111111111111111111');const generator=new RandExp(new RegExp(source));generator.max=1;generator.randInt=random;for(let i=0;i<100;i++){const p=generator.gen().replace(/\/$/,'')||'/';if(p.length<240)routes.add(p);}}
const paths=[...routes].sort();fs.writeFileSync(path.join(output,'route-samples.json'),JSON.stringify(paths,null,2));
const widths=[320,375,390,430,768,1024,1440];
const representative=new Set(['/','/4663','/solana','/spend-terminal','/routes','/receipts/receipt_001','/loops','/graph','/machine-market','/4663','/4663/reflexive','/4663/reflexive/preflight/ipx-pltr']);
async function qualify(browserType,label,selected,parallel=4){
 const browser=await browserType.launch({timeout:20000}); const results=[];let cursor=0;
 async function worker(){while(cursor<selected.length){const route=selected[cursor++];const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce',isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1500);
 if(route !== '/') await page.locator('.radar-specialized-nav').evaluate(el=>el.open=true);
 const identity=await page.evaluate(()=>({headers:document.querySelectorAll('.product-header').length,footers:document.querySelectorAll('.radar-home-footer').length,signal:getComputedStyle(document.documentElement).getPropertyValue('--signal-action').trim(),headline:document.querySelector('h1')?.textContent}));
 const layouts=[];for(const width of widths){await page.setViewportSize({width,height:width<768?812:1000});await page.waitForTimeout(60);const layout=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,mains:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+3).slice(0,6).map(e=>({tag:e.tagName,class:e.className}))}));layouts.push({width,...layout});if(representative.has(route)&&[375,768,1440].includes(width))await page.screenshot({path:path.join(output,`${label}-${route==='/'?'home':route.slice(1).replaceAll('/','-')}-${width}.png`),fullPage:true});}
 await page.setViewportSize({width:375,height:812});
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 const menu=page.locator('.product-menu-toggle');let menuCheck=false;
 if(await menu.isVisible()){await menu.click();menuCheck=await page.locator('.product-wayfinding').isVisible();await page.keyboard.press('Escape');menuCheck=menuCheck&&!await page.locator('.product-wayfinding').isVisible();}
 results.push({route,identity,layouts,menuCheck,errors,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
 }catch(error){results.push({route,failure:String(error),errors});}finally{await context.close();}
 if(results.length%20===0)console.log(`${label}: ${results.length}/${selected.length} routes rendered`);
 }}await Promise.all(Array.from({length:parallel},worker));await browser.close();results.sort((a,b)=>a.route.localeCompare(b.route));fs.writeFileSync(path.join(output,`${label}-qualification.json`),JSON.stringify(results,null,2));return results;
}
(async()=>{console.log(`Inventory: ${paths.length} concrete route/alias/detail examples from ${patterns.length} router patterns`);const selected=process.env.RADAR_UI_ROUTES ? process.env.RADAR_UI_ROUTES.split(',') : paths;const c=await qualify(chromium,process.env.RADAR_UI_RUN_LABEL||'chromium',selected);const w=(process.env.RADAR_UI_BROWSERS || 'chromium').includes('webkit') ? await qualify(webkit,'webkit',[...representative],2) : [];const failures=[...c,...w].filter(r=>r.failure||r.identity?.headers!==1||r.identity?.footers!==1||r.identity?.signal!=='#00eee4'||r.errors?.length||r.layouts?.some(x=>x.scroll>x.client+2)||r.violations?.length||!r.menuCheck);console.log(JSON.stringify({chromium:c.length,webkit:w.length,failures:failures.map(r=>({route:r.route,fail:r.failure,errors:r.errors,overflow:r.layouts?.filter(x=>x.scroll>x.client+2),axe:r.violations?.map(x=>x.id)}))},null,2));process.exitCode=failures.length?1:0;})();

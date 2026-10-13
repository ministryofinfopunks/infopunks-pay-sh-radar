const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const label = process.env.UX_LABEL || 'before';
const base = process.env.UX_BASE || 'http://127.0.0.1:5183';
const out = path.resolve('docs/ux-hardening-2026-10-13/evidence/implementation', label);
fs.mkdirSync(out, { recursive: true });
const routes = ['/spend-terminal?subject=route_pay_sh_market_research_01','/solana','/4663/share/qualification-missing-record','/signals/qualification-missing-record','/4663/reflexive/pair/qualification-missing-record','/attention-market-watch/qualification-missing-record','/rh-chain-signal-desk/projects','/4663/campaign/qualification-missing-record','/routes','/developers','/narratives/robinhood-chain','/proof/execution/ui_int2_pending_execution','/proof/evaluation/ui_int2_evaluation'];
(async () => {
 const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
 const results = []; const performance = [];
 for (const width of [390,1440]) {
  for (let i = 0; i < routes.length; i++) {
   const context = await browser.newContext({ viewport: {width,height:900}, reducedMotion:'reduce', locale:'en-US',timezoneId:'Asia/Colombo' });
   const page = await context.newPage();
   await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort());
   await page.goto(base + routes[i]); await page.waitForTimeout(5000);
   if (i === 0) { await page.locator('form').dispatchEvent('submit'); }
   if (i === 1) await page.locator('#semantic-search-input').fill('unsubmitted query');
   if (routes[i].startsWith('/proof/')) { await page.getByLabel('Tenant access key', { exact: true }).fill('radar-ci-tenant-a-static-not-secret'); await page.getByRole('button', {name:'Inspect receipt',exact:true}).click(); await page.waitForTimeout(500); }
   const state = await page.evaluate(() => ({text:document.querySelector('main')?.innerText,h1:[...document.querySelectorAll('h1')].map(e=>e.textContent),banner:document.querySelectorAll('[role=banner],body header:not(main header):not(article header):not(section header)').length,overflow:document.documentElement.scrollWidth>innerWidth,focus:document.activeElement?.id}));
   await page.screenshot({path:path.join(out,`${String(i+1).padStart(2,'0')}-${width}.png`)});
   fs.writeFileSync(path.join(out,`${String(i+1).padStart(2,'0')}-${width}.txt`), await page.locator('body').innerText());
   results.push({route:routes[i],width,...state}); await context.close();
  }
  for (const route of ['/solana','/4663/share/qualification-missing-record','/spend-terminal','/']) for (let repeat=0;repeat<3;repeat++) {
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}); const page=await context.newPage();
   await page.addInitScript(()=>{window.uxLongTasks=[];window.uxLcp=[];window.uxCls=[]; for(const [type,key] of [['longtask','uxLongTasks'],['largest-contentful-paint','uxLcp'],['layout-shift','uxCls']]) new PerformanceObserver(list=>window[key].push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration,value:e.value,hadRecentInput:e.hadRecentInput})))).observe({type,buffered:true});});
   await page.goto(base+route);await page.waitForTimeout(5000);
   performance.push({route,width,repeat,...await page.evaluate(()=>({resources:performance.getEntriesByType('resource').filter(e=>/\.(js|css)/.test(e.name)).map(e=>({name:e.name.split('/').pop(),bytes:e.encodedBodySize,duration:e.duration})),longTasks:window.uxLongTasks,lcp:window.uxLcp.at(-1)?.start,cls:window.uxCls.filter(e=>!e.hadRecentInput).reduce((s,e)=>s+e.value,0)}))});await context.close();
  }
 }
 await browser.close();fs.writeFileSync(path.join(out,'states.json'),JSON.stringify(results,null,2));fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(performance,null,2));console.log(label,results.length,'captures',performance.length,'cold navigations');
})().catch(error=>{console.error(error);process.exitCode=1});

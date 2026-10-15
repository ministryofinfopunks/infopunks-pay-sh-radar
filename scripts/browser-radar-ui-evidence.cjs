const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.RADAR_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.RADAR_UI_BASE_URL || 'http://127.0.0.1:5173';
const root = path.resolve(process.env.RADAR_UI_EVIDENCE_DIR || 'docs/ui-unification/evidence');
const phase = process.argv[2] || 'before';
const routes = [['homepage','/'],['solana','/solana'],['robinhood','/rh-chain-signal-desk']];
const responses = {};
const widths = [360,375,390,768,1024,1280,1440,1920];
function write(name,value){fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');}
(async()=>{
 fs.mkdirSync(root,{recursive:true});
 const browser = await chromium.launch({headless:true,executablePath: process.env.RADAR_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 write(`${phase}-capture-metadata.json`,{phase,capturedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBranch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),browserVersion:await browser.version(),base,viewportSizes:{desktop:[1440,1000],mobile:[390,844]},reducedMotion:'reduce',fixtureApiReplay:phase==='after'&&fs.existsSync(path.join(root,'before-api-responses.json')),qualification:'Local development fixture-backed UI only; no production or manual screen-reader qualification'});
 const context = await browser.newContext({reducedMotion:'reduce', colorScheme:'dark',viewport:{width:1440,height:1000}});
 const page = await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 page.on('response', async response=> { if(response.url().startsWith(base+'/v1/') && response.request().method()==='GET'){try {responses[new URL(response.url()).pathname+new URL(response.url()).search] = {status:response.status(), body:await response.text(),contentType:response.headers()['content-type']};}catch{}}});
 if (phase==='after' && fs.existsSync(path.join(root,'before-api-responses.json'))) {
  const captured=JSON.parse(fs.readFileSync(path.join(root,'before-api-responses.json'),'utf8'));
  await page.route('**/v1/**',route=>{const u=new URL(route.request().url());const response=captured[u.pathname+u.search];return response&&route.request().method()==='GET'? route.fulfill({status:response.status,contentType:response.contentType,body:response.body}):route.continue();});
 }
 const results=[];
 for(const [name,route] of routes){
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+route,{waitUntil:'networkidle',timeout:60000});
  await page.locator('h1').first().waitFor({timeout:60000});
  await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(1000);
  const inventory=await page.evaluate(()=>({title:document.title,text:document.body.innerText,headings:[...document.querySelectorAll('h1,h2,h3,h4')].map(e=>({level:e.tagName,text:e.textContent.trim()})),links:[...document.querySelectorAll('a[href]')].map(e=>({text:e.textContent.trim(),href:e.getAttribute('href'),target:e.getAttribute('target')})),controls:[...document.querySelectorAll('input,textarea,select,button,summary')].map(e=>({tag:e.tagName,text:e.textContent?.trim(),id:e.id,type:e.getAttribute('type'),name:e.getAttribute('name'),label:e.getAttribute('aria-label'),pressed:e.getAttribute('aria-pressed'),expanded:e.getAttribute('aria-expanded'),disabled:e.disabled})),landmarks:[...document.querySelectorAll('main,nav,header,footer,aside')].map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')}))}));
  write(`${phase}-${name}-inventory.json`,inventory);
  for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewportSize({width,height}); await page.waitForTimeout(350);
   await page.screenshot({path:path.join(root,`${phase}-${name}-${label}.png`),fullPage:true,animations:'disabled'});
   await page.screenshot({path:path.join(root,`${phase}-${name}-${label}-viewport.png`),animations:'disabled'});
  }
  for(const width of widths){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);const measure=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='fixed').slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,text:e.textContent?.trim().slice(0,70)}))}));results.push({route,width,...measure});}
  console.log(name+' captured');
 }
 write(`${phase}-viewport-results.json`,results);write(`${phase}-api-responses.json`,responses);write(`${phase}-page-errors.json`,errors);if(errors.length||results.some(x=>x.document>x.viewport+1))process.exitCode=1;
 await browser.close();console.log(JSON.stringify({phase,errors,overflow:results.filter(x=>x.document>x.viewport+1)}));
})().catch(e=>{console.error(e);process.exitCode=1;});

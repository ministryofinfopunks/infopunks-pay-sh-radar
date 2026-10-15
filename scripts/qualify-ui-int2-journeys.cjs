// Local, disposable fixtures only. Exercises real API responses; no payment capability.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const ids=JSON.parse(fs.readFileSync('docs/design-system/ui-int2/evidence/fixture-identifiers.json'));
const owner='radar-ci-tenant-a-static-not-secret',other='radar-ci-tenant-b-static-not-secret';
const base=process.env.RADAR_UI_BASE_URL||'http://127.0.0.1:5183';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('local_only');
const out='docs/design-system/ui-int2/evidence/journeys';fs.mkdirSync(out,{recursive:true});
const reports=[];const record=(name,result)=>{reports.push({name,...result});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({source_sha:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:'SYNTHETIC_LOCAL_AUTHORIZED_FIXTURE; real PostgreSQL/API; payments disabled',reports},null,2));};
(async()=>{const browser=await chromium.launch({executablePath:process.env.RADAR_QA_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
await page.goto(base);await page.getByRole('heading',{name:'Before your agent spends, check the evidence.'}).waitFor();
assert.match(await page.locator('#judgment-preview').innerText(),/NO CHECK RUN/);
await page.locator('#judgment-preview details').first().locator('summary').click();
assert.equal(await page.locator('#judgment-preview details').first().evaluate(e=>e.open),true);
await page.locator('#home-route').fill('route_pay_sh_market_research_01');await page.getByRole('button',{name:'Run Spend Check'}).click();
assert.equal(await page.getByLabel('Subject or route identifier').inputValue(),'route_pay_sh_market_research_01');record('anonymous_home_to_spend_deep_link',{pass:true,evidence_expansion:true});
await page.getByLabel('Tenant access key').fill(owner);await page.getByRole('button',{name:'Run a Check'}).click();await page.getByRole('heading',{name:'Insufficient evidence',exact:true}).waitFor();
const result=await page.locator('.spend-result').innerText();assert.match(result,/Free assessment · no canonical receipt/);assert.match(result,/Execution: not authorized. Outcome: not verified/);
await page.screenshot({path:path.join(out,'mobile-insufficient-evidence.png'),fullPage:true});record('real_pre_spend_insufficient_evidence',{pass:true,no_receipt:true,no_execution:true});
await page.goto(base+'/routes');await page.getByLabel(/^service type/).waitFor();await page.getByLabel(/^sort/).selectOption('risk');record('route_filter_and_sort',{pass:true,sort:await page.getByLabel(/^sort/).inputValue()});
await page.goto(base+'/solana');await page.getByLabel('Search Pay.sh ecosystem intelligence').waitFor();await page.getByLabel('Search Pay.sh ecosystem intelligence').fill('market research');const searched=page.waitForResponse(r=>new URL(r.url()).pathname==='/v1/search');await page.locator('.semantic-search-form').getByRole('button',{name:'Search',exact:true}).click();const searchResponse=await searched;assert.equal(searchResponse.status(),200);record('service_route_search',{pass:true,status:searchResponse.status(),actual_backend:true});
for(const [kind,id] of [['judgment',ids.judgment],['execution',ids.pendingExecution],['evaluation',ids.evaluation]]){
await page.goto(base+`/proof/${kind}/${id}`);await page.getByLabel('Tenant access key').fill(owner);
const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/v1/receipt-spine/${kind}/${id}`);await page.getByRole('button',{name:'Inspect receipt',exact:true}).click();const status=(await response).status();assert.equal(status,200);await page.locator('details summary').filter({hasText:'Inspect source receipt'}).waitFor();
const text=await page.locator('section[aria-label="Receipt evidence"]').innerText();if(kind==='judgment'){assert.match(text,/Issuer signature and ancestry verified/);assert.match(text,/Execution authorization remains separate/);}if(kind==='execution')assert.match(text,/pending/);
const exposure=await page.evaluate(key=>({url:location.href.includes(key),storage:Object.values(localStorage).some(v=>v.includes(key)),masked:document.querySelector('input[type=password]')!==null}),owner);assert.deepEqual(exposure,{url:false,storage:false,masked:true});
await page.screenshot({path:path.join(out,`mobile-${kind}.png`),fullPage:true});record(`authorized_${kind}_inspection`,{pass:true,status,display:text,credential_exposure:exposure});
if(kind==='judgment'){
await page.getByLabel('Tenant access key').fill(other);assert.equal(await page.locator('details summary').filter({hasText:'Inspect source receipt'}).count(),0);
const deny=page.waitForResponse(r=>new URL(r.url()).pathname===`/v1/receipt-spine/${kind}/${id}`);await page.getByRole('button',{name:'Inspect receipt',exact:true}).click();assert.equal((await deny).status(),404);await page.getByRole('alert').waitFor();assert.equal(await page.locator('details summary').filter({hasText:'Inspect source receipt'}).count(),0);record('private_receipt_cross_tenant_denial',{pass:true,status:404,previous_private_record_cleared:true,message:await page.getByRole('alert').innerText()});
}}
const rhRequests=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/v1/4663'))rhRequests.push(new URL(r.url()).pathname)});
await page.goto(base+'/4663');await page.waitForTimeout(800);assert.equal(rhRequests.some(p=>/\/me(?:\/|$)|\/proof\/|\/pulse\/reputation/.test(p)),false);record('anonymous_robinhood_read_only',{pass:true,private_requests:[],heading:await page.locator('h1').innerText()});
await page.locator('.product-menu-toggle').click();assert.equal(await page.locator('.product-wayfinding').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.product-wayfinding').isVisible(),false);record('mobile_navigation_and_evidence',{pass:true,escape_dismisses_menu:true});
await page.close();
assert.equal(reports.some(r=>r.pass===false),false); }finally{await browser.close();}})().catch(e=>{record('qualification_failure',{pass:false,message:String(e)});process.exitCode=1;});

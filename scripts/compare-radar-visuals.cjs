/* Approval manifest is created only by an explicit human baseline-review action. */
const fs=require('node:fs');const path=require('node:path');const {createRequire}=require('node:module');
const baseline='docs/design-system/references/approved-routes';const manifest=path.join(baseline,'approval.json');
if(!fs.existsSync(manifest)){console.error('HOLD: homepage and route candidates require human approval; no baseline will be generated automatically.');process.exit(2);}
const approved=JSON.parse(fs.readFileSync(manifest,'utf8'));if(!approved.reviewer||!approved.reviewedAt||!approved.files?.length)throw Error('Human baseline approval metadata required');
const runtime=createRequire(path.join(process.env.RADAR_UI_TEST_RUNTIME||'/tmp/radar-ui-qualification','package.json'));const {PNG}=runtime('pngjs');
let failed=0;for(const file of approved.files){const a=PNG.sync.read(fs.readFileSync(path.join(baseline,file)));const b=PNG.sync.read(fs.readFileSync(path.join('docs/design-system/recovery/visual-candidates',file)));if(a.width!==b.width||a.height!==b.height){console.error(file,'dimensions changed');failed++;continue;}let changed=0;for(let i=0;i<a.data.length;i+=4)if(Math.max(...[0,1,2].map(j=>Math.abs(a.data[i+j]-b.data[i+j])))>24)changed++;const fraction=changed/(a.width*a.height);if(fraction>0.005){console.error(file,`${(fraction*100).toFixed(2)}% pixels changed; review required`);failed++;}}
process.exitCode=failed?1:0;

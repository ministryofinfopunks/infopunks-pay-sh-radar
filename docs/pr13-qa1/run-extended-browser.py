import os,json,subprocess,time,hashlib,shutil,signal
from pathlib import Path
r=Path('/tmp/radar-pr13-qa1');o=r/'docs/pr13-qa1';node=Path(json.loads((r/'docs/ui-unification/validation/resumed-runtime.json').read_text())['node']);snap=Path('/tmp/radar-pr13-qa1-browser');snap.mkdir(exist_ok=True)
subprocess.run(['git','archive','HEAD'],cwd=r,stdout=open('/tmp/radar-pr13-qa1-browser.tar','wb'),check=True);subprocess.run(['tar','xf','/tmp/radar-pr13-qa1-browser.tar','-C',str(snap)],check=True)
(snap/'.git').unlink(missing_ok=True);(snap/'node_modules').unlink(missing_ok=True)
(snap/'.git').symlink_to(subprocess.check_output(['git','rev-parse','--absolute-git-dir'],cwd=r,text=True).strip(),target_is_directory=True);(snap/'node_modules').symlink_to(r/'node_modules',target_is_directory=True)
shutil.copyfile(r/'docs/design-system/ui-int2/evidence/fixture-identifiers.json',snap/'docs/design-system/ui-int2/evidence/fixture-identifiers.json')
env={k:os.environ[k] for k in ('HOME','USER','TMPDIR','LANG') if k in os.environ};env['PATH']=str(node.parent)+':/opt/homebrew/bin:/usr/bin:/bin'
env.update(NODE_ENV='development',PORT='8819',DATABASE_URL='postgresql://postgres@127.0.0.1:55441/ui_int2_browser',PAYSH_CATALOG_SOURCE='fixture',PAYSH_ALLOW_FIXTURE_FALLBACK='true',PAYSH_BOOTSTRAP_ENABLED='false',INGESTION_ENABLED='false',MONITOR_ENABLED='false',MONITOR_MODE='disabled',MACHINE_EXECUTION_ENABLED='false',JUDGMENT_PAYMENT_ENABLED='false',RH_CHAIN_AUTOMATION_ENABLED='false',RH_CHAIN_MARKET_INGESTION_ENABLED='false',RH_4663_PHASE2_ENABLED='false',RH_4663_PHASE3_ENABLED='false',IPX_PLTR_SHADOW_OBSERVATION_ENABLED='false',IPX_PLTR_SHADOW_CAPACITY_SWEEP_ENABLED='false',MACHINE_RECEIPTS_JSONL_PATH='/tmp/radar-pr13-qa1-machine.jsonl')
keys=[]
for tenant,agent,key,expired in [('tenant-a','radar-browser','radar-ci-tenant-a-static-not-secret',False),('tenant-b','radar-browser','radar-ci-tenant-b-static-not-secret',False),('tenant-a','other-agent','radar-ci-wrong-agent-static-not-secret',False),('tenant-a','radar-browser','radar-ci-expired-key-static-not-secret',True)]:
 entry=dict(tenant_id=tenant,agent_id=agent,key_sha256=hashlib.sha256(key.encode()).hexdigest())
 if expired:entry['expires_at']='2020-01-01T00:00:00Z'
 keys.append(entry)
env['JUDGMENT_API_KEYS_JSON']=json.dumps(keys)
issuer=json.loads((r/'output/ui-int2/local-issuer.json').read_text());env.update(JUDGMENT_ISSUER=issuer['issuer'],JUDGMENT_ISSUER_KEYS_JSON=json.dumps(issuer['keys']),JUDGMENT_SIGNING_KEY_ID=issuer['activeKeyId'],JUDGMENT_SIGNING_PRIVATE_KEY=issuer['privateKeyPem'])
records=[]
def run(name,cmd,overrides={}):
 e=dict(env);e.update(overrides);t=time.monotonic()
 with (o/'logs'/(name+'.log')).open('w') as f:p=subprocess.run(cmd,cwd=snap,env=e,stdout=f,stderr=subprocess.STDOUT)
 records.append(dict(name=name,command=cmd,environment_overrides=overrides,exit_code=p.returncode,seconds=round(time.monotonic()-t,3),cwd=str(snap),log='logs/'+name+'.log'))
 (o/'extended-browser-checks.json').write_text(json.dumps(dict(source_sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip(),scope='Isolated archive with final compiled source, local synthetic API, all payments/execution/jobs disabled; no approved baseline writes',checks=records),indent=2)+'\n');print(name,p.returncode,flush=True)
server=subprocess.Popen([str(node),'/tmp/radar-pr13-qa1-local-server.mjs'],cwd=r,env=env,stdout=open(o/'logs/server.log','w'),stderr=subprocess.STDOUT)
try:
 import urllib.request
 for _ in range(100):
  try:urllib.request.urlopen('http://127.0.0.1:8819/health');break
  except Exception:time.sleep(.3)
 else:raise Exception('server_not_ready')
 common=dict(RADAR_UI_BASE_URL='http://127.0.0.1:8819',RADAR_QA_URL='http://127.0.0.1:8819',RADAR_QA_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',RADAR_UI_TEST_RUNTIME='/tmp/radar-pr13-qa1-tools',RADAR_QA_TENANT_KEY='radar-ci-tenant-a-static-not-secret',RADAR_QA_OTHER_TENANT_KEY='radar-ci-tenant-b-static-not-secret',RADAR_QA_WRONG_AGENT_KEY='radar-ci-wrong-agent-static-not-secret',RADAR_QA_EXPIRED_KEY='radar-ci-expired-key-static-not-secret')
 # Browser regression uses actual page DOM and the original inherited selector, then scopes it.
 # run('search-selector-regression',[str(node),str(o/'search-selector-regression.cjs')],common)
 # run('journeys',[str(node),'scripts/qualify-ui-int2-journeys.cjs'],common)
 # shutil.copytree(snap/'docs/design-system/ui-int2/evidence/journeys',o/'journeys',dirs_exist_ok=True)
 run('full-routes',[str(node),'scripts/qualify-ui-int2-routes.cjs'],dict(common,RADAR_UI_OUTPUT=str(o/'full-routes')))
 # run('unified-browser',[str(node),'scripts/qualify-unified-radar-browser.mjs'],dict(common,RADAR_QA_OUTPUT_DIR=str(o/'unified-browser')))
 # run('accessibility',[str(node),'scripts/browser-radar-ui-accessibility.cjs','after'],dict(common,RADAR_UI_EVIDENCE_DIR=str(o/'accessibility')))
 # run('native-zoom',[str(node),'scripts/browser-radar-ui-zoom.cjs','after'],dict(common,RADAR_UI_EVIDENCE_DIR=str(o/'native-zoom')))
 run('webkit-availability',[str(node),'-e',"require('playwright').webkit.launch().then(b=>b.close()).catch(e=>{console.error(e);process.exitCode=1})"],common)
 # run('approved-comparison',[str(node),'scripts/compare-ui-int2-visuals.cjs'],common)
 # shutil.copytree(snap/'docs/design-system/ui-int2/evidence/visual-comparison',o/'visual-comparison',dirs_exist_ok=True)
finally:
 server.terminate()
 try:server.wait(timeout=15)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 (o/'extended-browser-cleanup.json').write_text(json.dumps(dict(server_pid=server.pid,server_exit=server.returncode,stopped=True,scope='Only QA1-owned 127.0.0.1:8819 server stopped; original preview untouched'),indent=2))

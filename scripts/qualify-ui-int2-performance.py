"""Sequential lab runs, with pinned external Lighthouse; no field CWV claims."""
import gzip,json,os,subprocess
from pathlib import Path
root=Path.cwd();out=root/'docs/design-system/ui-int2/evidence/performance';out.mkdir(parents=True,exist_ok=True)
node=os.environ.get('RADAR_QA_NODE','/Users/ahdilm/.npm/_npx/538786c08bcb9442/node_modules/node/bin/node')
lighthouse=os.environ.get('RADAR_QA_LIGHTHOUSE','/tmp/radar-ui-int2-qa/node_modules/lighthouse/cli/index.js')
env=dict(os.environ,CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');runs=[]
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
for label,port in [('target',5184),('candidate',5183)]:
 for page,route,desktop in [('homepage-mobile','/',False),('homepage-desktop','/',True),('spend-mobile','/spend-terminal',False)]:
  name=label+'-'+page;report=out/(name+'.json');args=[node,lighthouse,f'http://127.0.0.1:{port}{route}','--chrome-flags=--headless --no-sandbox','--only-categories=performance,accessibility,best-practices','--output=json','--output-path='+str(report),'--quiet']
  if desktop:args+=['--preset=desktop']
  subprocess.run(args,env=env,check=True,timeout=120)
  data=json.loads(report.read_text());a=data['audits'];runs.append({'baseline':label,'page':page,'LCP_ms':a['largest-contentful-paint']['numericValue'],'TBT_ms':a['total-blocking-time']['numericValue'],'CLS':a['cumulative-layout-shift']['numericValue'],'performance':data['categories']['performance']['score']*100,'accessibility':data['categories']['accessibility']['score']*100,'fetch_time':data['fetchTime'],'lighthouse_version':data['lighthouseVersion'],'environment':data['environment']});print(name,runs[-1]['LCP_ms'],flush=True)
  (out/'summary.json').write_text(json.dumps({'source_sha':sha,'target_sha':'4bcaf5731cdadf1d5229ab93faea3a90fa9b17de','scope':'Sequential localhost Lighthouse laboratory; default simulated mobile throttling or desktop preset; one run per journey/viewport. No real-user p75 data. TBT is a responsiveness proxy, NOT INP.','runs':runs},indent=2)+'\n')
bundles={}
for label,folder in [('target','output/ui-int2/target-client'),('candidate','dist/client')]:
 bundles[label]=[{'file':p.name,'bytes':p.stat().st_size,'gzip_bytes':len(gzip.compress(p.read_bytes()))}for p in sorted((root/folder/'assets').glob('*')) if p.suffix in ['.js','.css']]
(out/'bundles.json').write_text(json.dumps(bundles,indent=2)+'\n')

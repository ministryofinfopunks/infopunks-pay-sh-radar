"""PR13-QA1 local checks; never reads project .env or uses remote databases."""
import os,json,subprocess,time,hashlib,platform
from pathlib import Path
root=Path('/tmp/radar-pr13-qa1');os.chdir(root)
out=root/'docs/pr13-qa1'; logs=out/'logs';logs.mkdir(exist_ok=True)
node=Path(json.loads((root/'docs/ui-unification/validation/resumed-runtime.json').read_text())['node']);pg=Path('/opt/homebrew/opt/postgresql@16/bin')
env={k:os.environ[k] for k in ('HOME','USER','TMPDIR','LANG') if k in os.environ}
env['PATH']=str(node.parent)+':'+str(pg)+':/opt/homebrew/bin:/usr/bin:/bin';env['NODE_ENV']='test'
records=[]
def run(name,args,extra=None):
 t=time.monotonic(); e=dict(env);e.update(extra or {})
 with (logs/(name+'.log')).open('w') as f: p=subprocess.run(args,env=e,stdout=f,stderr=subprocess.STDOUT)
 records.append(dict(name=name,command=args,environment_overrides=extra or {},exit_code=p.returncode,seconds=round(time.monotonic()-t,3),log='logs/'+name+'.log'))
 (out/'checks.json').write_text(json.dumps(dict(source_sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),checks=records),indent=2)+'\n');print(name,p.returncode,flush=True);return p.returncode
(out/'runtime.json').write_text(json.dumps(dict(node=str(node),node_sha256=hashlib.sha256(node.read_bytes()).hexdigest(),platform=platform.platform(),environment='Allowlisted process environment; no .env loaded; synthetic local PostgreSQL only',dependencies='Existing exact-lock node_modules linked from original workspace; npm ls validation recorded'),indent=2))
run('runtime',['node','--version']);run('dependencies',['npm','ls','--depth=0']);run('pg-init',[str(pg/'initdb'),'-D','/tmp/radar-pr13-qa1-pg','-U','postgres','-A','trust','--no-locale'])
run('pg-start',[str(pg/'pg_ctl'),'-D','/tmp/radar-pr13-qa1-pg','-l','/tmp/radar-pr13-qa1-pg.log','-o','-h 127.0.0.1 -p 55441 -k /tmp','-w','start'])
for db in ['pr13_qa1','pr13_qa1_resilience','ui_int2_browser']:run('db-'+db,[str(pg/'createdb'),'-h','127.0.0.1','-p','55441','-U','postgres',db])
for name,cmd in [('lint',['npm','run','lint']),('typecheck',['npm','run','typecheck']),('build',['npm','run','build']),('design',['npm','run','check:design']),('migration-inventory',['npm','run','migrations:validate'])]:run(name,cmd)
db='postgresql://postgres@127.0.0.1:55441/'
run('full-tests',['npm','test','--','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile.json=docs/pr13-qa1/full-tests.json'],dict(CANONICAL_RECEIPT_TEST_URL=db+'pr13_qa1',ECONOMIC_ENGINE_TEST_URL=db+'pr13_qa1',POSTGRES_RESILIENCE_TEST_URL=db+'pr13_qa1_resilience',RADAR_QUERY_TIMING_ENABLED='true'))
run('boundary',['node','scripts/verify-radar-subpage-boundary.cjs'],dict(RADAR_UI_BOUNDARY_OUTPUT=str(out/'boundary.json')))
run('static-audit',['python3','/Users/ahdilm/.codex/plugins/cache/openai-curated-remote/frontend-design-premium/1.4.0/skills/frontend-design-premium/scripts/audit_project.py','--mode','strict','--output',str(out/'static-audit.json'),str(root)])
run('audit-production',['npm','audit','--omit=dev','--json']);run('audit-all',['npm','audit','--json'])
run('browser-migrations',['node','dist/server/cli/runPostgresMigrations.js'],dict(DATABASE_URL='postgresql://postgres@localhost:55441/ui_int2_browser'))
(root/'output/ui-int2').mkdir(parents=True,exist_ok=True)
run('browser-seed',['node','--import','tsx','scripts/ui-int2-seed-fixtures.ts'],dict(UI_INT2_FIXTURE_DATABASE_URL='postgresql://postgres@localhost:55441/ui_int2_browser'))

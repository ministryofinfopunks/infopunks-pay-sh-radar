"""Verify frozen evidence and qualified source, stop only QA1-owned services, record state."""
from pathlib import Path
import json,subprocess,hashlib,os,signal,socket,time
r=Path('/tmp/radar-pr13-qa1');o=r/'docs/pr13-qa1';h=lambda b:hashlib.sha256(b).hexdigest();changes=[]
for key,filename in [('source','qualified-source-manifest.json'),('frozen_evidence','frozen-artifact-manifest.json')]:
 d=json.loads((o/filename).read_text());items=d['files'].items() if isinstance(d['files'],dict) else [(x['path'],x['sha256']) for x in d['files']]
 checked=0;bad=[]
 for p,sha in items:
  checked+=1
  if not (r/p).exists() or h((r/p).read_bytes())!=sha:bad.append(p)
 changes.append(dict(scope=key,checked=checked,mismatches=bad))
assert all(not x['mismatches'] for x in changes),changes
# A generated signing fixture must never appear in the review packet.
issuer=json.loads((r/'output/ui-int2/local-issuer.json').read_text());private=issuer['privateKeyPem'];body=private.strip().splitlines()[1];leaks=[]
for p in o.rglob('*'):
 if p.is_file() and p.suffix in ['.json','.log','.md','.py','.cjs','.mjs','.swift','.csv','.txt']:
  if body in p.read_text(errors='replace'):leaks.append(str(p.relative_to(r)))
assert not leaks
base=json.loads((o/'base-server-process.json').read_text());pid=base['pid'];cmd=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True);assert 'radar-pr13-qa1-base-server-fixed.mjs' in cmd;os.kill(pid,signal.SIGTERM)
pgcmd=['/opt/homebrew/opt/postgresql@16/bin/pg_ctl','-D','/tmp/radar-pr13-qa1-pg','-m','fast','-w','stop'];pgstop=subprocess.run(pgcmd,capture_output=True,text=True);(o/'logs/pg-stop.log').write_text(pgstop.stdout+pgstop.stderr)
def port_open(port):
 with socket.socket() as s:s.settimeout(.4);return s.connect_ex(('127.0.0.1',port))==0
for _ in range(20):
 if not port_open(8820):break
 time.sleep(.1)
state=dict(source_commit='f62f9cbabbe244682adf2cc17d9451f580a7ed1c',frozen_pr='e1b7e7be2f14056c5aed61484b0fb1ba371be4a6',integrity=changes,qualified_tracked_diff=subprocess.check_output(['git','-C',str(r),'diff','HEAD','--name-status'],text=True),original_checkout_head=subprocess.check_output(['git','-C','/Users/ahdilm/Documents/Infopunks Pay.sh Intelligence Terminal','rev-parse','HEAD'],text=True).strip(),original_checkout_status=subprocess.check_output(['git','-C','/Users/ahdilm/Documents/Infopunks Pay.sh Intelligence Terminal','status','--short'],text=True),generated_private_key_material_matches=leaks,base_server_stopped_pid=pid,postgres_stop=dict(command=pgcmd,exit_code=pgstop.returncode,log='logs/pg-stop.log'),owned_ports={str(p):port_open(p) for p in [8819,8820,55441]},preexisting_preview_observation={str(p):port_open(p) for p in [5173,8787,5432]},restrictions=dict(pushed=False,force_pushed=False,merged=False,deployed=False,restricted_staging=False,financial_execution=False,backend_authority_changes=False,approved_reference_updates=False))
assert all(not b for b in state['owned_ports'].values());(o/'final-integrity.json').write_text(json.dumps(state,indent=2)+'\n');print('Final integrity',[(x['scope'],x['checked'],len(x['mismatches'])) for x in changes]);print('Owned service cleanup',state['owned_ports'])
# Preserve exact supplemental invocations not part of the main runner.
(o/'supplemental-commands.json').write_text(json.dumps(dict(commands=[dict(command=['swift','docs/pr13-qa1/scan-screenshot-text.swift'],exit_code=0,log='logs/screenshot-text-scan.log',output='screenshot-text-scan.json'),dict(command=['python3','docs/pr13-qa1/audit-evidence.py'],exit_code=0,output='evidence-triage.json'),dict(command=['python3','docs/pr13-qa1/reconcile.py'],exit_code=0,output='provenance-reconciliation.json'),dict(command=['python3','docs/pr13-qa1/finalize.py'],exit_code=0,output='final-integrity.json')],note='Early reconcile failure from aggregate incomplete-node counts was corrected in packet tooling, not application or original harness; final reports distinguish aggregate counts from per-node targets.'),indent=2)+'\n')

"""Read-only frozen PR inventory, content triage and integrity reconciliation."""
import subprocess,json,hashlib,re,csv,collections,struct
from pathlib import Path
r=Path('/tmp/radar-pr13-qa1');o=r/'docs/pr13-qa1';base='d3d0a445ec20e8c55170c2fc1f52aff220b2a851';head='e1b7e7be2f14056c5aed61484b0fb1ba371be4a6'
def git(*args):return subprocess.check_output(['git','-C',str(r),*args])
def h(b):return hashlib.sha256(b).hexdigest()
changes=[x.split('\t') for x in git('diff','--name-status',base,head).decode().splitlines()];names=[x[-1] for x in changes]
gh=json.loads((o/'github-2.json').read_text())['value']['structuredContent']['filenames'];assert set(names)==set(gh) and len(names)==581
patch=git('diff','--binary',base,head); (o/'diff-summary.json').write_text(json.dumps(dict(base=base,head=head,file_count=len(names),github_inventory_matches=True,complete_patch_sha256=h(patch),patch_bytes=len(patch),commits=git('log','--format=%H %s',base+'..'+head).decode().splitlines()),indent=2))
(o/'PR13-CHANGED-FILES.txt').write_text(git('diff','--name-status',base,head).decode())
rows=[]; groups=collections.defaultdict(list); hits=[];pngs=[];json_errors=[]
patterns={
'private_key_material':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
'provider_token':r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})',
'bearer_literal':r'Bearer\s+[A-Za-z0-9_.-]{16,}',
'credential_url':r'(?:postgres(?:ql)?|https?)://[^\s"\']+:[^\s"\'@]+@',
'email':r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b',
'credential_assignment':r'(?i)(?:password|api[_-]?key|private[_-]?key|secret|authorization|tenant[_-]?id)\s*["\']?\s*[:=]\s*["\'][^"\']{4,}["\']'}
for status,p in changes:
 b=git('show',head+':'+p); sha=h(b);groups[sha].append(p)
 if p.startswith('src/'):category='Runtime changes'
 elif p.startswith(('tests/','scripts/')):category='Tests and validation scripts'
 elif '/attempts/' in p or '/first-pass/' in p or '/baseline/current-main/' in p or '/evidence/cyan-baseline/' in p:category='Redundant or superseded evidence'
 else:category='Required qualification evidence'
 security=p.endswith(('.log','.json','.png')) or 'evidence' in p
 rows.append(dict(status=status,path=p,category=category,security_privacy_inspection=security,size_bytes=len(b),sha256=sha,git_blob=git('rev-parse',head+':'+p).decode().strip()))
 if b.startswith(b'\x89PNG'):
  w,hh=struct.unpack('>II',b[16:24]);pos=8;chunks=[]
  while pos+12<=len(b):
   n=int.from_bytes(b[pos:pos+4],'big');typ=b[pos+4:pos+8].decode('ascii');
   if typ in ['tEXt','zTXt','iTXt','eXIf']:chunks.append(typ)
   pos+=n+12
  pngs.append(dict(path=p,width=w,height=hh,metadata_chunks=chunks));continue
 try:s=b.decode('utf8')
 except UnicodeDecodeError:continue
 if p.endswith('.json'):
  try:json.loads(s)
  except Exception as e:json_errors.append(dict(path=p,error=str(e)))
 for typ,pat in patterns.items():
  for m in re.finditer(pat,s,re.I):
   line=s.count('\n',0,m.start())+1
   # Never copy potential credential values into the report.
   hits.append(dict(path=p,line=line,kind=typ,match_sha256=h(m.group().encode()),context_class='synthetic_or_documentation_candidate' if re.search(r'fixture|synthetic|static-not-secret|example|localhost|127\.0\.0\.1|redact',s[max(0,m.start()-250):m.end()+250],re.I) else 'manual_inspection_required'))
with (o/'PR13-CHANGED-FILES.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
(o/'frozen-artifact-manifest.json').write_text(json.dumps(dict(source=head,base=base,files=rows),indent=2)+'\n')
(o/'evidence-triage.json').write_text(json.dumps(dict(counts=dict(collections.Counter(x['category'] for x in rows)),security_inspection_files=sum(x['security_privacy_inspection'] for x in rows),total_bytes=sum(x['size_bytes'] for x in rows),exact_duplicate_groups=[dict(sha256=sha,paths=paths) for sha,paths in groups.items() if len(paths)>1],pngs=pngs,json_parse_errors=json_errors,content_scan_hits=hits,limitations=['Pattern scan is triage, not proof of no secrets. Pixel content requires independent privacy review. Public market addresses and hashes are not automatically tenant secrets. No evidence deleted or rewritten.']),indent=2)+'\n')
# Bind all source, scripts, tests, config and approved reference bytes, excluding evolving QA packet.
source={p:h(git('show',head+':'+p)) for p in git('ls-tree','-r','--name-only',head).decode().splitlines() if p.startswith(('src/','scripts/','tests/','migrations/','public/','docs/design-system/references/')) or p in ['package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.server.json','DESIGN.md']}
(o/'frozen-source-manifest.json').write_text(json.dumps(dict(source=head,files=source),indent=2)+'\n')
print(json.dumps(dict(counts=dict(collections.Counter(x['category'] for x in rows)),duplicate_groups=sum(len(p)>1 for p in groups.values()),pngs=len(pngs),json_errors=json_errors,hits=dict(collections.Counter(x['kind'] for x in hits))),indent=2))

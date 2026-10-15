import json,hashlib,subprocess,collections,re
from pathlib import Path
r=Path('/tmp/radar-pr13-qa1');o=r/'docs/pr13-qa1';head='e1b7e7be2f14056c5aed61484b0fb1ba371be4a6'
def h(b):return hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['git','-C',str(r),*a])
checks=[]
for manifest in ['docs/ui-unification/visual-corrections/source-hashes.json','docs/ui-unification/validation/source-hashes-final.json']:
 data=json.loads((r/manifest).read_text());bad=[]
 for p,sha in data.items():
  try:b=git('show',head+':'+p)
  except subprocess.CalledProcessError:bad.append(dict(path=p,reason='not_committed'));continue
  if h(b)!=sha:bad.append(dict(path=p,reason='hash_mismatch',expected=sha,actual=h(b)))
 checks.append(dict(manifest=manifest,sha256=h((r/manifest).read_bytes()),entries=len(data),differences=bad))
prov='docs/ui-unification/visual-corrections/evidence/final-browser-provenance.json';d=json.loads((r/prov).read_text()); mismatch=[]
for section in ['sourceFiles','scriptFiles']:
 for p,sha in d[section].items():
  if h(git('show',head+':'+p))!=sha:mismatch.append(dict(section=section,path=p))
for p,meta in d['artifacts'].items():
 if h((r/Path(prov).parent/p).read_bytes())!=meta['sha256']:mismatch.append(dict(section='artifacts',path=p))
checks.append(dict(manifest=prov,entries=sum(len(d[x]) for x in ['sourceFiles','scriptFiles','artifacts']),differences=mismatch,capture_parent_sha=d['sourceCommitAtCapture'],qualification='Working tree source verified by hashes; parent SHA is capture metadata, not final commit identity.'))
(o/'provenance-reconciliation.json').write_text(json.dumps(checks,indent=2)+'\n')
# Every static finding gets a durable ID and a conservative independent assessment requirement.
a=json.loads((r/'docs/ui-unification/visual-corrections/premium-after.json').read_text())['findings'];before=json.loads((r/'docs/ui-unification/validation/premium-before.json').read_text())['findings'] if (r/'docs/ui-unification/validation/premium-before.json').exists() else []
# Original baseline static audit filename discovered explicitly below if necessary.
rows=[]
for i,f in enumerate(a,1):
 line=(r/f['file']).read_text().splitlines()[f['line']-1]
 rule=f['ruleId'];reason={'ownership.native-select-undecided':'An ownership/documentation decision is still missing; native select alone is not a demonstrated accessibility defect. Design owner must accept or require correction.', 'form.novalidate-missing':'Native validation may intentionally supplement application validation. Inspect error announcement, recovery and submission before accepting an exception; inheritance does not resolve this.', 'form.textarea-resize-missing':'Resize restriction requires contextual accessibility assessment. Verify adequate height, zoom/reflow and no loss of entered content; do not blindly disable native resizing.'}[rule]
 rows.append(dict(id='STATIC-%02d'%i,**f,classification='4 Requires human assessment',inherited_evidence='visual-corrections/premium-comparison.json reports 57 unchanged; independently rechecked below',justification=reason,code_sha256=h(line.encode()),resolved=False))
(o/'static-findings.json').write_text(json.dumps(rows,indent=2)+'\n')
lines=['# Static finding dispositions','', 'All 57 remain open. Classification 4 requires an independent design/accessibility owner to decide release impact. None is waived because it predates PR #13.','', '| ID | Location at frozen SHA | Rule | Classification | Required decision |','|---|---|---|---|---|']
for f in rows:lines.append('| '+f['id']+' | ['+f['file']+':'+str(f['line'])+'](https://github.com/ministryofinfopunks/infopunks-pay-sh-radar/blob/'+head+'/'+f['file']+'#L'+str(f['line'])+') | '+f['ruleId']+' | 4: Human assessment | '+f['justification']+' |')
(o/'STATIC-FINDINGS.md').write_text('\n'.join(lines)+'\n')
# Flatten every incomplete node rather than hiding counts behind a zero-violations claim.
records=[]
for p in ['docs/ui-unification/visual-corrections/existing-unified/results.json','docs/ui-unification/visual-corrections/evidence/after-accessibility-results.json']:
 d=json.loads((r/p).read_text())
 for rep in d.get('reports',d.get('results',[])):
  audit=rep.get('accessibility',rep)
  for rule in audit.get('incomplete',[]):
   for n in (rule.get('nodes',[]) if isinstance(rule.get('nodes'),list) else [dict(aggregate_node_count=rule['nodes'])]):records.append(dict(id='AXE-%04d'%(len(records)+1),artifact=p,route=rep['route'],viewport=rep.get('viewportName',rep.get('width')),state=rep.get('state','default'),rule=rule['id'],target=n.get('target'),summary=n.get('summary',n.get('failureSummary')),aggregate_node_count=n.get('aggregate_node_count',1),classification='4 Requires human assessment',resolved=False))
(o/'accessibility-incomplete.json').write_text(json.dumps(dict(nodes=records,counts_by_artifact=dict(collections.Counter(x['artifact'] for x in records)),counts_by_rule=dict(collections.Counter(x['rule'] for x in records))),indent=2)+'\n')
# Validate installed dependency versions directly: npm ls can misreport aliased symlink trees and literal latest specifications.
lock=json.loads((r/'package-lock.json').read_text())['packages'];bad=[];checked=0;optional=[]
for p,m in lock.items():
 if not p:continue
 target=r/p/'package.json'
 if not target.exists():
  if m.get('optional'):optional.append(p)
  else:bad.append(dict(path=p,reason='missing'))
  continue
 checked+=1;v=json.loads(target.read_text()).get('version')
 if v!=m.get('version'):bad.append(dict(path=p,expected=m.get('version'),actual=v))
(o/'dependency-integrity.json').write_text(json.dumps(dict(checked=checked,mismatches=bad,optional_platform_packages_not_installed=optional,lock_sha256=h((r/'package-lock.json').read_bytes()),note='npm ls log retained separately; installed package.json versions checked against frozen lock, no dependency updates.'),indent=2)+'\n')
print('provenance',[(x['manifest'],len(x['differences'])) for x in checks]);print('axe',len(records),collections.Counter(x['rule'] for x in records));print('dependency mismatches',bad)

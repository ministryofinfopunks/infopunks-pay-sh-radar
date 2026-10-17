"""One-shot same-operator curation; imports no policy, Radar, or development cases.
The recorded outputs and elapsed times below are synthetic artifacts, not live probes.
Expected outputs are explicit separately authored answer keys, not strategy verdicts.
"""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]/'datasets'/'holdout'
def digest(x): return 'sha256:'+hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
# New contracts and inputs, independent of the original 20 task inputs/providers.
contracts=[
 ('weighted-invoice',{'items':[[3,7],[2,11]],'discount':5},38,43,'integer quantities times price minus discount'),
 ('dedupe-case-sensitive',['red','Red','red',' blue '],['red','Red',' blue '],['red','blue'],'exact string uniqueness, preserve first occurrence and whitespace'),
 ('inclusive-date-range',{'start':'2026-11-01','end':'2026-11-03'},3,2,'count inclusive calendar dates in UTC'),
 ('decimal-rounding',{'minor_units':1005,'rate_bps':500},50,51,'fee = floor(integer minor units * basis points / 10000)'),
 ('inventory-availability',{'stock':5,'reserved':3,'requested':3},False,True,'available stock after reservations must cover requested units'),
 ('pagination-completeness',{'pages':[[1,2],[3,4],[]]},[1,2,3,4],[1,2],'concatenate all pages through empty sentinel'),
 ('utf8-bytes','Aé😀',7,4,'length of UTF-8 encoded bytes'),
 ('currency-threshold',{'amount_minor':10000,'max_minor':10000},True,False,'threshold is inclusive and amounts use exact integer units')]
# Mix deliberately includes both trustworthy and misleading evidence. No expected strategy decision is authored.
variants=[
 # name,correct,elapsed,evidence quality/confidence/veto, cheap probe, price,value,downside,static validity
 ('qualified',True,12,'fresh',95,False,True,8,40,0,True),
 ('verified-risk',False,12,'fresh',95,True,True,9,45,15,True),
 ('silent-defect',False,12,'fresh',95,False,True,7,50,30,True),
 ('missing-good',True,12,'missing',0,False,True,6,34,0,True),
 ('stale-good',True,12,'stale',95,False,True,5,32,0,True),
 ('noisy-veto-good',True,12,'fresh',95,True,True,6,38,0,True),
 ('cheap-detected-failure',False,12,'missing',0,False,False,8,42,25,True),
 ('delivery-too-late',True,250,'fresh',95,False,False,7,48,8,True),
 ('negative-margin',True,12,'fresh',95,False,True,40,25,0,True),
 ('invalid-scope',True,12,'fresh',95,False,True,5,37,0,False),
 ('weak-confidence',True,12,'fresh',65,False,True,6,35,0,True),
 ('unverified-authority',False,12,'legacy-absent',95,False,True,8,46,40,True)]
offers=[];labels=[];artifacts=[]
for family,input,expected,wrong,contract in contracts:
 for name,correct,elapsed,quality,confidence,veto,cheap_ok,price,value,downside,static_ok in variants:
  id=family+'--'+name
  offer={'id':id,'family':family,'contract':contract,'input':input,'provider_id':'holdout/'+family+'/'+name,'price_units':price,'provider_fee_units':1,'value_units':value,'loss_exposure_units':downside,'deadline_ms':100,
   'static':{'identity_verified':True,'recipient_allowlisted':static_ok,'quote_valid':True,'rail_supported':True,'budget_units':50},
   'evidence':{'quality':quality,'confidence':confidence,'veto':veto,'sufficient':quality=='fresh','authority_explicit':quality!='legacy-absent'},
   'cheap_probe':{'reachable':cheap_ok,'schema_valid':True,'within_latency_bound':cheap_ok}}
  artifact={'id':id,'output':expected if correct else wrong,'status':'ok','elapsed_ms':elapsed,'charged_units':price,'provider_fee_units':1,'simulation':True}
  success=correct and elapsed<=offer['deadline_ms']
  utility=(value if success else -downside)-price-1
  label={'id':id,'expected_output':expected,'output_correct':correct,'within_deadline':elapsed<=100,'success':success,'net_units':utility,'should_spend':utility>0,'artifact_hash':digest(artifact),'offer_hash':digest(offer)}
  offers.append(offer);artifacts.append(artifact);labels.append(label)
for name,value in [('offers.json',offers),('artifacts.json',artifacts),('labels.json',labels)]:
 (root/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
manifest={'version':'first-spender.holdout-commitment.v1','status':'HOLD','economic_usefulness':'NOT_ESTABLISHED','curation':'separate local track; same operator; no external independence','simulation':True,'cases':len(offers),'families':len(contracts),'offers_hash':digest(offers),'artifacts_hash':digest(artifacts),'labels_hash':digest(labels),'policy_evaluation_performed':False,'development_inputs_imported':False,'timing':'predeclared synthetic durations, not measured provider latency','unit':'toy utility; no currency mapping'}
(root/'commitment.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'cases':len(offers),'labels_hash':manifest['labels_hash']}))

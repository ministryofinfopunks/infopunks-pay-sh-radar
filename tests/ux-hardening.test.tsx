// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { SpendTerminalPage } from '../src/web/spendTerminalPage';
import CanonicalReceiptPage from '../src/web/canonicalReceiptPage';
import { RoutesIndexPage } from '../src/web/preSpendBuilderPages';
import { RadarAppShell } from '../src/web/radarAppShell';
import { Rh4663Page } from '../src/web/rh4663Pages';
import { App as ResearchApp } from '../src/web/radarApp';
let root: Root; let el: HTMLDivElement;
const assessment = { judgment_id:'assessment', decision:'insufficient_evidence', confidence:0, issued_at:'2026-10-07T00:00:02Z',valid_until:'2026-10-07T00:00:02Z', reasons:['fresh_evidence_missing'],cited_observations:[], cost:{amount:'0',asset:'USDC'},payment_required:false,receipt:null };
const hash = 'sha256:'+'a'.repeat(64);
const execution = {schema_version:'canonical-receipts.v1',execution_id:'pending',judgment_id:'parent',executed_at:'2026-10-07T00:00:00Z',settlement_rail:'fixture',settlement_ref:'fixture',request_hash:hash,response_hash:hash,payload_signature:null,latency_ms:0,status:'pending',cost_amount:'0',cost_asset:'USDC',artifact_refs:[],parent_hash:hash,receipt_hash:hash};
beforeEach(()=>{window.history.replaceState({},'', '/');el=document.createElement('div');document.body.append(el);});
afterEach(()=>{act(()=>root?.unmount());el.remove();vi.restoreAllMocks();window.history.replaceState({},'', '/');});
async function mount(node:React.ReactNode){await act(async()=>{root=createRoot(el);root.render(node);});}
function input(id:string,value:string){act(()=>{const node=el.querySelector<HTMLInputElement>(id)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});}
async function submit(){await act(async()=>{el.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}
it('UX-01: rejects an empty key locally, describes its error and focuses the correction',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch');await mount(<SpendTerminalPage/>);await submit();expect(fetch).not.toHaveBeenCalled();const key=el.querySelector('#spend-tenant-key')!;expect(document.activeElement).toBe(key);expect(key.getAttribute('aria-invalid')).toBe('true');expect(key.getAttribute('aria-describedby')).toContain('spend-tenant-key-error');expect(el.querySelector('a[href="/developers"]')).not.toBeNull();
});
it.each([['#budget','-1'],['#budget',''],['#required_confidence','101'],['#required_confidence','']])('UX-05: durable validation for %s=%s without dispatch',async(id,value)=>{
 const fetch=vi.spyOn(globalThis,'fetch');await mount(<SpendTerminalPage/>);input('#spend-tenant-key','fixture');input(id,value);await submit();expect(fetch).not.toHaveBeenCalled();expect(document.activeElement?.id).toBe(id.slice(1));expect(el.querySelector(id)?.getAttribute('aria-invalid')).toBe('true');expect(el.querySelector('form')?.noValidate).toBe(true);expect(el.querySelector<HTMLInputElement>(id)?.value).toBe(value);
});
it('UX-01: rejected credentials receive generic local correction without echo',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(json({},401));await mount(<SpendTerminalPage/>);input('#spend-tenant-key','secret-fixture');await submit();expect(document.activeElement?.id).toBe('spend-tenant-key');expect(el.textContent).not.toContain('secret-fixture');expect(el.textContent).toContain('valid key for this tenant and agent');
});
it('UX-08: confirmed catalog subject links to exact dossier',async()=>{
 window.history.replaceState({},'', '/spend-terminal?subject=known');vi.spyOn(globalThis,'fetch').mockImplementation(async(url)=>String(url).includes('/v1/routes')?json({data:{routes:[{route_id:'known'}]}}):json(assessment));await mount(<SpendTerminalPage/>);input('#spend-tenant-key','fixture');await submit();expect(el.querySelector('a[href="/routes/known"]')).not.toBeNull();
});
it('UX-08: unknown subject stays in general evidence context',async()=>{
 window.history.replaceState({},'', '/spend-terminal?subject=unknown');vi.spyOn(globalThis,'fetch').mockImplementation(async(url)=>String(url).includes('/v1/routes')?json({data:{routes:[]}}):json(assessment));await mount(<SpendTerminalPage/>);input('#spend-tenant-key','fixture');await submit();expect(el.querySelector('a[href="/routes?subject=unknown"]')).not.toBeNull();
});
it.each(['spend','receipt'])('UX-12: %s key is masked, reveal has accessible state and no persistence',async(kind)=>{
 await mount(kind==='spend'?<SpendTerminalPage/>:<CanonicalReceiptPage kind="execution" id="pending"/>);input('input[aria-label="Tenant access key"]','secret-fixture');const show=el.querySelector<HTMLButtonElement>('button[aria-label="Show tenant access key"]')!;act(()=>show.click());expect(el.querySelector('input[aria-label="Tenant access key"]')?.getAttribute('type')).toBe('text');expect(show.getAttribute('aria-pressed')).toBe('true');act(()=>show.click());expect(show.getAttribute('aria-label')).toBe('Show tenant access key');expect(location.href).not.toContain('secret-fixture');expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
});
it('UX-07: pending provenance and parent are inspectable without fetching ancestors',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(json({data:execution}));await mount(<CanonicalReceiptPage kind="execution" id="pending"/>);input('#receipt-tenant-key','fixture');await submit();expect(fetch).toHaveBeenCalledTimes(1);expect(el.querySelector('a[href="/proof/judgment/parent"]')).not.toBeNull();expect(el.querySelector('.radar-receipt-summary')?.textContent).toContain('2026-10-07T00:00:00Z');expect(el.textContent).toContain('execution outcome is pending');expect(el.querySelector('[data-evidence-state="verified"]')).toBeNull();expect(el.querySelectorAll('details')).toHaveLength(1);
});
it('UX-13: proof hierarchy points to the owning archive',async()=>{
 await mount(<RadarAppShell path="/proof/execution/pending"><main><h1>Receipt</h1></main></RadarAppShell>);expect(el.querySelector('.radar-breadcrumbs a[href="/receipts"]')?.textContent).toBe('Proof archive');expect(el.querySelector('.radar-specialized-nav summary')?.textContent).toContain('Proof archive');
});
it('UX-09: validates/restores committed URL filters and handles popstate',async()=>{
 window.history.replaceState({},'', '/routes?service=valid&sort=risk');vi.spyOn(globalThis,'fetch').mockResolvedValue(json({data:{routes:[{route_id:'route',service_id:'valid',confidence_score:50,risk_level:'low',known_blockers:[],receipt_references:[]}],metrics:null}}));await mount(<RoutesIndexPage/>);const selects=el.querySelectorAll('select');expect(selects[0].value).toBe('valid');expect(selects[1].value).toBe('risk');act(()=>{window.history.replaceState({},'', '/routes?service=invalid&sort=invalid');window.dispatchEvent(new PopStateEvent('popstate'));});expect(selects[0].value).toBe('all');expect(selects[1].value).toBe('confidence');act(()=>{selects[1].value='risk';selects[1].dispatchEvent(new Event('change',{bubbles:true}));});expect(location.search).toContain('sort=risk');
});
it('UX-03/04: missing RH share reaches owning reader and retries only the GET',async()=>{
 window.history.replaceState({},'', '/4663/share/missing');const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(json({},404));await mount(<Rh4663Page/>);expect(fetch.mock.calls[0][0]).toBe('/v1/4663/share/missing');expect(el.querySelector('h1')?.textContent).toBe('Shared Robinhood evidence');expect(el.textContent).not.toContain('HTTP 404');const retry=Array.from(el.querySelectorAll('button')).find(b=>b.textContent==='Retry')!;await act(async()=>retry.click());expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls.every(c=>!c[1]?.method||c[1]?.method==='GET')).toBe(true);
});
it('UX-03: unknown signal does not render a different economy',async()=>{
 window.history.replaceState({},'', '/signals/unknown');const fetch=vi.spyOn(globalThis,'fetch');await mount(<ResearchApp/>);expect(fetch).not.toHaveBeenCalled();expect(el.textContent).toContain('Signal unavailable');expect(el.querySelector('a[href="/attention-market-watch"]')).not.toBeNull();expect(el.textContent).not.toContain('Solana Radar');
});

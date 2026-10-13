// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rh4663Page } from '../../../../src/web/rh4663Pages';
import { App as ResearchApp } from '../../../../src/web/radarApp';
import CanonicalReceiptPage from '../../../../src/web/canonicalReceiptPage';
import { AppErrorBoundary } from '../../../../src/web/appErrorBoundary';

const fixture=JSON.parse(readFileSync('docs/ux-hardening-2026-10-13/evidence/implementation/performance-fixture.json','utf8'));
let el:HTMLDivElement,root:Root;
beforeEach(()=>{window.history.replaceState({},'', '/');el=document.createElement('div');document.body.append(el);});
afterEach(()=>{act(()=>root?.unmount());el.remove();vi.restoreAllMocks();window.history.replaceState({},'', '/');});
async function mount(node:React.ReactNode){await act(async()=>{root=createRoot(el);root.render(node);await new Promise(r=>setTimeout(r,20));});}
function input(selector:string,value:string){act(()=>{const field=el.querySelector<HTMLInputElement>(selector)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});}
it('UX-03: unknown share stays in Robinhood with local recovery',async()=>{
 window.history.replaceState({},'', '/4663/share/unknown?source=watch');vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:404}));await mount(<Rh4663Page/>);expect(el.textContent).toContain('Shared Robinhood evidence');expect(el.querySelector('a[href="/4663"]')).not.toBeNull();expect(el.textContent).not.toContain('Solana');
});
it.each(['%E0%A4%A','%FF'])('UX-03: malformed share %s should retain owning-family recovery',async(id)=>{
 window.history.replaceState({},'', '/4663/share/'+id);vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:404}));await mount(<AppErrorBoundary><Rh4663Page/></AppErrorBoundary>);expect(el.textContent).toContain('Shared Robinhood evidence');expect(el.querySelector('a[href="/4663"]')).not.toBeNull();
});
it('UX-04: malformed successful share response should recover locally',async()=>{
 window.history.replaceState({},'', '/4663/share/bad-contract');vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{"data":{}}',{status:200,headers:{'content-type':'application/json'}}));await mount(<AppErrorBoundary><Rh4663Page/></AppErrorBoundary>);expect(el.textContent).toContain('Shared Robinhood evidence');expect(el.querySelector('button')?.textContent).toContain('Retry');
});
it.each([{}, {data:{}}, {data:null}])('UX-02: invalid successful envelope %j must not become no results',async(payload)=>{
 window.history.replaceState({},'', '/solana');vi.spyOn(globalThis,'fetch').mockImplementation(async(input)=>{const u=new URL(String(input),'http://localhost');if(u.pathname==='/v1/search')return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});const entry=fixture.responses[u.pathname+u.search];return new Response(entry?.body??'{}',{status:entry?.status??404,headers:{'content-type':entry?.contentType??'application/json'}});});await mount(<ResearchApp/>);input('#semantic-search-input','qa2 query');await act(async()=>{el.querySelector('.semantic-search-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,20));});expect(el.textContent).not.toContain('No matching providers');expect(el.textContent).toContain('Search could not complete');
});
it('Receipt authentication: 401 should focus re-enabled corrective key',async()=>{
 let resolve:(response:Response)=>void=()=>{};vi.spyOn(globalThis,'fetch').mockImplementation(()=>new Promise<Response>(r=>{resolve=r;}));await mount(<CanonicalReceiptPage kind="execution" id="unknown"/>);input('#receipt-tenant-key','qa2-invalid-synthetic-key');el.querySelector<HTMLButtonElement>('button[type=submit]')!.focus();await act(async()=>{el.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await act(async()=>{resolve(new Response('{}',{status:401}));});expect(el.querySelector('#receipt-tenant-key')?.getAttribute('aria-invalid')).toBe('true');expect(document.activeElement?.id).toBe('receipt-tenant-key');
});

// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadarAsyncState, RadarEvidenceRow, RadarReceiptLifecycle, RadarStatus } from '../src/web/radarDesignSystem';
import { RadarAppShell } from '../src/web/radarAppShell';
import { RadarContextHeader } from '../src/web/radarNetworks';
import { RoutesIndexPage, ReceiptDetailPage } from '../src/web/preSpendBuilderPages';
import { EvidenceBadge } from '../src/web/frontdoor4663';

describe('Radar universal identity and evidence boundaries', () => {
 let root: Root; let el: HTMLDivElement;
 beforeEach(() => { el=document.createElement('div');document.body.append(el); root=createRoot(el); });
 afterEach(() => {act(()=>root.unmount());el.remove();vi.restoreAllMocks();});
 function render(ui: React.ReactNode) {act(()=>root.render(ui));}
 it('never advances an absent stage after a favorable Judgment',()=>{
  render(<RadarReceiptLifecycle records={{judgment:{state:'judgment',detail:'ALLOW',recordId:'judgment_1',href:'/receipts/judgment_1'}}} />);
  const stages=el.querySelectorAll('li'); expect(stages).toHaveLength(4);
  expect(stages[1].textContent).toContain('Judgment'); expect(stages[1].textContent).toContain('ALLOW');
  expect(stages[2].textContent).toContain('Missing evidence');expect(stages[3].textContent).toContain('Missing evidence');
  expect(el.querySelector('[data-evidence-state="verified"]')).toBeNull();
 });
 it('labels conceptual architecture without claiming stage records',()=>{
  render(<RadarReceiptLifecycle reference />);
  expect(el.textContent).toContain('Architecture reference'); expect(el.querySelector('[data-evidence-state]')).toBeNull();
 });
 it('keeps all evidence categories independently labeled',()=>{
  render(<>{(['verified','judgment','pending','missing','recorded','unavailable','failed','demonstration','unverified'] as const).map(state=><RadarStatus key={state} state={state}/>)}</>);
  expect(new Set([...el.querySelectorAll('[data-evidence-state]')].map(node=>node.textContent)).size).toBe(9);
 });
 it.each(['FRESH','PUBLISHED','AVAILABLE','UNVERIFIED','NOT_VERIFIED'])('does not upgrade %s to verified',state=>{
  render(<EvidenceBadge state={state}/>); expect(el.querySelector('[data-evidence-state="VERIFIED"]')).toBeNull();
 });
 it('owns one global navigation and uses RH context on //4663 detail routes',()=>{
  render(<RadarAppShell path="/4663/reflexive"><RadarContextHeader/><main><h1>Reflexive market evidence</h1></main></RadarAppShell>);
  expect(el.querySelectorAll('.radar-product-navigation')).toHaveLength(1);
  expect(el.querySelector('.radar-section-header')?.textContent).toContain('[ 12 ]');
  expect(el.querySelector('.radar-network-trigger')?.textContent).toContain('RH Chain');
  expect(el.querySelector('.radar-app-skip')?.getAttribute('href')).toBe('#radar-page-content');
 });
 it('restores focus after keyboard dismissal of the network selector',()=>{
  render(<RadarAppShell path="/routes"><main><h1>Routes</h1></main></RadarAppShell>);
  const trigger=el.querySelector<HTMLButtonElement>('.radar-network-trigger')!;
  act(()=>trigger.click()); expect(trigger.getAttribute('aria-expanded')).toBe('true');
  act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(trigger);
 });
 it('provides an announced recoverable error and honest permission state',()=>{
  const retry=vi.fn();render(<RadarAsyncState kind="error" title="Evidence request failed" onRetry={retry}/>);
  expect(el.querySelector('[role="alert"]')).toBeTruthy();act(()=>el.querySelector<HTMLButtonElement>('button')!.click());expect(retry).toHaveBeenCalledOnce();
  render(<RadarAsyncState kind="permission-denied" title="Receipt access required"/>);expect(el.textContent).toContain('Receipt access required');
 });
 it('uses native disclosure and keeps provenance available',()=>{
  render(<RadarEvidenceRow title="Provider evidence" state="recorded" provenance="receipt_42"><p>Validation not established</p></RadarEvidenceRow>);
  expect(el.querySelector('details > summary')).toBeTruthy();expect(el.textContent).toContain('receipt_42');
 });
 it('recovers from a failed catalog request and distinguishes empty evidence',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({data:{routes:[],metrics:null}}),{status:200}));
  await act(async()=>root.render(<RoutesIndexPage/>));
  expect(el.querySelector('[role="alert"]')?.textContent).toContain('Evidence request failed');
  await act(async()=>el.querySelector<HTMLButtonElement>('.radar-async-state button')!.click());
  expect(el.textContent).toContain('No records available');expect(el.querySelector('[role="alert"]')).toBeNull();
 });
 it('shows permission denial instead of waiting indefinitely for receipt evidence',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:403}));
  await act(async()=>root.render(<ReceiptDetailPage receiptId="receipt_private_qualification"/>));
  expect(el.querySelector('.state-permission-denied')?.textContent).toContain('Evidence access required');
  expect(el.textContent).not.toContain('Loading evidence-backed detail.');
 });

});

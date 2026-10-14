// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import CanonicalReceiptPage from '../src/web/canonicalReceiptPage';
import { RadarReceiptLifecycle } from '../src/web/radarDesignSystem';
let root: ReturnType<typeof createRoot>;let el: HTMLDivElement;
afterEach(()=>{act(()=>root?.unmount());el?.remove();vi.restoreAllMocks()});
it('never presents a missing receipt as completed proof',()=>{
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 act(()=>root.render(<CanonicalReceiptPage kind="judgment" id="missing"/>));
 expect(el.querySelector('[data-evidence-state="missing"]')).not.toBeNull();
 expect(el.querySelector('[data-evidence-state="verified"]')).toBeNull();
 expect(el.querySelector('input')?.type).toBe('password');
 expect(el.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
});
it('does not advance another stage from a verified Judgment or pending Execution',()=>{
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 act(()=>root.render(<RadarReceiptLifecycle records={{judgment:{state:'verified',detail:'Signature and ancestry verified'},execution:{state:'pending',detail:'pending'}}}/>));
 const stages=el.querySelectorAll('li');expect(stages).toHaveLength(4);
 expect(stages[2].querySelector('[data-evidence-state="pending"]')).not.toBeNull();
 expect(stages[3].querySelector('[data-evidence-state="missing"]')).not.toBeNull();
});

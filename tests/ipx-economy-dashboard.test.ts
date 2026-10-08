// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ipxEconomyDocument } from '../src/web/ipxEconomyDocument';
describe('economic dashboard evidence boundaries', () => {
  async function render(data: Record<string, unknown>) {
    document.body.innerHTML = ipxEconomyDocument;
    const fetchEvidence = async (path: string) => ({ ok: Object.hasOwn(data, path), json: async () => ({ data: data[path] }) });
    const script = document.querySelector('script')!.textContent!;
    const run = new Function('document', 'fetch', script.slice(0, script.lastIndexOf('load().catch')) + '; return load();');
    await run(document, fetchEvidence);
    return { window: { document, close: () => document.body.replaceChildren() } };
  }
  it('does not claim a configured protocol when launch evidence is unavailable', async () => {
    const dom = await render({});
    try { expect(dom.window.document.getElementById('state')!.textContent).toBe('Launch evidence is unavailable.'); expect(dom.window.document.getElementById('revenue')!.textContent).toBe('Unknown'); } finally { dom.window.close(); }
  });
  it('uses full ledger totals even if bounded history is unavailable and preserves atomic precision', async () => {
    const dom = await render({ '/v1/ipx/launch': { state: 'AWAITING_ALLOCATION_AND_DEPLOYMENT' }, '/v1/ipx/economy/summary': { verified_revenue_usdg_atomic: '9007199254740993000001', verified_burn_ipx_atomic: '1000000000000000001', burn_count: 1 } });
    try { expect(dom.window.document.getElementById('revenue')!.textContent).toBe('9007199254740993.000001 USDG'); expect(dom.window.document.getElementById('burns')!.textContent).toBe('1.000000000000000001 IPX'); } finally { dom.window.close(); }
  });
  it('renders receipt evidence as text without interpreting injected markup', async () => {
    const dom = await render({ '/v1/ipx/economy/receipts': [{ kind: '<img src=x onerror=alert(1)>', receipt_id: 'receipt', receipt_hash: 'hash', payload: {} }] });
    try { expect(dom.window.document.querySelector('#receipts img')).toBeNull(); expect(dom.window.document.querySelector('#receipts td')!.textContent).toBe('<img src=x onerror=alert(1)>'); } finally { dom.window.close(); }
  });
});

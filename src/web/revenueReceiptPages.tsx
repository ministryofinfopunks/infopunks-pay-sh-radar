import React, { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';

type RevenueReceiptStatus = 'open_slot' | 'pending' | 'completed' | 'cancelled' | 'refunded' | 'disputed';
type RevenueReceiptSource =
  | 'sponsored_radar_evaluation'
  | 'signal_hunt_bounty'
  | 'radar_listing'
  | 'weekly_report'
  | 'studio_work'
  | 'api_access'
  | 'internal_build';
type RevenueReceiptUseOfFundsBucket = 'product_treasury' | 'hunter_rewards' | 'community_ops' | 'content_design_bounties';

type RevenueReceipt = {
  id: string;
  receiptNumber: string;
  title: string;
  source: RevenueReceiptSource;
  clientName: string;
  clientType: string;
  amount: number;
  currency: 'USD';
  status: RevenueReceiptStatus;
  publishedAt: string;
  completedAt: string | null;
  relatedProduct: string;
  relatedCandidateId: string | null;
  relatedCandidateUrl: string | null;
  disclosure: string;
  verdictIndependenceStatement: string;
  useOfFunds: Array<{ bucket: RevenueReceiptUseOfFundsBucket; percentage: number; amount_usd: number }>;
  hunterReward: number | null;
  txHash: string | null;
  paymentMethod: string | null;
  notes: string[];
  ogImageUrl: string;
};

type RevenueReceiptSummary = {
  generated_at: string;
  title: 'Infopunks Revenue Receipts';
  tagline: 'No receipt, no trust.';
  subline: 'Public ledger for paid evaluations, bounties, reports, listings, studio work, and API access.';
  trust_line: 'Projects can buy evaluation, not conviction.';
  warning_line: string;
  use_of_funds_policy: Array<{ bucket: RevenueReceiptUseOfFundsBucket; percentage: number }>;
  receipts: RevenueReceipt[];
};

const API_BASE_URL = getApiBaseUrl();
const STATUS_ORDER: RevenueReceiptStatus[] = ['open_slot', 'pending', 'completed', 'cancelled', 'refunded', 'disputed'];

async function api<T>(path: string): Promise<T> {
  const response = await fetch(toApiUrl(API_BASE_URL, path), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

function titleCase(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function statusTone(status: RevenueReceiptStatus) {
  if (status === 'completed') return 'ok';
  if (status === 'open_slot') return 'paid';
  if (status === 'pending') return 'review';
  return 'warn';
}

function RevenueReceiptsNav() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/revenue-receipts';
  return <nav className="global-toolbar proof-check-toolbar unicorn-radar-nav revenue-receipts-nav" aria-label="Revenue Receipts navigation">
    <a className="nav-brand" href="/" aria-label="Infopunks Pay.sh Radar home">
      <span>Infopunks</span>
      <strong>Revenue</strong>
    </a>
    <div className="terminal-nav terminal-nav-scroll-rail" aria-label="Revenue Receipts routes">
      <a href="/revenue-receipts" aria-current={pathname === '/revenue-receipts' ? 'page' : undefined}>Revenue Receipts</a>
      <a href="/unicorn-radar">Unicorn Radar</a>
      <a href="/signal-hunt">Signal Hunt</a>
      <a href="/narratives">Narrative Intel</a>
    </div>
  </nav>;
}

function UseOfFundsTable({ allocations }: { allocations: RevenueReceipt['useOfFunds'] }) {
  return <table className="revenue-table">
    <thead>
      <tr>
        <th>Bucket</th>
        <th>Allocation</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      {allocations.map((allocation) => <tr key={allocation.bucket}>
        <td>{titleCase(allocation.bucket)}</td>
        <td>{allocation.percentage}%</td>
        <td>{formatMoney(allocation.amount_usd, 'USD')}</td>
      </tr>)}
    </tbody>
  </table>;
}

function ReceiptCard({ receipt }: { receipt: RevenueReceipt }) {
  const trustNote = receipt.notes.find((note) => /not real revenue|not revenue receipt #001/i.test(note)) ?? receipt.notes[0];
  return <article className="panel revenue-receipt-card">
    <div className="revenue-receipt-card-head">
      <span className={`status-pill ${statusTone(receipt.status)}`}>{titleCase(receipt.status)}</span>
      <span className="eyebrow">{receipt.receiptNumber}</span>
    </div>
    <h3>{receipt.title}</h3>
    <p className="copy">{titleCase(receipt.source)} · {receipt.clientName}</p>
    <p><strong>{formatMoney(receipt.amount, receipt.currency)}</strong> · {receipt.relatedProduct}</p>
    <p className="panel-caption">{receipt.disclosure}</p>
    {trustNote && <p className="panel-caption">{trustNote}</p>}
    <p className="panel-caption">Use of funds: {receipt.useOfFunds.map((allocation) => `${allocation.percentage}% ${titleCase(allocation.bucket)}`).join(' · ')}</p>
    <div className="signal-hunt-card-actions">
      <a className="execute compact secondary" href={`/revenue-receipts/${encodeURIComponent(receipt.id)}`}>Open receipt</a>
    </div>
  </article>;
}

export function RevenueReceiptsPage() {
  const [summary, setSummary] = useState<RevenueReceiptSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: RevenueReceiptSummary }>('/v1/revenue-receipts')
      .then((response) => setSummary(response.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'revenue_receipts_unavailable'));
  }, []);

  const grouped = useMemo(() => {
    const receipts = summary?.receipts ?? [];
    return STATUS_ORDER.map((status) => ({
      status,
      receipts: receipts.filter((receipt) => receipt.status === status)
    })).filter((group) => group.receipts.length > 0);
  }, [summary]);

  return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell revenue-receipts-shell">
    <RevenueReceiptsNav />
    <main className="builder-page revenue-receipts-page" aria-label="Infopunks Revenue Receipts">
      <section className="panel hero revenue-receipts-hero">
        <div>
          <p className="eyebrow">Public commercial ledger</p>
          <h1>{summary?.title ?? 'Infopunks Revenue Receipts'}</h1>
          <h2>{summary?.tagline ?? 'No receipt, no trust.'}</h2>
          <p className="copy">{summary?.subline ?? 'Public ledger for paid evaluations, bounties, reports, listings, studio work, and API access.'}</p>
          <p className="copy">{summary?.trust_line ?? 'Projects can buy evaluation, not conviction.'}</p>
          <p className="panel-caption">{summary?.warning_line ?? 'Template receipts are examples only. They are not real revenue.'}</p>
          <div className="signal-hunt-hero-actions">
            <a className="execute" href="/unicorn-radar#request-evaluation">Request a paid evaluation</a>
            <a className="execute compact secondary" href="/openapi.json">Open API schema</a>
          </div>
        </div>
        <div className="signal-hunt-counter-grid unicorn-counter-grid" aria-label="Revenue receipt counters">
          <article className="panel loop-counter-card"><span>receipts</span><strong>{summary?.receipts.length ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>open slots</span><strong>{summary?.receipts.filter((receipt) => receipt.status === 'open_slot').length ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>templates</span><strong>{summary?.receipts.filter((receipt) => receipt.clientType === 'example').length ?? 0}</strong></article>
          <article className="panel loop-counter-card"><span>completed</span><strong>{summary?.receipts.filter((receipt) => receipt.status === 'completed').length ?? 0}</strong></article>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}

      <section className="panel revenue-receipts-policy" aria-label="Use of funds policy">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Use of Funds</p>
            <h2>Default allocation policy</h2>
          </div>
          <p className="panel-caption">Default split for public paid work before any receipt-specific override.</p>
        </div>
        <div className="signal-hunt-chip-row">
          {(summary?.use_of_funds_policy ?? []).map((allocation) => <span className="copy-chip" key={allocation.bucket}>{allocation.percentage}% {titleCase(allocation.bucket)}</span>)}
        </div>
      </section>

      {grouped.map((group) => <section className="panel unicorn-section" key={group.status} aria-label={`${titleCase(group.status)} receipts`}>
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">{titleCase(group.status)}</p>
            <h2>{group.receipts.length}</h2>
          </div>
          <p className="panel-caption">{group.status === 'pending' ? 'Templates and unpublished work stay explicitly marked.' : 'Receipt status is public so trust can be audited.'}</p>
        </div>
        <div className="signal-hunt-grid revenue-receipt-grid">
          {group.receipts.map((receipt) => <ReceiptCard key={receipt.id} receipt={receipt} />)}
        </div>
      </section>)}
    </main>
  </div>;
}

export function RevenueReceiptDetailPage({ receiptId }: { receiptId: string }) {
  const [receipt, setReceipt] = useState<RevenueReceipt | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: RevenueReceipt }>(`/v1/revenue-receipts/${encodeURIComponent(receiptId)}`)
      .then((response) => {
        setReceipt(response.data);
        setMissing(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.endsWith(' 404')) setMissing(true);
        else setError(err instanceof Error ? err.message : 'revenue_receipt_unavailable');
      });
  }, [receiptId]);

  if (missing) return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell revenue-receipts-shell"><RevenueReceiptsNav /><main className="builder-page revenue-receipts-page"><section className="panel hero"><h1>Receipt not found.</h1><p className="copy">No revenue receipt exists for <code>{receiptId}</code>.</p><a className="execute compact secondary" href="/revenue-receipts">Back to Revenue Receipts</a></section></main></div>;
  if (error) return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell revenue-receipts-shell"><RevenueReceiptsNav /><main className="builder-page revenue-receipts-page"><section className="panel hero"><h1>Revenue Receipts unavailable.</h1><p className="copy">{error}</p></section></main></div>;
  if (!receipt) return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell revenue-receipts-shell"><RevenueReceiptsNav /><main className="builder-page revenue-receipts-page"><section className="panel hero"><h1>Loading receipt...</h1></section></main></div>;

  return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell revenue-receipts-shell">
    <RevenueReceiptsNav />
    <main className="builder-page revenue-receipts-detail-page" aria-label={`${receipt.title} detail`}>
      <section className="panel hero revenue-receipts-hero">
        <div>
          <p className="eyebrow">{receipt.receiptNumber} / {titleCase(receipt.source)}</p>
          <h1>{receipt.title}</h1>
          <h2>{receipt.clientName} · {formatMoney(receipt.amount, receipt.currency)}</h2>
          <p className="copy">{receipt.disclosure}</p>
          <p className="panel-caption">{receipt.verdictIndependenceStatement}</p>
        </div>
        <div className="panel unicorn-verdict-panel">
          <span className={`status-pill ${statusTone(receipt.status)}`}>{titleCase(receipt.status)}</span>
          <h2>{receipt.relatedProduct}</h2>
          <p>{receipt.paymentMethod ?? 'Payment method not yet recorded.'}</p>
        </div>
      </section>

      <section className="signal-hunt-detail-grid revenue-receipt-detail-grid">
        <article className="panel">
          <p className="eyebrow">Receipt Fields</p>
          <div className="revenue-detail-list">
            <p><b>ID</b><span>{receipt.id}</span></p>
            <p><b>Receipt number</b><span>{receipt.receiptNumber}</span></p>
            <p><b>Source</b><span>{titleCase(receipt.source)}</span></p>
            <p><b>Client</b><span>{receipt.clientName} / {receipt.clientType}</span></p>
            <p><b>Published</b><span>{receipt.publishedAt}</span></p>
            <p><b>Completed</b><span>{receipt.completedAt ?? 'not completed'}</span></p>
            <p><b>Related product</b><span>{receipt.relatedProduct}</span></p>
            <p><b>Hunter reward</b><span>{receipt.hunterReward == null ? 'not recorded' : formatMoney(receipt.hunterReward, 'USD')}</span></p>
            <p><b>Payment method</b><span>{receipt.paymentMethod ?? 'not recorded'}</span></p>
            <p><b>Tx hash</b><span>{receipt.txHash ?? 'not recorded'}</span></p>
          </div>
        </article>
        <article className="panel">
          <p className="eyebrow">Use of Funds</p>
          <UseOfFundsTable allocations={receipt.useOfFunds} />
        </article>
      </section>

      <section className="signal-hunt-detail-grid revenue-receipt-detail-grid">
        <article className="panel">
          <p className="eyebrow">Notes</p>
          <ul className="revenue-note-list">
            {receipt.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </article>
        <article className="panel">
          <p className="eyebrow">Related candidate</p>
          {receipt.relatedCandidateUrl
            ? <p><a className="execute compact secondary" href={receipt.relatedCandidateUrl}>Open related candidate</a></p>
            : <p className="panel-caption">No public candidate is linked to this receipt yet.</p>}
          <p className="panel-caption">OG image: <code>{receipt.ogImageUrl}</code></p>
        </article>
      </section>
    </main>
  </div>;
}

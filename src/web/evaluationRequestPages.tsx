import React, { useState } from 'react';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import { RadarProductNavigation } from './radarNetworks';

type EvaluationRequestReviewType =
  | 'unicorn_radar_evaluation'
  | 'do_not_touch_risk_review'
  | 'token_survivability_review'
  | 'agent_readiness_review'
  | 'narrative_positioning_review';

type EvaluationRequestFormState = {
  projectName: string;
  ticker: string;
  chain: string;
  tokenAddress: string;
  website: string;
  xAccount: string;
  contact: string;
  dexScreenerUrl: string;
  solscanUrl: string;
  marketCap: string;
  liquidity: string;
  holderCount: string;
  top10HolderConcentration: string;
  top25HolderConcentration: string;
  supplyNotes: string;
  launchStructure: string;
  teamTreasuryWallets: string;
  productReceipts: string;
  marketplaceEconomyReceipts: string;
  communityReceipts: string;
  upsideThesis: string;
  riskFlags: string;
  whyNow: string;
  requestedReviewType: EvaluationRequestReviewType;
  paidEvaluationBudget: string;
  disclosureAcknowledged: boolean;
};

type EvaluationRequestResponse = {
  request_id: string;
  status: 'accepted' | 'manual_delivery_required';
  generated_at: string;
  disclosure_acknowledged: true;
  revenue_receipt_policy: string;
  next_steps: string[];
  request_packet: string;
};

const API_BASE_URL = getApiBaseUrl();
const DISCLOSURE_COPY = 'I understand payment buys evaluation, not conviction. Any paid status may be publicly disclosed.';

const INITIAL_FORM: EvaluationRequestFormState = {
  projectName: '',
  ticker: '',
  chain: '',
  tokenAddress: '',
  website: '',
  xAccount: '',
  contact: '',
  dexScreenerUrl: '',
  solscanUrl: '',
  marketCap: '',
  liquidity: '',
  holderCount: '',
  top10HolderConcentration: '',
  top25HolderConcentration: '',
  supplyNotes: '',
  launchStructure: '',
  teamTreasuryWallets: '',
  productReceipts: '',
  marketplaceEconomyReceipts: '',
  communityReceipts: '',
  upsideThesis: '',
  riskFlags: '',
  whyNow: '',
  requestedReviewType: 'unicorn_radar_evaluation',
  paidEvaluationBudget: '',
  disclosureAcknowledged: false
};

function EvaluationRequestNav() {
  return <RadarProductNavigation context="solana" className="proof-check-toolbar unicorn-radar-nav revenue-receipts-nav" />;
}

function titleCase(value: string) {
  return value.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function Field({
  label,
  name,
  value,
  onChange,
  required = false,
  textarea = false,
  type = 'text'
}: {
  label: string;
  name: keyof EvaluationRequestFormState;
  value: string;
  onChange: (name: keyof EvaluationRequestFormState, value: string) => void;
  required?: boolean;
  textarea?: boolean;
  type?: string;
}) {
  return <label className="evaluation-field">
    <span>{label}{required ? ' *' : ''}</span>
    {textarea
      ? <textarea name={name} value={value} rows={4} onChange={(event) => onChange(name, event.target.value)} />
      : <input name={name} type={type} value={value} onChange={(event) => onChange(name, event.target.value)} />}
  </label>;
}

export function EvaluationRequestPage() {
  const [form, setForm] = useState<EvaluationRequestFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<EvaluationRequestResponse | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await fetch(toApiUrl(API_BASE_URL, '/v1/evaluation-request'), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const body = await result.json().catch(() => null) as { data?: EvaluationRequestResponse; code?: string; message?: string; error?: string } | null;
      if (!result.ok) {
        if (body?.code === 'DISCLOSURE_REQUIRED' && body.message) throw new Error(body.message);
        throw new Error(body?.message ?? body?.error ?? `evaluation_request_${result.status}`);
      }

      if (!body?.data) throw new Error('evaluation_request_missing_response');
      setResponse(body.data);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Evaluation request failed.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="shell builder-shell proof-feed-shell unicorn-radar-shell evaluation-request-shell">
    <EvaluationRequestNav />
    <main className="builder-page evaluation-request-page" aria-label="Evaluation request form">
      <section className="panel hero evaluation-request-hero">
        <div>
          <p className="eyebrow">Paid intake funnel</p>
          <h1>Request an Infopunks Evaluation</h1>
          <h2>Payment buys evaluation, not conviction.</h2>
          <p className="copy">Submit receipts for Unicorn Radar, token survivability, risk review, agent readiness, or narrative positioning.</p>
          <p className="panel-caption">Paid evaluation does not guarantee a positive verdict. Strong risks may result in Watchlist or Do Not Touch Yet.</p>
          <div className="signal-hunt-hero-actions">
            <a className="execute" href="/revenue-receipts">Open Revenue Receipts</a>
            <a className="execute compact secondary" href="/unicorn-radar">Back to Unicorn Radar</a>
          </div>
        </div>
        <div className="panel unicorn-verdict-panel evaluation-request-policy-panel">
          <span className="status-pill paid">Disclosure required</span>
          <h2>Public commercial trust layer</h2>
          <p>{'Paid evaluations may receive public Revenue Receipts. Payment buys evaluation, not conviction.'}</p>
        </div>
      </section>

      {error && <section className="panel"><p className="route-state error">{error}</p></section>}

      {response && <section className="panel evaluation-request-response" aria-label="Evaluation request response">
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">{response.status === 'accepted' ? 'Accepted' : 'Manual delivery required'}</p>
            <h2>{response.request_id}</h2>
          </div>
          <p className="panel-caption">{response.revenue_receipt_policy}</p>
        </div>
        <div className="evaluation-request-response-grid">
          <article className="panel">
            <p className="eyebrow">Next steps</p>
            <ul className="revenue-note-list">
              {response.next_steps.map((step) => <li key={step}>{step}</li>)}
            </ul>
          </article>
          <article className="panel">
            <p className="eyebrow">Request packet</p>
            <textarea className="evaluation-request-packet" readOnly rows={16} value={response.request_packet} />
          </article>
        </div>
      </section>}

      <form className="panel evaluation-request-form" onSubmit={submit}>
        <div className="proof-section-head">
          <div>
            <p className="eyebrow">Receipts intake</p>
            <h2>Evaluation request fields</h2>
          </div>
          <p className="panel-caption">Required fields are marked with *.</p>
        </div>

        <div className="evaluation-request-grid">
          <Field label="Project name" name="projectName" value={form.projectName} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} required />
          <Field label="Ticker" name="ticker" value={form.ticker} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} required />
          <Field label="Chain" name="chain" value={form.chain} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} required />
          <Field label="Contact" name="contact" value={form.contact} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} required />
          <Field label="Token address" name="tokenAddress" value={form.tokenAddress} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="Website" name="website" value={form.website} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="X account" name="xAccount" value={form.xAccount} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="DexScreener URL" name="dexScreenerUrl" value={form.dexScreenerUrl} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="Solscan URL" name="solscanUrl" value={form.solscanUrl} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="Market cap" name="marketCap" value={form.marketCap} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="Liquidity" name="liquidity" value={form.liquidity} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="Holder count" name="holderCount" value={form.holderCount} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="Top 10 holder concentration" name="top10HolderConcentration" value={form.top10HolderConcentration} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <Field label="Top 25 holder concentration" name="top25HolderConcentration" value={form.top25HolderConcentration} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
          <label className="evaluation-field">
            <span>Requested review type</span>
            <select value={form.requestedReviewType} onChange={(event) => setForm((current) => ({ ...current, requestedReviewType: event.target.value as EvaluationRequestReviewType }))}>
              {(['unicorn_radar_evaluation', 'do_not_touch_risk_review', 'token_survivability_review', 'agent_readiness_review', 'narrative_positioning_review'] as EvaluationRequestReviewType[]).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>
          <Field label="Paid evaluation budget" name="paidEvaluationBudget" value={form.paidEvaluationBudget} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} />
        </div>

        <div className="evaluation-request-stack">
          <Field label="Supply notes" name="supplyNotes" value={form.supplyNotes} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} textarea />
          <Field label="Launch structure" name="launchStructure" value={form.launchStructure} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} textarea />
          <Field label="Team treasury wallets" name="teamTreasuryWallets" value={form.teamTreasuryWallets} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} textarea />
          <Field label="Product receipts" name="productReceipts" value={form.productReceipts} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} textarea />
          <Field label="Marketplace economy receipts" name="marketplaceEconomyReceipts" value={form.marketplaceEconomyReceipts} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} textarea />
          <Field label="Community receipts" name="communityReceipts" value={form.communityReceipts} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} textarea />
          <Field label="Upside thesis" name="upsideThesis" value={form.upsideThesis} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} required textarea />
          <Field label="Risk flags" name="riskFlags" value={form.riskFlags} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} required textarea />
          <Field label="Why now" name="whyNow" value={form.whyNow} onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))} textarea />
        </div>

        <label className="evaluation-checkbox">
          <input
            type="checkbox"
            checked={form.disclosureAcknowledged}
            onChange={(event) => setForm((current) => ({ ...current, disclosureAcknowledged: event.target.checked }))}
          />
          <span>{DISCLOSURE_COPY}</span>
        </label>

        <div className="signal-hunt-card-actions">
          <button className="execute" type="submit" disabled={loading}>{loading ? 'Generating…' : 'Generate evaluation request'}</button>
        </div>
      </form>
    </main>
  </div>;
}

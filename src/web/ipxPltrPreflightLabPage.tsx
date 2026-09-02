import React, { useMemo, useState } from 'react';
import './ipxPltrPreflightLab.css';

type Architecture = 'PLTR_NATIVE' | 'PLTR_ANCHOR' | 'PLTR_RESERVE_ANCHOR';
type FormState = { snapshot: string; architecture: Architecture; price: string; pltrLp: string; ipxLp: string; reserve: string; totalSupply: string; circulatingSupply: string; tickLower: string; tickUpper: string; fee: string; tickSpacing: string; usdg: boolean; weth: boolean; pltrCapital: string; usdgCapital: string; wethCapital: string };
type Simulation = any;

const initial: FormState = { snapshot: 'pltr-preflight-52406504-20260902074509000', architecture: 'PLTR_ANCHOR', price: '0.01', pltrLp: '300', ipxLp: '30000', reserve: '200', totalSupply: '100000000', circulatingSupply: '10000000', tickLower: '-60000', tickUpper: '-30000', fee: '3000', tickSpacing: '200', usdg: true, weth: true, pltrCapital: '50', usdgCapital: '30', wethCapital: '20' };
const architectureCopy: Record<Architecture, string> = {
  PLTR_NATIVE: 'IPX / PLTR carries identity, capital and execution.',
  PLTR_ANCHOR: 'IPX / PLTR preserves identity and capital while crypto quotes can carry flow.',
  PLTR_RESERVE_ANCHOR: 'A smaller identity market is separated from a disclosed PLTR reserve.'
};

function configuration(form: FormState) {
  return {
    simulation_name: `LAB // ${form.architecture}`,
    architecture: form.architecture,
    asset_owner: 'INFOPUNKS', first_party_asset: true, ipx_decimals: 18,
    hypothetical_total_supply: form.totalSupply, hypothetical_circulating_supply_at_launch: form.circulatingSupply,
    initial_price_pltr_per_ipx: form.price,
    pltr_allocated_to_ipx_pltr_liquidity: form.pltrLp, ipx_allocated_to_ipx_pltr_liquidity: form.ipxLp,
    pltr_allocated_to_first_party_reserve: form.reserve, other_first_party_ipx_linked_pltr_holdings: [],
    v4_fee: Number(form.fee), tick_spacing: Number(form.tickSpacing), hook_configuration: { kind: 'ZERO_HOOK' },
    liquidity_positions: [{ position_id: 'canonical-range-01', tick_lower: Number(form.tickLower), tick_upper: Number(form.tickUpper), pltr_principal: form.pltrLp, ipx_principal: form.ipxLp }],
    hypothetical_usdg_execution_market_exists: form.usdg, hypothetical_weth_execution_market_exists: form.weth,
    hypothetical_capital_allocation_pct: { pltr: form.pltrCapital, usdg: form.usdgCapital, weth: form.wethCapital },
    reserve_policy_metadata: { withdrawal_policy_descriptor: 'Hypothetical disclosed policy; no withdrawals simulated.', custody_descriptor: 'Hypothetical first-party custody descriptor.', acquisition_policy_descriptor: 'No acquisition or purchase simulation in v0.5.0.' },
    reference_trade_notionals_usd: ['1000', '5000', '10000', '25000', '50000', '100000']
  };
}

export function IpxPltrPreflightLabPage() {
  const [form, setForm] = useState(initial); const [result, setResult] = useState<Simulation | null>(null); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false);
  const payload = useMemo(() => configuration(form), [form]);
  const update = (key: keyof FormState, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const simulate = async (event: React.FormEvent) => { event.preventDefault(); setPending(true); setError(null); try { const response = await fetch('/v1/4663/reflexive/preflight/ipx-pltr/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state_snapshot_id: form.snapshot, hypothetical_configuration: payload }) }); const body = await response.json(); if (!response.ok || !body.data) throw new Error(body.detail ?? body.error ?? 'SIMULATION_FAILED'); setResult(body.data); } catch (cause) { setResult(null); setError(cause instanceof Error ? cause.message : 'SIMULATION_FAILED'); } finally { setPending(false); } };
  const footprint = result?.result?.first_party_pltr_footprint; const verdict = result?.result?.draft_simulation_verdict; const maxImpact = result ? Math.max(...[...result.result.trade_impact.buys, ...result.result.trade_impact.sells].map((trade: any) => Math.abs(Number(trade.price_impact_pct)))) : null;
  return <div className="ipx-lab-shell">
    <header className="ipx-lab-nav"><a href="/4663/reflexive">INFOPUNKS <i>//4663</i></a><div><span>REFLEXIVE RADAR v0.5.0</span><b>READ-ONLY</b></div></header>
    <main className="ipx-lab-main">
      <section className="ipx-lab-hero"><div className="ipx-lab-kicker"><span>HYPOTHETICAL MARKET SIMULATOR</span><b>LAB</b></div><h1>IPX / PLTR<br /><em>// PREFLIGHT LAB</em></h1><p>Two forms of intelligence. One hypothetical market.</p><small>No token has been launched. No transaction is executed. Every simulation uses a frozen PLTR state.</small></section>
      <section className="ipx-lab-console">
        <div className="ipx-lab-console-head"><div><span>SIMULATION INPUT CONTRACT</span><h2>Freeze the world.<br />Change the design.</h2></div><p>The state identifier is explicit. “Latest” is rejected. Quantities below are illustrative simulation parameters—not launch recommendations.</p></div>
        <form onSubmit={simulate}>
          <fieldset className="ipx-lab-state"><legend>01 · FROZEN PLTR STATE</legend><label><span>OBSERVATION ID</span><input aria-label="Frozen PLTR state observation ID" value={form.snapshot} onChange={(event) => update('snapshot', event.target.value)} required /></label><div className="ipx-lab-state-proof"><span>EXPECTED STATE</span><b>READY_FOR_SIMULATION</b><small>One immutable observation. No live field assembly.</small></div></fieldset>
          <fieldset><legend>02 · ARCHITECTURE</legend><div className="ipx-architecture-grid">{(['PLTR_NATIVE', 'PLTR_ANCHOR', 'PLTR_RESERVE_ANCHOR'] as const).map((architecture, index) => <button type="button" aria-pressed={form.architecture === architecture} className={form.architecture === architecture ? 'selected' : ''} key={architecture} onClick={() => update('architecture', architecture)}><small>{String.fromCharCode(65 + index)}</small><b>{architecture.replaceAll('_', ' ')}</b><span>{architectureCopy[architecture]}</span></button>)}</div></fieldset>
          <fieldset><legend>03 · HYPOTHETICAL MARKET CONFIGURATION</legend><div className="ipx-input-grid">
            <LabInput label="IPX TOTAL SUPPLY" value={form.totalSupply} onChange={(value) => update('totalSupply', value)} /><LabInput label="IPX CIRCULATING" value={form.circulatingSupply} onChange={(value) => update('circulatingSupply', value)} /><LabInput label="PLTR PER IPX" value={form.price} onChange={(value) => update('price', value)} />
            <LabInput label="PLTR IN IPX / PLTR LP" value={form.pltrLp} onChange={(value) => update('pltrLp', value)} /><LabInput label="IPX IN IPX / PLTR LP" value={form.ipxLp} onChange={(value) => update('ipxLp', value)} /><LabInput label="SEPARATE PLTR RESERVE" value={form.reserve} onChange={(value) => update('reserve', value)} />
            <LabInput label="LOWER TICK" value={form.tickLower} onChange={(value) => update('tickLower', value)} /><LabInput label="UPPER TICK" value={form.tickUpper} onChange={(value) => update('tickUpper', value)} /><LabInput label="V4 FEE / TICK SPACING" value={`${form.fee} / ${form.tickSpacing}`} readOnly />
          </div><details><summary>EXECUTION TOPOLOGY</summary><div className="ipx-topology"><label><input type="checkbox" checked={form.usdg} onChange={(event) => update('usdg', event.target.checked)} /> USDG EXECUTION MARKET</label><label><input type="checkbox" checked={form.weth} onChange={(event) => update('weth', event.target.checked)} /> WETH EXECUTION MARKET</label><LabInput label="PLTR CAPITAL %" value={form.pltrCapital} onChange={(value) => update('pltrCapital', value)} /><LabInput label="USDG CAPITAL %" value={form.usdgCapital} onChange={(value) => update('usdgCapital', value)} /><LabInput label="WETH CAPITAL %" value={form.wethCapital} onChange={(value) => update('wethCapital', value)} /></div></details></fieldset>
          <button className="ipx-simulate" disabled={pending}>{pending ? 'SIMULATING FROZEN WORLD…' : 'SIMULATE'}<span aria-hidden="true">→</span></button>
        </form>{error && <div role="alert" className="ipx-lab-error"><b>SIMULATION REJECTED</b><span>{error}</span></div>}
      </section>
      {result && <section className="ipx-results" aria-live="polite">
        <div className="ipx-result-head"><div><span>DETERMINISTIC RECORD</span><h2>{result.configuration.architecture.replaceAll('_', ' ')}</h2></div><code>{result.simulation_id}</code></div>
        <div className="ipx-metric-grid"><Metric label="PLTR FOOTPRINT" value={`${footprint.total_pltr_units} PLTR`} note={`$${footprint.usd_reference_value} REFERENCE`} /><Metric label="CONCENTRATION" value={`${footprint.canonical_supply_pct}%`} note={footprint.reference_band} /><Metric label="MAX STRESS IMPACT" value={`${maxImpact?.toFixed(2)}%`} note="HIGHER IMPACT IS RISK" /><Metric label="DRAFT VERDICT" value={verdict.verdict} note="NOT LAUNCH AUTHORIZATION" tone={verdict.verdict} /></div>
        <ResultSection title="MARKET IMPACT" subtitle="SYMMETRIC STANDARDIZED STRESS"><TradeTable buys={result.result.trade_impact.buys} sells={result.result.trade_impact.sells} /></ResultSection>
        <div className="ipx-split"><ResultSection title="SUPPLY STRESS" subtitle="DENOMINATOR ONLY"><StressList rows={result.result.supply_stress} primary="scenario" secondary="first_party_concentration_pct" suffix="%" /></ResultSection><ResultSection title="BASIS STRESS" subtitle="RELATIVE VALUE CONTEXT"><StressList rows={result.result.basis_stress} primary="scenario_bps" secondary="ipx_implied_usd" prefix="$" /></ResultSection></div>
        <div className="ipx-split"><ResultSection title="PLTR PRICE STRESS" subtitle="NOT A PREDICTION"><StressList rows={result.result.price_stress} primary="scenario" secondary="ipx_implied_usd" prefix="$" /></ResultSection><ResultSection title="SESSION STRESS" subtitle="NO PRICE MOVE INVENTED"><div className="ipx-stress-list">{result.result.session_stress.map((row: any) => <div key={row.session}><b>{row.session}</b><span>{row.simulation_confidence}</span></div>)}</div></ResultSection></div>
        <ResultSection title="CAPITAL VS FLOW" subtitle="CAPITAL IS NOT FLOW"><div className="ipx-flow-grid">{result.result.capital_vs_flow.map((row: any) => <article key={row.scenario}><b>{row.scenario.replaceAll('_', ' ')}</b><span>{row.pltr_capital_share_pct}% CAPITAL / {row.pltr_flow_share_pct}% FLOW</span><p>{row.assessment}</p></article>)}</div></ResultSection>
        <ResultSection title="RANGE STATE" subtitle="NOMINAL LIQUIDITY CAN BECOME INACTIVE"><div className="ipx-range-grid">{result.result.range_stress.map((row: any) => <article key={row.scenario}><small>{row.scenario.replaceAll('_', ' ')}</small><b>{row.active_liquidity === '0' ? 'INACTIVE' : 'ACTIVE'}</b><span>{row.total_pltr_principal} PLTR · {row.total_ipx_principal} IPX</span></article>)}</div></ResultSection>
        <ResultSection title="DRAFT VERDICT // WHY" subtitle="INSPECTABLE · DETERMINISTIC · NO OVERRIDE"><div className={`ipx-verdict verdict-${verdict.verdict}`}><b>{verdict.verdict}</b><p>DRAFT_SIMULATION_VERDICT. This is not launch authorization.</p></div><ul className="ipx-reasons">{verdict.triggered_rules.map((rule: string) => <li key={rule}>{rule}</li>)}</ul></ResultSection>
        <ResultSection title="EXPOSURE TRUTH" subtitle="REUSABLE DISCLOSURE"><dl className="ipx-truth">{Object.entries(result.result.exposure_truth).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl></ResultSection>
        <footer><span>{result.record_type} · IMMUTABLE</span><span>SNAPSHOT {result.state_snapshot_id}</span><span>NO WALLET · NO SIGNER · NO TRANSACTION</span></footer>
      </section>}
    </main>
  </div>;
}

function LabInput({ label, value, onChange, readOnly = false }: { label: string; value: string; onChange?: (value: string) => void; readOnly?: boolean }) { return <label className="ipx-lab-input"><span>{label}</span><input value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} /></label>; }
function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) { return <article className={`ipx-metric ${tone ? `tone-${tone}` : ''}`}><span>{label}</span><b>{value}</b><small>{note}</small></article>; }
function ResultSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="ipx-result-section"><header><span>{subtitle}</span><h3>{title}</h3></header>{children}</section>; }
function StressList({ rows, primary, secondary, prefix = '', suffix = '' }: { rows: any[]; primary: string; secondary: string; prefix?: string; suffix?: string }) { return <div className="ipx-stress-list">{rows.map((row) => <div key={String(row[primary])}><b>{String(row[primary])}{primary.includes('bps') ? ' BPS' : ''}</b><span>{prefix}{row[secondary]}{suffix}</span></div>)}</div>; }
function TradeTable({ buys, sells }: { buys: any[]; sells: any[] }) { return <div className="ipx-trade-table"><div className="ipx-trade-head"><span>STRESS</span><span>BUY IMPACT</span><span>SELL IMPACT</span><span>RANGE</span></div>{buys.map((buy, index) => <div key={buy.notional_usd}><b>${Number(buy.notional_usd).toLocaleString()}</b><span>{buy.price_impact_pct}%</span><span>{sells[index].price_impact_pct}%</span><small>{buy.exceeds_modeled_market_support || sells[index].exceeds_modeled_market_support ? 'SUPPORT EXCEEDED' : `${Math.max(buy.ticks_crossed, sells[index].ticks_crossed)} TICKS`}</small></div>)}</div>; }

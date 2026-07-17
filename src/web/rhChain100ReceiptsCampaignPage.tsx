import React, { useEffect, useState } from 'react';
import type { RhChain100ReceiptsCampaign } from '../data/rhChain100Receipts';
import { RH_CHAIN_100_RECEIPTS_ROUTE } from '../data/rhChain100Receipts';
import { resolveRhChainContractIntelligence } from '../services/rhChainContractIntelligenceService';
import { fetchRhChain, RhChainHero, type RhChainEnvelope, RhChainRouteState, RhChainSuiteNav } from './rhChainUi';

const label = (value: string) => value.replaceAll('_', ' ');

export function RhChain100ReceiptsCampaignPage() {
  const [envelope, setEnvelope] = useState<RhChainEnvelope<RhChain100ReceiptsCampaign> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    return fetchRhChain<RhChain100ReceiptsCampaign>('/v1/rh-chain/campaigns/100-receipts').then(setEnvelope).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'campaign_unavailable'));
  };

  useEffect(() => {
    document.title = '100 Tokens. 100 Receipts. | Infopunks';
    void load();
  }, []);

  const campaign = envelope?.data ?? null;
  return <div className="shell narrative-shell rh-chain-shell campaign-shell">
    <a className="skip-link" href="#campaign-content">Skip to content</a>
    <header className="site-header"><RhChainSuiteNav current={RH_CHAIN_100_RECEIPTS_ROUTE} /></header>
    <main id="campaign-content" className="narrative-page rh-chain-page campaign-page">
      {error && <RhChainRouteState state="unavailable" detail={error} onRetry={() => void load()} />}
      {!campaign && !error && <RhChainRouteState state="loading" />}
      {campaign && envelope && <>
        <RhChainHero
          eyebrow="RH Chain / Day 1 / Batch 001"
          title={campaign.title}
          copy={campaign.batch.theme}
          line={`${campaign.batch.reviewed_count} reviewed · ${campaign.batch.total_reviewed_count} total memory`}
          envelope={envelope}
          disclaimer={campaign.disclaimer}
          primaryCta={{ href: '#daily-top-5', label: 'Open Daily Top 5' }}
          secondaryCta={{ href: '/rh-chain-signal-desk/4663-index', label: 'Open 4663 context' }}
        />

        <section className="campaign-batch-strip" aria-label="Campaign batch metadata">
          <p><span>batch_id</span><strong>{campaign.batch.batch_id}</strong></p>
          <p><span>day</span><strong>{campaign.batch.day_number}</strong></p>
          <p><span>reviewed</span><strong>{campaign.batch.reviewed_count}</strong></p>
          <p><span>total reviewed</span><strong>{campaign.batch.total_reviewed_count}</strong></p>
        </section>

        <section id="daily-top-5" className="campaign-section" aria-label="Campaign Daily Top 5">
          <div className="rh-chain-section-head"><div><p className="section-kicker">Daily Top 5</p><h2>Five roles. Five exact contracts.</h2><p>Each card opens the matching Token Dossier and carries reviewed campaign memory into 4663 context.</p></div></div>
          <div className="campaign-top-grid">
            {campaign.daily_top_5.map((item) => { const intelligence = resolveRhChainContractIntelligence(item.contract); return <article key={item.role} className="campaign-top-card" data-role={item.role}>
              <p className="section-kicker">{item.role}</p>
              <h3>{item.ticker}</h3>
              <p className="campaign-contract">{item.contract}</p>
              <p className="panel-caption">Resolver: {label(intelligence.source)} · {label(intelligence.review_status)}</p>
              <a className="execute compact secondary" href={item.dossier_route}>Open Token Dossier</a>
            </article>; })}
          </div>
        </section>

        <section className="campaign-section" aria-label="Batch 001 reviewed assets">
          <div className="rh-chain-section-head"><div><p className="section-kicker">Batch 001</p><h2>Reviewed campaign memory</h2><p>{campaign.source_policy}</p></div><a className="execute compact secondary" href="/v1/rh-chain/campaigns/100-receipts">Campaign JSON</a></div>
          <div className="campaign-asset-grid">
            {campaign.assets.map((asset) => { const intelligence = resolveRhChainContractIntelligence(asset.contract); return <article key={asset.contract} className="campaign-asset-card" data-ticker={asset.ticker}>
              <div className="campaign-card-head"><div><p className="section-kicker">{label(asset.evidence_state)}</p><h3>{asset.ticker}</h3></div><span>{label(asset.classification)}</span></div>
              <p className="campaign-contract">{asset.contract}</p>
              <p className="panel-caption">Resolver: {label(intelligence.source)} · claims {label(intelligence.claim_status)}</p>
              <p>{asset.classification_note}</p>
              <dl>
                <div><dt>risk_state</dt><dd>{asset.risk_state}</dd></div>
                <div><dt>launch surface</dt><dd>{asset.launch_surface}</dd></div>
                <div><dt>reviewed_at</dt><dd>{asset.reviewed_at}</dd></div>
                <div><dt>outcome_check_due_at</dt><dd>{asset.outcome_check_due_at}</dd></div>
                <div><dt>seven_day_outcome</dt><dd>{asset.seven_day_outcome}</dd></div>
                <div><dt>attribution</dt><dd>{asset.attribution}</dd></div>
              </dl>
              <div className="campaign-outcome-check"><p className="section-kicker">7-day outcome check</p><ul>{asset.outcome_check_questions.map((question) => <li key={question}>{question}</li>)}</ul></div>
              <p className="panel-caption"><b>Missing evidence:</b> {asset.missing_evidence.join(' · ')}</p>
              <div className="campaign-source-links">
                {asset.source_links.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
                {asset.website_or_x && <span>{asset.website_or_x}</span>}
              </div>
              <a className="execute compact" href={asset.dossier_route}>Open {asset.ticker} Dossier</a>
            </article>; })}
          </div>
        </section>

        <section className="campaign-section campaign-policy" aria-label="Campaign memory policy"><p>{campaign.disclaimer}</p><p>Exact-contract campaign memory outranks provider-only context. Seven-day outcomes remain pending until the follow-up review is recorded.</p></section>
      </>}
    </main>
  </div>;
}

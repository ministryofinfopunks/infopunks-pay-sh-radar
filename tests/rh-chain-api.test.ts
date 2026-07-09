import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { calculateRhChain4663SignalScore, classifyRhChain4663SignalScore, getRhChainPayload, sortRhChainDailyReceiptsByDate } from '../src/data/rhChain';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('RH Chain Signal Desk API', () => {
  it('keeps source metadata on RH Chain metrics and signature objects', () => {
    const desk = getRhChainPayload();
    const sources = [
      ...desk.chain_pulse.metrics.map((metric) => metric.source),
      ...desk.chain_pulse.top_protocols.map((protocol) => protocol.source),
      ...desk.meme_pulse.map((asset) => asset.source),
      ...desk.signal_classifier.map((signal) => signal.source),
      ...desk.risk_wall.map((risk) => risk.source),
      ...desk.stock_token_spillover_map.map((theme) => theme.source),
      ...desk.signal_index_4663.map((asset) => asset.source),
      ...desk.receipts.map((receipt) => receipt.source_metadata)
    ];

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => (
      Boolean(source.source_name)
      && Boolean(source.observed_at)
      && Boolean(source.updated_at)
      && ['seeded', 'manual', 'cached', 'live_future'].includes(source.data_mode)
      && ['low', 'medium', 'high'].includes(source.confidence_level)
    ))).toBe(true);
  });

  it('sorts daily RH Chain receipts by date and generated timestamp', () => {
    const sorted = sortRhChainDailyReceiptsByDate([
      {
        receipt_id: 'older',
        date: '2026-07-07',
        generated_at: '2026-07-07T22:00:00.000Z',
        chain: 'Robinhood Chain',
        headline: 'older',
        summary: 'older',
        top_signal: 'older',
        biggest_risk: 'older',
        strongest_narrative: 'older',
        liquidity_note: 'older',
        stock_token_spillover_note: 'older',
        solana_base_migration_note: 'older',
        deployer_watch_note: 'older',
        infopunks_verdict: 'older',
        watchlist: [],
        do_not_touch_yet: [],
        sources: [{
          name: 'seed',
          source_name: 'seed',
          observed_at: '2026-07-07T22:00:00.000Z',
          updated_at: '2026-07-07T22:00:00.000Z',
          url: null,
          source_url: null,
          note: 'seed',
          data_mode: 'seeded',
          confidence_level: 'low'
        }],
        confidence_level: 'low',
        status: 'seeded',
        data_mode: 'seeded'
      },
      {
        receipt_id: 'newer',
        date: '2026-07-09',
        generated_at: '2026-07-09T04:45:00.000Z',
        chain: 'Robinhood Chain',
        headline: 'newer',
        summary: 'newer',
        top_signal: 'newer',
        biggest_risk: 'newer',
        strongest_narrative: 'newer',
        liquidity_note: 'newer',
        stock_token_spillover_note: 'newer',
        solana_base_migration_note: 'newer',
        deployer_watch_note: 'newer',
        infopunks_verdict: 'newer',
        watchlist: [],
        do_not_touch_yet: [],
        sources: [{
          name: 'manual',
          source_name: 'manual',
          observed_at: '2026-07-09T04:45:00.000Z',
          updated_at: '2026-07-09T04:45:00.000Z',
          url: null,
          source_url: null,
          note: 'manual',
          data_mode: 'manual',
          confidence_level: 'medium'
        }],
        confidence_level: 'medium',
        status: 'manual',
        data_mode: 'manual'
      }
    ]);

    expect(sorted.map((receipt) => receipt.receipt_id)).toEqual(['newer', 'older']);
    expect(sorted.every((receipt) => receipt.sources.every((source) => source.observed_at))).toBe(true);
  });

  it('serves the daily RH Chain receipts feed', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/rh-chain/daily-receipts'
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual(expect.objectContaining({
        data: expect.any(Object),
        meta: expect.objectContaining({
          source_policy: expect.any(String),
          live_indexing_enabled: false,
          provider_status: expect.arrayContaining([
            expect.objectContaining({ provider_name: 'DefiLlama', data_mode: 'live_future', live_indexing_enabled: false }),
            expect.objectContaining({ provider_name: 'DexScreener', data_mode: 'live_future', live_indexing_enabled: false }),
            expect.objectContaining({ provider_name: 'CoinGecko', data_mode: 'live_future', live_indexing_enabled: false })
          ])
        }),
        sources: expect.any(Array),
        generated_at: '2026-07-09T03:45:00.000Z',
        data_mode: 'manual',
        disclaimer: 'Daily RH Chain receipts are public intelligence memory, not financial advice, endorsement, listing, or official Robinhood partnership.'
      }));
      expect(body.sources.length).toBeGreaterThan(0);
      expect(body.sources.every((source: Record<string, unknown>) => (
        typeof source.source_name === 'string'
        && typeof source.observed_at === 'string'
        && typeof source.updated_at === 'string'
        && ['seeded', 'manual', 'cached', 'live_future'].includes(String(source.data_mode))
        && ['low', 'medium', 'high'].includes(String(source.confidence_level))
      ))).toBe(true);
      expect(body.data).toEqual(expect.objectContaining({
        title: 'Daily RH Chain Receipts',
        subtitle: 'The market forgets. Infopunks keeps the memory.',
        disclaimer: 'Daily RH Chain receipts are public intelligence memory, not financial advice, endorsement, listing, or official Robinhood partnership.'
      }));
      expect(body.data.latest_receipt).toEqual(expect.objectContaining({
        receipt_id: 'rh_daily_2026_07_09',
        top_signal: 'ROUTE',
        confidence_level: 'medium',
        status: 'manual',
        data_mode: 'manual'
      }));
      expect(body.data.latest_receipt.sources[0]).toEqual(expect.objectContaining({
        name: 'Infopunks RH Chain Signal Desk seed',
        source_name: 'Infopunks RH Chain Signal Desk seed',
        observed_at: '2026-07-09T03:45:00.000Z',
        data_mode: 'manual',
        confidence_level: 'medium'
      }));
      expect(body.data.receipts.map((receipt: { receipt_id: string }) => receipt.receipt_id)).toEqual([
        'rh_daily_2026_07_09',
        'rh_daily_2026_07_08',
        'rh_daily_2026_07_07'
      ]);
    } finally {
      await app.close();
    }
  });

  it('classifies 4663 Signal Index scores by public methodology thresholds', () => {
    expect(classifyRhChain4663SignalScore(100)).toBe('durable_signal');
    expect(classifyRhChain4663SignalScore(80)).toBe('durable_signal');
    expect(classifyRhChain4663SignalScore(79)).toBe('strong_watch');
    expect(classifyRhChain4663SignalScore(65)).toBe('strong_watch');
    expect(classifyRhChain4663SignalScore(64)).toBe('active_speculation');
    expect(classifyRhChain4663SignalScore(50)).toBe('active_speculation');
    expect(classifyRhChain4663SignalScore(49)).toBe('high_risk_attention');
    expect(classifyRhChain4663SignalScore(35)).toBe('high_risk_attention');
    expect(classifyRhChain4663SignalScore(34)).toBe('do_not_touch_yet');
  });

  it('calculates 4663 Signal Index scores with component caps', () => {
    expect(calculateRhChain4663SignalScore({
      attention_score: 99,
      volume_score: 99,
      holder_score: 99,
      durability_score: 99,
      deployer_trust_score: 99
    })).toBe(100);
    expect(calculateRhChain4663SignalScore({
      attention_score: 19,
      volume_score: 10,
      holder_score: 8,
      durability_score: 12,
      deployer_trust_score: 2
    })).toBe(51);
  });

  it('serves the 4663 Signal Index payload', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/rh-chain/4663-index'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        name: '4663 Signal Index',
        subtitle: 'A living index of Robinhood Chain attention assets, risk states, and narrative mutations.',
        disclaimer: 'The 4663 Signal Index is an intelligence index, not a tokenized product, endorsement, listing, or financial recommendation.'
      }));
      expect(response.json().data.scoring_model).toEqual({
        total_score: 100,
        attention_score: 25,
        volume_score: 25,
        holder_score: 20,
        durability_score: 20,
        deployer_trust_score: 10
      });
      expect(response.json().data.assets[0]).toEqual(expect.objectContaining({
        rank: 1,
        ticker: 'ROUTE',
        signal_score: 60,
        classification: 'active_speculation',
        source_notes: expect.arrayContaining([
          'Approved for intelligence tracking only, not safety, listing, or buy interpretation.'
        ])
      }));
      expect(response.json().data.narrative_classes).toEqual(expect.arrayContaining([
        'mascot_meta',
        'stock_token_spillover',
        'robinhood_brand_mutation',
        'solana_rotation',
        'ai_native_finance',
        'liquidity_mirage',
        'deployer_cluster_risk'
      ]));
    } finally {
      await app.close();
    }
  });

  it('serves the public RH Chain review queue grouped by state', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/rh-chain/review-queue'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        disclaimer: 'The review queue is public intelligence infrastructure. It is not an endorsement, listing, partnership, or financial recommendation.',
        review_states: expect.arrayContaining([
          'queued_for_manual_review',
          'under_receipt_check',
          'needs_more_evidence',
          'watch_only',
          'approved_signal',
          'do_not_touch_yet',
          'rejected_low_receipt_quality'
        ])
      }));
      expect(response.json().data.counts).toEqual(expect.objectContaining({
        queued: 1,
        under_receipt_check: 1,
        approved_signals: 1,
        do_not_touch_yet: 1,
        rejected_low_receipt_quality: 1
      }));
      expect(response.json().data.grouped.approved_signal[0]).toEqual(expect.objectContaining({
        ticker: 'ROUTE',
        review_state: 'approved_signal',
        source_type: 'manual_research',
        infopunks_verdict: 'Approved signal for desk indexing only. This does not mean safe to buy.'
      }));
    } finally {
      await app.close();
    }
  });

  it('queues RH Chain signal submissions for manual review', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/rh-chain/signals/submit',
        payload: {
          token_contract: '0xabc123',
          ticker: 'hood',
          chain: 'Robinhood Chain',
          x_twitter_link: 'https://x.com/example/status/1',
          website_link: '',
          liquidity_link: '',
          deployer_notes: '',
          submitter_notes: 'Receipts before attention.',
          disclosure_confirmed: true
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.review_packet).toEqual(expect.objectContaining({
        token_contract: '0xabc123',
        ticker: 'HOOD',
        chain: 'Robinhood Chain',
        disclosure_confirmed: true,
        review_status: 'queued_for_manual_review',
        next_step: 'Infopunks will review the signal manually before adding it to the public desk.'
      }));
      expect(response.json().data.review_packet.links).toEqual({
        x_twitter: 'https://x.com/example/status/1',
        website: null,
        liquidity: null
      });
      expect(response.json().data.review_packet.submission_id).toMatch(/^rh-chain-hood-\d{14}$/);
    } finally {
      await app.close();
    }
  });

  it('rejects submissions without receipt fields and disclosure', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/rh-chain/signals/submit',
        payload: {
          token_contract: '0xabc123',
          ticker: 'HOOD',
          chain: 'Robinhood Chain',
          disclosure_confirmed: false
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('invalid_request');
      expect(response.json().issues.map((issue: { message: string }) => issue.message)).toEqual(expect.arrayContaining([
        'disclosure_must_be_confirmed',
        'at_least_one_receipt_or_deployer_note_required'
      ]));
    } finally {
      await app.close();
    }
  });
});

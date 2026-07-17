import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { calculateRhChain4663SignalScore, classifyRhChain4663SignalScore, getRhChainPayload, sortRhChainDailyReceiptsByDate } from '../src/data/rhChain';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { createRhChainSignalSubmission, InMemoryRhChainSubmissionStore, reviewRhChainSubmission, updateRhChainSubmissionReviewRecord } from '../src/services/rhChainSignalVault';

describe('RH Chain Signal Desk API', () => {
  it('rejects placeholder contract identities with the standard RH Chain envelope', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: new InMemoryRhChainSubmissionStore() });
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: { token_contract: 'unverified_contract_required', ticker: 'UNKNOWN', liquidity_link: 'https://example.com/pair', disclosure_confirmed: true } });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(expect.objectContaining({ data: null, error: 'invalid_request', meta: expect.objectContaining({ source_policy: expect.any(String) }), sources: expect.any(Array), generated_at: expect.any(String), data_mode: expect.any(String), disclaimer: expect.any(String) }));
      expect(JSON.stringify(response.json().issues)).toContain('exact_non_placeholder_contract_required');
    } finally { await app.close(); }
  });

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
    expect(desk.signal_classifier.map((signal) => signal.label)).toEqual(expect.arrayContaining([
      'rwa_narrative_reassertion',
      'agentic_economy_signal',
      'meme_rwa_divergence'
    ]));
    expect(desk.stock_token_spillover_map).toEqual(expect.arrayContaining([
      expect.objectContaining({ finance_theme: 'Leadership RWA Reassertion' })
    ]));
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
        generated_at: '2026-07-17T00:00:00.000Z',
        data_mode: 'manual',
        disclaimer: 'Daily RH Chain receipts are public intelligence memory, not financial advice, endorsement, listing, or official Robinhood partnership.'
      }));
      expect(body.data.latest_receipt).toEqual(expect.objectContaining({ receipt_id: 'rh_daily_005' }));
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
        doctrine: 'External data gives context. Infopunks gives judgment. Receipts create memory.',
        disclaimer: 'Daily RH Chain receipts are public intelligence memory, not financial advice, endorsement, listing, or official Robinhood partnership.'
      }));
      expect(body.data.latest_receipt).toEqual(expect.objectContaining({
        receipt_id: 'rh_daily_005',
        receipt_type: 'daily_market_memory',
        period: 'July 16 → July 17, 2026 UTC',
        top_signal: 'Leadership messaging is pulling attention back toward programmable assets, tokenized finance, and agentic activity while meme volume remains the chain’s visible engine',
        confidence_level: 'medium',
        status: 'manual',
        data_mode: 'manual'
      }));
      expect(body.data.latest_receipt.sources[0]).toEqual(expect.objectContaining({
        name: 'Infopunks manual RH Chain narrative and liquidity watch',
        source_name: 'Infopunks manual RH Chain narrative and liquidity watch',
        observed_at: '2026-07-17T00:00:00.000Z',
        data_mode: 'manual',
        confidence_level: 'medium'
      }));
      expect(body.data.latest_receipt).toEqual(expect.objectContaining({
        observed_at: expect.any(String),
        source_notes: expect.any(String),
        manual_context: expect.any(String),
        receipt_sections: expect.arrayContaining([
          expect.objectContaining({ section_id: 'chain_pulse' }),
          expect.objectContaining({ section_id: 'meme_pulse' }),
          expect.objectContaining({ section_id: 'leadership_narrative_pulse' }),
          expect.objectContaining({ section_id: 'launchpad_stress_test' }),
          expect.objectContaining({ section_id: 'risk_wall' }),
          expect.objectContaining({ section_id: 'narrative_mutation' }),
          expect.objectContaining({ section_id: 'infopunks_verdict' })
        ])
      }));
      expect(body.data.receipts.map((receipt: { receipt_id: string }) => receipt.receipt_id)).toEqual([
        'rh_daily_005',
        'rh_daily_004',
        'rh_daily_003',
        'rh_daily_002',
        'rh_daily_001',
        'rh_daily_2026_07_09',
        'rh_daily_2026_07_08',
        'rh_daily_2026_07_07'
      ]);
    } finally {
      await app.close();
    }
  });

  it('serves Today on 4663 with a static manual fallback when receipt storage is unavailable', async () => {
    const unavailableReceiptStore = {
      adapter: 'memory' as const,
      durable: false,
      async saveDraft() { throw new Error('storage_unavailable'); },
      async getDraft() { throw new Error('storage_unavailable'); },
      async listDrafts() { throw new Error('storage_unavailable'); },
      async savePublished() { throw new Error('storage_unavailable'); },
      async publishedReceipts() { throw new Error('storage_unavailable'); }
    };
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainDailyReceiptDraftStore: unavailableReceiptStore });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/today-on-4663' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        title: 'Today on 4663',
        data_mode: 'manual_fallback',
        freshness_state: 'source_required',
        storage_status: 'unavailable',
        latest_receipt: expect.objectContaining({ receipt_id: 'rh_daily_005' }),
        cards: expect.arrayContaining([
          expect.objectContaining({ title: 'Top Signal' }),
          expect.objectContaining({ title: 'Biggest Risk' }),
          expect.objectContaining({ title: 'Latest Receipt' }),
          expect.objectContaining({ title: 'Highest Attention Move' })
        ])
      }));
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
          launch_source: 'noxa_fun',
          launch_surface_url: 'https://example.com/launch/hood',
          pair_address: '0xpair123',
          deployer_address: '0xdeployer123',
          lp_status_claim: 'locked_claimed',
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
      expect(response.json().data.submission).toEqual(expect.objectContaining({
        source_type: 'community_submission',
        data_mode: 'community_submission',
        review_status: 'queued_for_manual_review',
        updated_at: expect.any(String),
        audit_events: [expect.objectContaining({ action: 'submitted', to_status: 'queued_for_manual_review' })]
      }));
      expect(response.json().data.submission.launch_context).toEqual(expect.objectContaining({ launch_source: 'noxa_fun', pair_address: '0xpair123', lp_status: 'locked_claimed', contract_verified: 'unknown', confidence_level: 'low' }));
    } finally {
      await app.close();
    }
  });

  it('serves known launch surfaces as manual, source-stamped intelligence', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/launch-surfaces' });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual(expect.objectContaining({ data_mode: 'manual', sources: expect.any(Array), disclaimer: expect.stringContaining('not endorsement') }));
      expect(body.data).toEqual(expect.objectContaining({ title: 'Launch Surface Watch', launch_surfaces: expect.arrayContaining([expect.objectContaining({ id: 'noxa_fun', name: 'NOXA Fun' }), expect.objectContaining({ id: 'unknown_manual' })]), access_surfaces: expect.arrayContaining([expect.objectContaining({ access_surface_name: 'Backpack Wallet', source_status: 'source_required' })]) }));
      expect(body.data.launch_surfaces.every((surface: { source: { observed_at: string } }) => Boolean(surface.source.observed_at))).toBe(true);
      expect(body.data.access_surfaces.every((surface: { observed_at: string; updated_at: string }) => Boolean(surface.observed_at) && Boolean(surface.updated_at))).toBe(true);
    } finally { await app.close(); }
  });

  it('answers Scout queries through read-only receipt memory', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/rh-chain/scout/query', payload: { query: 'What changed in the last 24h?', mode: 'market_pulse' } });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({ answer_type: 'market_pulse', limitations: expect.any(Array), disclaimer: expect.stringContaining('not endorsement'), data_mode: 'manual' }));
    } finally { await app.close(); }
  });

  it('keeps persisted community submissions separate from seeded/manual queue items', async () => {
    const vault = new InMemoryRhChainSubmissionStore();
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: vault });
    try {
      const submitted = await app.inject({
        method: 'POST', url: '/v1/rh-chain/signals/submit', payload: {
          token_contract: '0xvault123', ticker: 'vault', chain: 'Robinhood Chain',
          website_link: 'https://example.com', disclosure_confirmed: true
        }
      });
      const submission = submitted.json().data.submission;
      const queue = await app.inject({ method: 'GET', url: '/v1/rh-chain/review-queue' });
      const queueData = queue.json().data;
      const persistedOnly = await app.inject({ method: 'GET', url: '/v1/rh-chain/signals/submissions' });

      expect(queueData.data_mode).toBe('community_submission');
      expect(queueData.persisted_submission_count).toBe(1);
      expect(queueData.counts.queued).toBe(2);
      expect(queueData.grouped.queued_for_manual_review).toEqual(expect.arrayContaining([
        expect.objectContaining({ review_id: submission.submission_id, source_type: 'community_submission', data_mode: 'community_submission' })
      ]));
      expect(persistedOnly.json().data.submissions).toEqual([expect.objectContaining({ submission_id: submission.submission_id })]);
    } finally { await app.close(); }
  });

  it('updates a stored submission through the non-public manual review service and records an audit event', async () => {
    const vault = new InMemoryRhChainSubmissionStore();
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: vault });
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: {
        token_contract: '0xaudit123', ticker: 'audit', chain: 'Robinhood Chain', deployer_notes: 'Known deployer wallet.', disclosure_confirmed: true
      } });
      const submissionId = response.json().data.submission.submission_id;
      const updated = await reviewRhChainSubmission(vault, submissionId, 'under_receipt_check', 'Explorer receipt requested.');
      expect(updated).toEqual(expect.objectContaining({ review_status: 'under_receipt_check', reviewer_note: 'Explorer receipt requested.' }));
      expect(updated?.audit_events.at(-1)).toEqual(expect.objectContaining({ action: 'status_updated', from_status: 'queued_for_manual_review', to_status: 'under_receipt_check' }));
    } finally { await app.close(); }
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

  it('rejects unsafe or oversized public submission fields', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      for (const website_link of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', 'ftp://example.com/file', 'not a url']) {
        const response = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: { token_contract: '0xsafe', ticker: 'SAFE', website_link, disclosure_confirmed: true } });
        expect(response.statusCode).toBe(400);
        expect(response.json().issues.map((issue: { message: string }) => issue.message)).toContain('must_be_a_valid_https_url');
      }
      const oversized = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: { token_contract: '0x'.padEnd(129, 'a'), ticker: 'T'.repeat(25), website_link: 'https://example.com', submitter_notes: 'x'.repeat(2001), scout_handle: 's'.repeat(65), scout_contact: 's'.repeat(257), disclosure_confirmed: true } });
      expect(oversized.statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it('suppresses duplicate contracts within the configured submission window', async () => {
    const vault = new InMemoryRhChainSubmissionStore();
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: vault });
    try {
      const payload = { token_contract: ' 0xDuplicate ', ticker: 'DUP', chain: 'Robinhood Chain', website_link: 'https://example.com', disclosure_confirmed: true };
      const first = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload });
      const second = await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: { ...payload, token_contract: '0xduplicate' } });
      expect(first.statusCode).toBe(200); expect(second.statusCode).toBe(200);
      expect(second.json().data).toEqual(expect.objectContaining({ duplicate_detected: true, existing_submission_id: first.json().data.submission.submission_id }));
      expect((await vault.list())).toHaveLength(1);
    } finally { await app.close(); }
  });

  it('limits public submit and scout routes with injected test configuration', async () => {
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainPublicRateLimit: { enabled: true, windowMs: 60_000, max: 1 } });
    try {
      const payload = { token_contract: '0xlimited', ticker: 'LIMIT', website_link: 'https://example.com', disclosure_confirmed: true };
      expect((await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/v1/rh-chain/signals/submit', payload: { ...payload, token_contract: '0xsecond' } })).statusCode).toBe(429);
      expect((await app.inject({ method: 'POST', url: '/v1/rh-chain/scout/query', payload: { query: 'What changed?' } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/v1/rh-chain/scout/query', payload: { query: 'What changed?' } })).statusCode).toBe(429);
    } finally { await app.close(); }
  });

  it('does not expose internal reviewer identity on public submission surfaces', async () => {
    const vault = new InMemoryRhChainSubmissionStore();
    const record = createRhChainSignalSubmission({ token_contract: '0xprivacy', ticker: 'PRIV', website_link: 'https://example.com', disclosure_confirmed: true });
    await vault.save(record);
    await updateRhChainSubmissionReviewRecord(vault, record.submission_id, { review_status: 'under_receipt_check', audit_note: 'Internal note.', reviewer_id: 'private-reviewer' });
    const app = await createApp(emptyIntelligenceStore(), undefined, { rhChainSubmissionStore: vault });
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/rh-chain/signals/submissions' });
      expect(JSON.stringify(response.json())).not.toContain('private-reviewer');
    } finally { await app.close(); }
  });
});

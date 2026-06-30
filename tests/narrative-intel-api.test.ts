import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function expectPng(payload: Buffer) {
  expect(payload.length).toBeGreaterThan(24);
  expect(payload.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(payload.readUInt32BE(16)).toBe(1200);
  expect(payload.readUInt32BE(20)).toBe(630);
}

describe('narrative intel api', () => {
  it('returns seeded narrative asset data', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/narratives' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.arrayContaining([
        expect.objectContaining({
          slug: 'black-bull',
          ticker: 'ANSEM',
          name: 'The Black Bull',
          chain: 'Solana',
          signal_source: 'Ansem'
        }),
        expect.objectContaining({
          slug: 'troll',
          ticker: 'TROLL',
          name: 'The Re-Indexed Archetype',
          chain: 'Solana',
          signal_source: 'Community takeover + legacy internet meme archetype'
        })
      ]));

      const detail = await app.inject({ method: 'GET', url: '/v1/narratives/black-bull' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        slug: 'black-bull',
        ticker: 'ANSEM',
        thesis: "The Black Bull has moved beyond pure persona speculation into visible community coordination. Ansem's airdrop strengthens the trench-revival thesis and gives the narrative more distributed cultural surface area. KOL dependency remains high, but the latest evidence improves the desk's confidence that this is a serious Solana attention-market event, not a hollow meme artifact."
      }));
    } finally {
      await app.close();
    }
  });

  it('returns Attention Market Watch index and detail data', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/attention-market-watch' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.objectContaining({
        count: 4,
        verdict_counts: expect.objectContaining({
          supportive_watch: 1
        }),
        signals: expect.arrayContaining([
          expect.objectContaining({
            slug: 'ansem',
            ticker: 'ANSEM',
            evolution_verdict: 'supportive_watch',
            href: '/signals/black-bull'
          }),
          expect.objectContaining({
            slug: 'tjr',
            ticker: 'TJR'
          }),
          expect.objectContaining({
            slug: 'luke',
            ticker: 'LUKE'
          }),
          expect.objectContaining({
            slug: 'superman',
            ticker: 'SUPERMAN'
          })
        ])
      }));

      const detail = await app.inject({ method: 'GET', url: '/v1/attention-market-watch/ansem' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        signal: expect.objectContaining({
          slug: 'ansem',
          evolution_verdict: 'supportive_watch',
          href: '/signals/black-bull',
          receipt_layer: expect.objectContaining({
            evidence_links: expect.arrayContaining(['/signals/black-bull'])
          })
        })
      }));
    } finally {
      await app.close();
    }
  });

  it('returns Attention Market Intake requirements', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/attention-market-watch/intake/requirements' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        requirements: expect.arrayContaining([
          'Identify attention source',
          'Explain why this is more than a ticker wrapped around a face'
        ]),
        default_risk_facets: ['thin_evidence', 'high_reflexivity', 'power_concentration'],
        disclaimer: expect.stringContaining('not an endorsement')
      }));
    } finally {
      await app.close();
    }
  });

  it('validates required Attention Market Intake fields', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/attention-market-watch/intake',
        payload: { ticker: '', name: '', why_it_matters: '' }
      });
      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('returns staged Attention Market Intake submissions with evidence', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/attention-market-watch/intake',
        payload: {
          ticker: 'SAFE',
          name: 'Safe Persona Object',
          chain: 'Solana',
          attention_source_type: 'influencer',
          why_it_matters: 'This attention-market object is entering the trenches and needs evidence review.',
          evidence_links: ['/narratives/attention-market-watch']
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        submission: expect.objectContaining({
          ticker: 'SAFE',
          name: 'Safe Persona Object',
          status: 'staged',
          evidence_links: ['/narratives/attention-market-watch'],
          intake_note: expect.stringContaining('not an endorsement')
        })
      }));
    } finally {
      await app.close();
    }
  });

  it('returns needs_evidence Attention Market Intake submissions without evidence', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/attention-market-watch/intake',
        payload: {
          ticker: 'SAFE',
          name: 'Safe Persona Object',
          why_it_matters: 'This attention-market object needs evidence before watch promotion.'
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.submission).toEqual(expect.objectContaining({
        status: 'needs_evidence',
        default_risk_facets: ['thin_evidence', 'high_reflexivity', 'power_concentration']
      }));
    } finally {
      await app.close();
    }
  });

  it('returns the derived Signal Desk index', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signal-desk' });
      expect(response.statusCode).toBe(200);

      const payload = response.json().data;
      expect(payload.counts).toEqual(expect.objectContaining({
        reports: expect.any(Number),
        dispatches: expect.any(Number),
        risk_shifts: expect.any(Number),
        watched_signals: expect.any(Number)
      }));
      expect(payload.candidate_counts).toEqual(expect.objectContaining({
        total: expect.any(Number),
        queued: expect.any(Number),
        watching: expect.any(Number),
        needs_evidence: expect.any(Number),
        under_review: expect.any(Number),
        promoted_to_report: expect.any(Number)
      }));
      expect(payload.candidate_signals).toEqual(expect.arrayContaining([
        expect.objectContaining({
          candidate_id: expect.any(String),
          name: expect.any(String),
          status: expect.stringMatching(/queued|watching|needs_evidence|under_review|rejected|promoted_to_report/),
          risk_facets: expect.arrayContaining([expect.any(String)])
        }),
        expect.objectContaining({
          candidate_id: 'candidate_troll_reindex',
          ticker: 'TROLL',
          status: 'promoted_to_report'
        })
      ]));
      expect(payload.featured_report).toEqual(expect.objectContaining({
        slug: 'black-bull',
        ticker: 'ANSEM',
        name: 'The Black Bull',
        risk_facets: expect.arrayContaining(['high_reflexivity', 'kol_dependency', 'power_concentration', 'unproven_sovereignty', 'live_watch'])
      }));
      expect(payload.latest_dispatches).toEqual(expect.arrayContaining([
        expect.objectContaining({
          update_id: 'seu_troll_002',
          href: '/signals/troll/updates/seu_troll_002',
          summary: expect.stringContaining('Durable Re-index'),
          risk_facets: expect.arrayContaining(['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'])
        }),
        expect.objectContaining({
          update_id: 'seu_black_bull_006',
          href: '/signals/black-bull/updates/seu_black_bull_006',
          summary: expect.stringContaining('Supportive Watch'),
          risk_facets: expect.arrayContaining(['kol_dependency', 'power_concentration', 'live_watch'])
        })
      ]));
      expect(payload.latest_dispatches[0]).toEqual(expect.objectContaining({
        update_id: 'seu_troll_002',
        new_score: 90
      }));
      expect(payload.risk_shifts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          update_type: 'risk_shift',
          risk_facets: expect.arrayContaining(['high_reflexivity', 'live_watch'])
        }),
        expect.objectContaining({
          update_type: 'verdict_change',
          risk_facets: expect.arrayContaining(['power_concentration', 'live_watch'])
        })
      ]));
      expect(payload.risk_shifts.every((item: { update_type: string }) => ['risk_shift', 'verdict_change', 'holder_shift'].includes(item.update_type))).toBe(true);
      expect(payload.reports).toEqual(expect.arrayContaining([
        expect.objectContaining({
          slug: 'black-bull',
          ticker: 'ANSEM',
          href: '/signals/black-bull',
          risk_facets: expect.arrayContaining(['high_reflexivity'])
        }),
        expect.objectContaining({
          slug: 'troll',
          ticker: 'TROLL',
          href: '/signals/troll',
          verdict_label: 'DURABLE RE-INDEX',
          verdict_state: 'durable_re_index',
          risk_facets: expect.arrayContaining(['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'])
        })
      ]));
      const trollReport = payload.reports.find((item: { slug: string }) => item.slug === 'troll');
      expect(trollReport.risk_facets).not.toContain('kol_dependency');
      expect(payload.desk_activity).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'candidate_promoted',
          title: 'Candidate promoted to report: $TROLL / The Re-Indexed Archetype',
          href: '/signals/troll'
        })
      ]));
    } finally {
      await app.close();
    }
  });

  it('returns seeded candidate signals', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signal-desk/candidates' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        count: expect.any(Number),
        candidates: expect.arrayContaining([
          expect.objectContaining({
            candidate_id: 'candidate_troll_reindex',
            status: 'promoted_to_report',
            risk_facets: expect.arrayContaining(['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration'])
          }),
          expect.objectContaining({
            candidate_id: 'candidate_sol_persona_attention',
            status: 'watching',
            risk_facets: expect.arrayContaining(['kol_dependency', 'live_watch'])
          })
        ])
      }));
    } finally {
      await app.close();
    }
  });

  it('returns one candidate signal by id', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signal-desk/candidates/candidate_sol_persona_attention' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        candidate: expect.objectContaining({
          candidate_id: 'candidate_sol_persona_attention',
          name: 'Next attention market around a major Solana persona',
          risk_facets: expect.arrayContaining(['kol_dependency', 'live_watch'])
        })
      }));
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown candidate ids', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signal-desk/candidates/missing-candidate' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'candidate_signal_not_found' });
    } finally {
      await app.close();
    }
  });

  it('returns seeded signal source and report data', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/signals' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.arrayContaining([
        expect.objectContaining({ slug: 'ansem', type: 'signal_source' }),
        expect.objectContaining({ slug: 'black-bull', type: 'signal_report' }),
        expect.objectContaining({ slug: 'troll', type: 'signal_report' })
      ]));

      const source = await app.inject({ method: 'GET', url: '/v1/signals/ansem' });
      expect(source.statusCode).toBe(200);
      expect(source.json().data).toEqual(expect.objectContaining({
        slug: 'ansem',
        type: 'signal_source',
        signal_source: 'Ansem'
      }));

      const report = await app.inject({ method: 'GET', url: '/v1/signals/black-bull' });
      expect(report.statusCode).toBe(200);
      expect(report.json().data).toEqual(expect.objectContaining({
        slug: 'black-bull',
        type: 'signal_report',
        signal_source: 'Ansem',
        infopunk_verdict: expect.stringContaining('Infopunks supports the Black Bull'),
        verdict_label: 'SUPPORTIVE WATCH',
        verdict_state: 'supportive_watch',
        verdict_copy: expect.stringContaining('Infopunks supports the Black Bull')
      }));
      expect(report.json().data.cards).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'infopunk-verdict',
          score: 'SUPPORTIVE WATCH',
          decision_state: 'supportive_watch'
        }),
        expect.objectContaining({
          id: 'kol-dependency',
          decision_state: 'concentrated_power'
        }),
        expect.objectContaining({
          id: 'holder-power-concentration',
          decision_state: 'concentrated_power'
        })
      ]));
      expect(report.json().data.sections.find((section: { id: string }) => section.id === 'infopunk-verdict').body).not.toMatch(/\bbuy\b|\bsell\b/i);
      expect(report.json().data.cards.length).toBeGreaterThanOrEqual(9);

      const troll = await app.inject({ method: 'GET', url: '/v1/signals/troll' });
      expect(troll.statusCode).toBe(200);
      expect(troll.json().data).toEqual(expect.objectContaining({
        slug: 'troll',
        type: 'signal_report',
        signal_source: 'Community takeover + legacy internet meme archetype',
        infopunk_verdict: expect.stringContaining('Infopunks upgrades $TROLL to Durable Re-index'),
        verdict_label: 'DURABLE RE-INDEX',
        verdict_state: 'durable_re_index',
        verdict_copy: expect.stringContaining('The signal is survival')
      }));
      expect(troll.json().data.cards).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'infopunk-verdict',
          score: 'DURABLE RE-INDEX',
          decision_state: 'durable_re_index'
        }),
        expect.objectContaining({
          id: 'community-surface',
          title: 'Community Surface'
        }),
        expect.objectContaining({
          id: 'archetype-survival',
          title: 'Archetype Survival',
          score: 94
        }),
        expect.objectContaining({
          id: 'holder-power-concentration',
          decision_state: 'concentrated_power'
        })
      ]));
      expect(troll.json().data.sections).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: 'Community Takeover' }),
        expect.objectContaining({ title: 'Holder Surface' })
      ]));
    } finally {
      await app.close();
    }
  });

  it('returns seeded signal evidence updates newest first', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/black-bull/updates' });
      expect(response.statusCode).toBe(200);

      const payload = response.json().data;
      expect(payload.signal_slug).toBe('black-bull');
      expect(payload.count).toBeGreaterThanOrEqual(5);
      expect(payload.summary).toContain('Evidence update summary');
      expect(payload.latest_update).toEqual(expect.objectContaining({
        update_id: 'seu_black_bull_006',
        update_type: 'verdict_change'
      }));
      expect(payload.latest_update.evidence_links).toContain('https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers');
      expect(payload.updates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          update_id: expect.any(String),
          signal_slug: 'black-bull',
          timestamp: expect.any(String),
          update_type: expect.stringMatching(/attention_shift|holder_shift|myth_shift|risk_shift|verdict_change/),
          summary: expect.any(String),
          evidence_links: expect.arrayContaining([expect.any(String)]),
          analyst_note: expect.any(String)
        })
      ]));

      const timestamps = payload.updates.map((update: { timestamp: string }) => update.timestamp);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b.localeCompare(a)));
      expect(payload.updates[0]).toEqual(expect.objectContaining({
        update_id: 'seu_black_bull_006',
        update_type: 'verdict_change',
        previous_score: 80,
        new_score: 88
      }));
    } finally {
      await app.close();
    }
  });

  it('returns one seeded signal evidence update by id', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/black-bull/updates/seu_black_bull_006' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        signal_slug: 'black-bull',
        update: expect.objectContaining({
          update_id: 'seu_black_bull_006',
          signal_slug: 'black-bull',
          update_type: 'verdict_change',
          summary: expect.stringContaining('Supportive Watch'),
          evidence_links: expect.arrayContaining(['https://solscan.io/account/GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52#transfers'])
        })
      }));
    } finally {
      await app.close();
    }
  });

  it('returns the seeded TROLL signal evidence update surfaces', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const updates = await app.inject({ method: 'GET', url: '/v1/signals/troll/updates' });
      expect(updates.statusCode).toBe(200);
      expect(updates.json().data).toEqual(expect.objectContaining({
        signal_slug: 'troll',
        count: 2,
        latest_update: expect.objectContaining({
          update_id: 'seu_troll_002',
          update_type: 'verdict_change',
          new_score: 90
        })
      }));

      const detail = await app.inject({ method: 'GET', url: '/v1/signals/troll/updates/seu_troll_002' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        signal_slug: 'troll',
        update: expect.objectContaining({
          update_id: 'seu_troll_002',
          evidence_links: expect.arrayContaining([
            'https://solscan.io/token/5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2',
            '/signals/troll'
          ]),
          previous_score: 86,
          new_score: 90,
          risk_facets: ['live_watch', 'thin_evidence', 'high_reflexivity', 'power_concentration']
        })
      }));
    } finally {
      await app.close();
    }
  });

  it('serves the narrative OG image route', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/narratives.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.headers['cache-control']).toContain('public');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  }, 10000);

  it('serves the Attention Market Watch OG image routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const index = await app.inject({ method: 'GET', url: '/og/attention-market-watch.png' });
      expect(index.statusCode).toBe(200);
      expect(index.headers['content-type']).toContain('image/png');
      expectPng(index.rawPayload);

      const profile = await app.inject({ method: 'GET', url: '/og/attention-market-watch/ansem.png' });
      expect(profile.statusCode).toBe(200);
      expect(profile.headers['content-type']).toContain('image/png');
      expectPng(profile.rawPayload);
    } finally {
      await app.close();
    }
  }, 10000);

  it('serves the seeded signal report OG image route', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/signals/black-bull.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  }, 10000);

  it('serves the seeded TROLL report and dispatch OG image routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const report = await app.inject({ method: 'GET', url: '/og/signals/troll.png' });
      expect(report.statusCode).toBe(200);
      expect(report.headers['content-type']).toContain('image/png');
      expectPng(report.rawPayload);

      const dispatch = await app.inject({ method: 'GET', url: '/og/signals/troll/updates/seu_troll_002.png' });
      expect(dispatch.statusCode).toBe(200);
      expect(dispatch.headers['content-type']).toContain('image/png');
      expectPng(dispatch.rawPayload);
    } finally {
      await app.close();
    }
  }, 10000);

  it('serves the seeded dispatch permalink OG image route', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/signals/black-bull/updates/seu_black_bull_006.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  }, 10000);

  it('returns 404 for unknown OG update image routes', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/signals/black-bull/updates/missing-update.png' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'og_image_not_found' });
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown signal update requests', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/unknown-signal/updates' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'signal_surface_not_found' });
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown Attention Market Watch profiles', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/attention-market-watch/missing-profile' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'attention_market_signal_not_found' });
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown signal update ids', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/black-bull/updates/missing-update' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'signal_update_not_found' });
    } finally {
      await app.close();
    }
  });
});

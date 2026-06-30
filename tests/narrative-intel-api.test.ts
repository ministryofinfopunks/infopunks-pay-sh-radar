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
        })
      ]));

      const detail = await app.inject({ method: 'GET', url: '/v1/narratives/black-bull' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        slug: 'black-bull',
        ticker: 'ANSEM',
        thesis: '$ANSEM is a live experiment in financialized attention, where persona, meme, wallet flows, and community belief become a tradable signal object.'
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
          update_id: expect.any(String),
          href: expect.stringMatching(/^\/signals\/black-bull\/updates\//),
          risk_facets: expect.arrayContaining([expect.any(String)])
        })
      ]));
      expect(payload.risk_shifts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          update_type: 'risk_shift',
          risk_facets: expect.arrayContaining(['high_reflexivity', 'live_watch'])
        }),
        expect.objectContaining({
          update_type: 'holder_shift',
          risk_facets: expect.arrayContaining(['power_concentration', 'live_watch'])
        }),
        expect.objectContaining({
          update_type: 'verdict_change',
          risk_facets: expect.arrayContaining(['unproven_sovereignty', 'live_watch'])
        })
      ]));
      expect(payload.risk_shifts.every((item: { update_type: string }) => ['risk_shift', 'verdict_change', 'holder_shift'].includes(item.update_type))).toBe(true);
      expect(payload.reports).toEqual(expect.arrayContaining([
        expect.objectContaining({
          slug: 'black-bull',
          ticker: 'ANSEM',
          href: '/signals/black-bull',
          risk_facets: expect.arrayContaining(['high_reflexivity'])
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
        expect.objectContaining({ slug: 'black-bull', type: 'signal_report' })
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
        signal_source: 'Ansem'
      }));
      expect(report.json().data.cards.length).toBeGreaterThanOrEqual(9);
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
        update_id: 'seu_black_bull_005',
        update_type: 'verdict_change'
      }));
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
        update_id: 'seu_black_bull_005',
        update_type: 'verdict_change',
        previous_score: 74,
        new_score: 80
      }));
    } finally {
      await app.close();
    }
  });

  it('returns one seeded signal evidence update by id', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/v1/signals/black-bull/updates/seu_black_bull_005' });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(expect.objectContaining({
        signal_slug: 'black-bull',
        update: expect.objectContaining({
          update_id: 'seu_black_bull_005',
          signal_slug: 'black-bull',
          update_type: 'verdict_change',
          summary: expect.any(String)
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
  });

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
  });

  it('serves the seeded dispatch permalink OG image route', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const response = await app.inject({ method: 'GET', url: '/og/signals/black-bull/updates/seu_black_bull_005.png' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expectPng(response.rawPayload);
    } finally {
      await app.close();
    }
  });

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

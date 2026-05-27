import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const bannedLanguage = [
  'best route',
  'top route',
  'winner route',
  'loser route',
  'superiority proof',
  'ranking authority',
  'guaranteed trust',
  'safest provider',
  'recorded bundle',
  'production briefing'
];

describe('agent spend readiness cards', () => {
  it('returns provider readiness cards derived from existing Radar proof surfaces', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/radar/agent-readiness' });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.count).toBeGreaterThan(0);
    expect(data.cards.length).toBeGreaterThan(0);
    expect(data.winner_claimed).toBe(false);
    expect(data.agent_guidance).toContain('Readiness cards are proof-state diagnostics, not rankings.');

    for (const card of data.cards) {
      expect(card).toHaveProperty('readiness_state');
      expect(card).toHaveProperty('agent_spend_readiness');
      expect(card).toHaveProperty('builder_next_step');
      expect(card).toHaveProperty('share_copy');
      expect(card.winner_claimed).toBe(false);
    }

    expect(data.cards.some((card: { readiness_state: string }) => card.readiness_state === 'recorded_evidence')).toBe(true);
    expect(data.cards.some((card: { readiness_state: string }) => card.readiness_state === 'scaffold_only' || card.readiness_state === 'blocked_or_unclear')).toBe(true);

    const serialized = JSON.stringify(data).toLowerCase();
    for (const phrase of bannedLanguage) expect(serialized).not.toContain(phrase);

    await app.close();
  });

  it('returns detail for known providers and a stable error for unknown providers', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const list = (await app.inject({ method: 'GET', url: '/v1/radar/agent-readiness' })).json().data;
    const knownProvider = list.cards[0].provider_id;

    const detail = await app.inject({ method: 'GET', url: `/v1/radar/agent-readiness/${encodeURIComponent(knownProvider)}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.provider_id).toBe(knownProvider);

    const missing = await app.inject({ method: 'GET', url: '/v1/radar/agent-readiness/not-a-provider' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'provider_readiness_not_found' });

    await app.close();
  });

  it('attaches bundle-run agent readiness summaries only when a card has a matching bundle run proof link', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T21:15:56.919Z'));
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/radar/agent-readiness/paysponge-coingecko' });
      expect(response.statusCode).toBe(200);
      const card = response.json().data;
      expect(card.proof_links.bundle_runs).toContain('/v1/radar/bundles/morning-briefing/runs/morning-briefing-run-2026-05-21-084556-pay-cli');
      expect(card.agent_readiness_summary).toBeTruthy();
      expect(card.agent_readiness_summary.ready_for_agent_review).toBe(true);
      expect(card.agent_readiness_summary.requires_rerun_before_spend).toBe(false);
      expect(card.agent_readiness_summary.requires_human_or_policy_approval).toBe(true);
      expect(card.agent_readiness_summary.observed_cost_available).toBe(false);
      expect(card.agent_readiness_summary.winner_claimed).toBe(false);
      expect(card.agent_readiness_summary.decision_state).toBe('review_ready_caveated');
      expect(card.agent_readiness_summary.review_reasons.length).toBeGreaterThan(0);
      expect(card.agent_readiness_summary.recommended_agent_action).toBe('Inspect latest run detail, skipped review-required steps, and caveats before spend.');

      const list = (await app.inject({ method: 'GET', url: '/v1/radar/agent-readiness' })).json().data;
      const withoutBundleSummary = list.cards.find((row: { proof_links: { bundle_runs: string[] }; agent_readiness_summary?: unknown }) => row.proof_links.bundle_runs.length === 0);
      expect(withoutBundleSummary).toBeTruthy();
      expect(withoutBundleSummary.agent_readiness_summary).toBeUndefined();

      const serialized = JSON.stringify(card).toLowerCase();
      for (const phrase of bannedLanguage) expect(serialized).not.toContain(phrase);
    } finally {
      await app.close();
      vi.useRealTimers();
    }
  });
});

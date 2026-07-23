import { describe, expect, it } from 'vitest';
import {
  RhPulseReadModelSchema,
  type RhPulseConnectionSnapshot
} from '../src/shared/rhPulse';
import {
  RhPulseService,
  selectStrongestRhPulseConnection
} from '../src/services/rhPulseService';

const NOW = new Date('2026-07-23T06:00:00.000Z');

function entry(
  category: 'agent_x_meme' | 'meme_x_rwa' | 'agent_x_rwa',
  suffix: string,
  options: { verified?: boolean; market?: boolean } = {}
) {
  return {
    category,
    contract: `0x${suffix.padStart(40, suffix)}`,
    display_name: `Reviewed ${suffix}`,
    primary_layer: category.startsWith('agent') ? 'agent' : 'meme',
    secondary_layers: [category.endsWith('rwa') ? 'rwa' : 'meme'],
    evidence_state: options.verified === false ? 'source_required_for_claims' : 'reviewed',
    classification_confidence: 'high',
    classification_evidence_summary: options.verified === false ? [] : ['Human-reviewed exact-contract overlap.'],
    conflict_state: 'none',
    reviewed_at: '2026-07-23T05:00:00.000Z',
    freshness: 'fresh',
    market_data: {
      available: options.market ?? true,
      snapshot_timestamp: '2026-07-23T05:30:00.000Z',
      freshness: 'fresh'
    }
  };
}

function reviewedCrossLayer() {
  return {
    entries: [
      entry('agent_x_meme', '1'),
      entry('agent_x_meme', '2'),
      entry('agent_x_meme', '3'),
      entry('agent_x_rwa', '4')
    ],
    captured_at: '2026-07-23T05:45:00.000Z',
    freshness: 'fresh',
    confidence: 'high',
    warnings: [],
    methodology_version: 'cross_layer_intersections_v1'
  };
}

function service(crossLayer: () => Promise<unknown>) {
  return new RhPulseService({
    crossLayer,
    chainPulse: async () => ({
      observed_at: '2026-07-23T05:30:00.000Z',
      freshness_state: 'fresh',
      confidence_level: 'high'
    }),
    memePulse: async () => ({
      refreshed_at: '2026-07-23T05:30:00.000Z',
      freshness_state: 'fresh',
      pulse: { top_attention_assets: [] }
    }),
    launchpad: async () => ({
      refreshed_at: '2026-07-23T05:30:00.000Z',
      data_mode: 'cached'
    }),
    latestReceipt: async () => ({
      receipt_id: 'rh_daily_test',
      observed_at: '2026-07-23T05:00:00.000Z',
      generated_at: '2026-07-23T05:05:00.000Z',
      headline: 'Reviewed RH Chain receipt'
    }),
    now: () => NOW,
    cacheTtlMs: 0
  });
}

function connection(
  id: RhPulseConnectionSnapshot['id'],
  relativeStrength: number | null
): RhPulseConnectionSnapshot {
  return {
    id,
    source_layer: id === 'agents_to_rwas' ? 'agents' : 'memes',
    target_layer: id === 'memes_to_agents' ? 'agents' : 'rwas',
    label: id,
    relative_strength: relativeStrength,
    recent_change: null,
    evidence_type: relativeStrength === null ? 'insufficient_evidence' : 'verified',
    confidence: relativeStrength === null ? 'insufficient' : 'medium',
    freshness: relativeStrength === null ? 'unavailable' : 'live',
    explanation: 'Bounded reviewed evidence.',
    supporting_observation_count: relativeStrength === null ? 0 : 1,
    observed_at: NOW.toISOString(),
    methodology_version: 'rh_pulse_layer_flow_v1',
    source_references: [],
    receipt_references: [],
    under_watch: id === 'agents_to_rwas',
    is_strongest_current_signal: false
  };
}

describe('RhPulseService', () => {
  it('assembles a schema-valid, stable, read-only public model from reviewed shared memory', async () => {
    const model = await service(async () => reviewedCrossLayer()).getReadModel();

    expect(() => RhPulseReadModelSchema.parse(model)).not.toThrow();
    expect(model.generated_at).toBe(NOW.toISOString());
    expect(model.connections.map((item) => item.id)).toEqual([
      'memes_to_agents',
      'memes_to_rwas',
      'agents_to_rwas'
    ]);
    expect(model.current_window).toMatchObject({
      id: 'rh_pulse_preview_24h',
      state: 'preview',
      calls_enabled: false,
      opens_at: null,
      closes_at: null
    });
    expect(model.calls_enabled).toBe(false);
    expect(model.call_options.map((item) => item.id)).toEqual([
      'agents_to_rwas',
      'memes_to_agents',
      'memes_to_rwas',
      'no_qualified_rotation'
    ]);
    expect(JSON.stringify(model)).not.toMatch(/dollar_flow|flow_usd|community_percentage|wallet/i);
  });

  it('derives the strongest measurable signal independently from editorial under-watch treatment', async () => {
    const model = await service(async () => reviewedCrossLayer()).getReadModel();
    const memesToAgents = model.connections.find((item) => item.id === 'memes_to_agents')!;
    const agentsToRwas = model.connections.find((item) => item.id === 'agents_to_rwas')!;

    expect(memesToAgents.relative_strength).toBe(75);
    expect(memesToAgents.is_strongest_current_signal).toBe(true);
    expect(memesToAgents.under_watch).toBe(false);
    expect(agentsToRwas.relative_strength).toBe(25);
    expect(agentsToRwas.is_strongest_current_signal).toBe(false);
    expect(agentsToRwas.under_watch).toBe(true);
    expect(model.strongest_current_signal).toMatchObject({
      state: 'measurable',
      connection_id: 'memes_to_agents'
    });
    expect(model.connection_under_watch).toBe('agents_to_rwas');
  });

  it('degrades to explicit insufficient evidence without inventing strength', async () => {
    const model = await service(async () => {
      throw new Error('shared memory unavailable');
    }).getReadModel();

    expect(model.strongest_current_signal).toMatchObject({
      state: 'insufficient_evidence',
      connection_id: null
    });
    expect(model.connections.every((item) => (
      item.relative_strength === null
      && item.evidence_type === 'insufficient_evidence'
      && item.confidence === 'insufficient'
    ))).toBe(true);
    expect(model.source_health.overall).toBe('unavailable');
    expect(model.source_health.caveats.join(' ')).toContain('cross_layer_memory');
  });

  it('propagates source freshness separately from confidence and evidence strength', async () => {
    const model = await service(async () => reviewedCrossLayer()).getReadModel();
    expect(model.source_health.overall).toBe('live');
    expect(model.source_health.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cross_layer_memory', freshness: 'live' }),
      expect.objectContaining({ id: 'market_snapshot_memory', freshness: 'live' }),
      expect.objectContaining({ id: 'receipt_memory', freshness: 'live' })
    ]));
  });

  it('does not turn unrelated reviewed Cross-Layer categories into Pulse structural claims', async () => {
    const model = await service(async () => ({
      entries: [{
        ...entry('agent_x_meme', '8'),
        category: 'agent_x_defi',
        primary_layer: 'agent',
        secondary_layers: ['defi']
      }],
      captured_at: '2026-07-23T05:45:00.000Z',
      freshness: 'fresh',
      confidence: 'high'
    })).getReadModel();

    expect(model.connections.every((item) => item.relative_strength === null)).toBe(true);
    expect(model.structural_statements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'memes', state: 'Insufficient reviewed overlap' }),
      expect.objectContaining({ id: 'agents', state: 'Reviewed agent evidence remains thin' }),
      expect.objectContaining({ id: 'rwas', state: 'Insufficient reviewed overlap' })
    ]));
  });

  it('withholds a strongest signal on ties instead of breaking them editorially', () => {
    expect(selectStrongestRhPulseConnection([
      connection('memes_to_agents', 50),
      connection('memes_to_rwas', 0),
      connection('agents_to_rwas', 50)
    ])).toMatchObject({ state: 'tied', connectionId: null });
    expect(selectStrongestRhPulseConnection([
      connection('memes_to_agents', null),
      connection('memes_to_rwas', null),
      connection('agents_to_rwas', null)
    ])).toMatchObject({ state: 'insufficient_evidence', connectionId: null });
  });
});

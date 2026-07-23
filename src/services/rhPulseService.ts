import { z } from 'zod';
import {
  RH_PULSE_INDEPENDENCE_DISCLAIMER,
  RH_PULSE_METHODOLOGY_VERSION,
  RhPulseConnectionSnapshotSchema,
  RhPulseMethodologySchema,
  RhPulsePredictionWindowSchema,
  RhPulseReadModelSchema,
  RhPulseSourceHealthSchema,
  type RhPulseConfidence,
  type RhPulseConnectionId,
  type RhPulseConnectionSnapshot,
  type RhPulseFreshness,
  type RhPulseMethodology,
  type RhPulseReadModel,
  type RhPulseSourceHealth
} from '../shared/rhPulse';
import { DEFAULT_PULSE_PUBLIC_HOST, normalizePublicHostname } from '../shared/rhPulseRouting';
import { createRequestDeadline, runWithinDeadline, type DeadlineOutcome } from './requestDeadline';

const CONNECTION_ORDER: RhPulseConnectionId[] = [
  'memes_to_agents',
  'memes_to_rwas',
  'agents_to_rwas'
];

const CONNECTION_DEFINITIONS: Record<RhPulseConnectionId, {
  source_layer: 'memes' | 'agents';
  target_layer: 'agents' | 'rwas';
  label: string;
  categories: string[];
}> = {
  memes_to_agents: {
    source_layer: 'memes',
    target_layer: 'agents',
    label: 'Memes ↔ Agents',
    categories: ['agent_x_meme']
  },
  memes_to_rwas: {
    source_layer: 'memes',
    target_layer: 'rwas',
    label: 'Memes ↔ RWAs',
    categories: ['meme_x_rwa']
  },
  agents_to_rwas: {
    source_layer: 'agents',
    target_layer: 'rwas',
    label: 'Agents ↔ RWAs',
    categories: ['agent_x_rwa']
  }
};

const CrossLayerEntrySchema = z.object({
  category: z.string(),
  contract: z.string().min(1),
  display_name: z.string().nullable().optional(),
  ticker: z.string().nullable().optional(),
  primary_layer: z.string().optional(),
  secondary_layers: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  evidence_state: z.string().optional(),
  classification_confidence: z.enum(['high', 'medium', 'low']).optional(),
  classification_evidence_summary: z.array(z.string()).optional(),
  conflict_state: z.string().optional(),
  reviewed_at: z.string().datetime().nullable().optional(),
  effective_at: z.string().datetime().nullable().optional(),
  market_data_timestamp: z.string().datetime().nullable().optional(),
  freshness: z.enum(['fresh', 'stale', 'partial', 'unavailable']).optional(),
  latest_receipt: z.object({
    receipt_id: z.string(),
    timestamp: z.string().datetime(),
    summary: z.string()
  }).nullable().optional(),
  market_data: z.object({
    available: z.boolean(),
    snapshot_timestamp: z.string().datetime().nullable().optional(),
    freshness: z.enum(['fresh', 'stale', 'partial', 'unavailable']).optional()
  }).passthrough().optional()
}).passthrough();

const CrossLayerPayloadSchema = z.object({
  entries: z.array(CrossLayerEntrySchema),
  captured_at: z.string().datetime().optional(),
  observed_at: z.string().datetime().optional(),
  freshness: z.enum(['fresh', 'stale', 'partial', 'unavailable']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  warnings: z.array(z.string()).optional(),
  methodology_version: z.string().optional()
}).passthrough();

const ChainPulseSnapshotSchema = z.object({
  observed_at: z.string().datetime(),
  freshness_state: z.enum(['fresh', 'stale', 'source_required', 'unavailable']),
  confidence_level: z.enum(['high', 'medium', 'low'])
}).passthrough();

const MemePulseSnapshotSchema = z.object({
  refreshed_at: z.string().datetime(),
  freshness_state: z.enum(['fresh', 'stale', 'source_required', 'unavailable']),
  pulse: z.object({
    top_attention_assets: z.array(z.object({
      context_origin: z.string().optional()
    }).passthrough()).optional()
  }).passthrough().optional()
}).passthrough();

const LaunchpadSnapshotSchema = z.object({
  refreshed_at: z.string().datetime(),
  data_mode: z.enum(['manual', 'cached'])
}).passthrough();

const ReceiptSchema = z.object({
  receipt_id: z.string().min(1),
  observed_at: z.string().datetime().optional(),
  generated_at: z.string().datetime(),
  headline: z.string().min(1)
}).passthrough();

type CrossLayerPayload = z.infer<typeof CrossLayerPayloadSchema>;
type CrossLayerEntry = z.infer<typeof CrossLayerEntrySchema>;

export type RhPulseServiceOptions = {
  crossLayer: () => Promise<unknown>;
  chainPulse?: () => Promise<unknown>;
  memePulse?: () => Promise<unknown>;
  launchpad?: () => Promise<unknown>;
  latestReceipt?: () => Promise<unknown> | unknown;
  currentWindow?: () => Promise<unknown>;
  callsEnabled?: boolean;
  publicHost?: string;
  now?: () => Date;
  readTimeoutMs?: number;
  cacheTtlMs?: number;
};

type ReadContext = {
  crossLayer: CrossLayerPayload | null;
  chainPulse: z.infer<typeof ChainPulseSnapshotSchema> | null;
  memePulse: z.infer<typeof MemePulseSnapshotSchema> | null;
  launchpad: z.infer<typeof LaunchpadSnapshotSchema> | null;
  latestReceipt: z.infer<typeof ReceiptSchema> | null;
  failures: string[];
};

export type RhPulseStrongestSelection =
  | { state: 'measurable'; connectionId: RhPulseConnectionId; explanation: string }
  | { state: 'insufficient_evidence'; connectionId: null; explanation: string }
  | { state: 'tied'; connectionId: null; explanation: string };

/**
 * Read-only projection over existing reviewed RH Chain memory. It never calls
 * an external provider, writes classification state, or persists a public call.
 */
export class RhPulseService {
  private readonly now: () => Date;
  private readonly publicHost: string;
  private readonly readTimeoutMs: number;
  private readonly cacheTtlMs: number;
  private cached: { expiresAt: number; value: RhPulseReadModel } | null = null;

  constructor(private readonly options: RhPulseServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.publicHost = normalizePublicHostname(options.publicHost) ?? DEFAULT_PULSE_PUBLIC_HOST;
    this.readTimeoutMs = options.readTimeoutMs ?? 1_200;
    this.cacheTtlMs = options.cacheTtlMs ?? 30_000;
  }

  async getReadModel() {
    const nowMs = this.now().getTime();
    if (this.cached && this.cached.expiresAt > nowMs) return structuredClone(this.cached.value);
    const value = await this.build();
    this.cached = { value, expiresAt: nowMs + this.cacheTtlMs };
    return structuredClone(value);
  }

  invalidateCache() {
    this.cached = null;
  }

  async getConnections() {
    const model = await this.getReadModel();
    return {
      connections: model.connections,
      strongest_current_signal: model.strongest_current_signal,
      connection_under_watch: model.connection_under_watch,
      methodology_version: model.methodology_version,
      generated_at: model.generated_at
    };
  }

  async getCurrentWindow() {
    const model = await this.getReadModel();
    return { ...model.current_window, generated_at: model.generated_at };
  }

  async getMethodology() {
    const model = await this.getReadModel();
    return { ...model.methodology, generated_at: model.generated_at };
  }

  async getSourceHealth() {
    const model = await this.getReadModel();
    return { ...model.source_health, generated_at: model.generated_at };
  }

  private async build() {
    const generatedAt = this.now().toISOString();
    const context = await this.readContext();
    const connections = buildConnections(context.crossLayer, generatedAt);
    const strongest = selectStrongestRhPulseConnection(connections);
    const resolvedConnections = connections.map((connection) => RhPulseConnectionSnapshotSchema.parse({
      ...connection,
      is_strongest_current_signal: strongest.state === 'measurable' && strongest.connectionId === connection.id
    }));
    const sourceHealth = buildSourceHealth(context, generatedAt);
    const methodology = buildMethodology();
    const currentWindow = await this.resolveCurrentWindow();
    const model = {
      product: {
        id: 'rh_pulse',
        name: 'RH Pulse',
        feature: 'Call the Rotation',
        movement: 'Infopunks',
        canonical_url: `https://${this.publicHost}/`,
        independent_product: true
      },
      hero: {
        eyebrow: 'INFOPUNKS / RH PULSE',
        question: 'The agent economy is live. What does it become next?',
        supporting_copy: 'Memes brought liquidity. Agents brought coordination and new markets. RWAs remain the structural destination.',
        cta_supporting_line: 'See the connections. Call the next twenty-four hours.'
      },
      current_window: currentWindow,
      layers: [
        { id: 'rwas', label: 'RWAs', role: 'Structural destination', position: 'top' },
        { id: 'memes', label: 'Memes', role: 'Liquidity and coordination', position: 'lower_left' },
        { id: 'agents', label: 'Agents', role: 'Coordination and market formation', position: 'lower_right' }
      ],
      connections: resolvedConnections,
      strongest_current_signal: {
        state: strongest.state,
        connection_id: strongest.connectionId,
        label: strongest.state === 'measurable'
          ? CONNECTION_DEFINITIONS[strongest.connectionId].label
          : strongest.state === 'tied'
            ? 'No single connection leads'
            : 'Insufficient evidence',
        explanation: strongest.explanation
      },
      connection_under_watch: 'agents_to_rwas',
      structural_statements: buildStructuralStatements(context, resolvedConnections),
      call_options: buildCallOptions(resolvedConnections),
      calls_enabled: this.options.callsEnabled ?? false,
      methodology_version: RH_PULSE_METHODOLOGY_VERSION,
      methodology,
      source_health: sourceHealth,
      generated_at: generatedAt,
      disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
    };
    return RhPulseReadModelSchema.parse(model);
  }

  private async resolveCurrentWindow() {
    if (this.options.currentWindow) {
      try {
        return RhPulsePredictionWindowSchema.parse(await this.options.currentWindow());
      } catch {
        // A storage failure cannot fabricate an open call window. The read model
        // falls back to a disabled preview while evidence remains independently readable.
      }
    }
    return RhPulsePredictionWindowSchema.parse({
      id: 'rh_pulse_preview_24h',
      sequence_number: null,
      state: 'preview',
      label: 'Next twenty-four hours',
      duration_hours: 24,
      opens_at: null,
      closes_at: null,
      call_submission_closes_at: null,
      calls_enabled: this.options.callsEnabled ?? false,
      accepting_calls: false,
      methodology_version: 'rh-pulse-v1.0',
      source_health: {
        state: 'unavailable',
        observed_at: null,
        detail: 'No durable public call window is available.'
      },
      notice: this.options.callsEnabled
        ? 'No durable pilot window is open. RH Pulse will not fabricate one.'
        : 'Signed calls are not open yet. No countdown or participation total is inferred.'
    });
  }

  private async readContext(): Promise<ReadContext> {
    const deadline = createRequestDeadline(this.readTimeoutMs);
    try {
      const operations = await Promise.all([
        runWithinDeadline(deadline, this.readTimeoutMs - 1, async () => this.options.crossLayer()),
        optionalRead(deadline, this.readTimeoutMs - 1, this.options.chainPulse),
        optionalRead(deadline, this.readTimeoutMs - 1, this.options.memePulse),
        optionalRead(deadline, this.readTimeoutMs - 1, this.options.launchpad),
        optionalRead(deadline, this.readTimeoutMs - 1, this.options.latestReceipt
          ? async () => this.options.latestReceipt?.()
          : undefined)
      ]);
      const [crossLayer, chainPulse, memePulse, launchpad, latestReceipt] = operations;
      return {
        crossLayer: parseOutcome(crossLayer, CrossLayerPayloadSchema),
        chainPulse: parseOutcome(chainPulse, ChainPulseSnapshotSchema),
        memePulse: parseOutcome(memePulse, MemePulseSnapshotSchema),
        launchpad: parseOutcome(launchpad, LaunchpadSnapshotSchema),
        latestReceipt: parseOutcome(latestReceipt, ReceiptSchema),
        failures: operations.flatMap((outcome, index) => outcome.ok ? [] : [`${['cross_layer_memory', 'chain_pulse_memory', 'meme_pulse_memory', 'launchpad_memory', 'receipt_memory'][index]}:${outcome.reason}`])
      };
    } finally {
      deadline.dispose();
    }
  }
}

async function optionalRead<T>(
  deadline: Parameters<typeof runWithinDeadline>[0],
  timeoutMs: number,
  operation?: () => Promise<T> | T
): Promise<DeadlineOutcome<T | null>> {
  if (!operation) return { ok: true, value: null, durationMs: 0 };
  return runWithinDeadline(deadline, timeoutMs, async () => operation());
}

function parseOutcome<T>(outcome: DeadlineOutcome<unknown>, schema: z.ZodType<T>) {
  if (!outcome.ok || outcome.value === null || outcome.value === undefined) return null;
  const parsed = schema.safeParse(outcome.value);
  return parsed.success ? parsed.data : null;
}

function buildConnections(payload: CrossLayerPayload | null, generatedAt: string): RhPulseConnectionSnapshot[] {
  const entries = payload?.entries ?? [];
  const grouped = new Map<RhPulseConnectionId, CrossLayerEntry[]>(
    CONNECTION_ORDER.map((id) => [id, []])
  );
  for (const entry of entries) {
    for (const id of CONNECTION_ORDER) {
      if (CONNECTION_DEFINITIONS[id].categories.includes(entry.category)) grouped.get(id)!.push(entry);
    }
  }
  const totalObservations = [...grouped.values()].reduce((sum, records) => sum + records.length, 0);
  const observedAt = payload?.captured_at ?? payload?.observed_at ?? generatedAt;

  return CONNECTION_ORDER.map((id) => {
    const definition = CONNECTION_DEFINITIONS[id];
    const records = grouped.get(id) ?? [];
    const supportingCount = records.length;
    const withMarketMemory = records.filter((record) => record.market_data?.available).length;
    const freshness = connectionFreshness(records, payload?.freshness);
    const verified = records.length > 0 && records.every((record) => (
      ['approved', 'approved_signal', 'reviewed'].includes(record.evidence_state ?? '')
      && (record.classification_evidence_summary?.length ?? 0) > 0
      && record.conflict_state !== 'curated_durable_disagreement'
    ));
    const evidenceType = supportingCount === 0
      ? 'insufficient_evidence' as const
      : verified
        ? 'verified' as const
        : withMarketMemory > 0
          ? 'activity_coupling' as const
          : 'narrative' as const;
    const confidence = connectionConfidence(records, freshness, verified);
    const relativeStrength = supportingCount > 0 && totalObservations > 0
      ? Number((supportingCount / totalObservations * 100).toFixed(1))
      : null;
    const sourceReferences = records.slice(0, 12).map((record) => ({
      id: `classification:${record.contract.toLowerCase()}`,
      kind: 'reviewed_classification' as const,
      label: record.display_name ?? record.ticker ?? 'Reviewed exact contract',
      href: `/rh-chain-signal-desk/tokens/${encodeURIComponent(record.contract)}`,
      observed_at: record.reviewed_at ?? record.effective_at ?? record.market_data_timestamp ?? observedAt,
      note: record.classification_evidence_summary?.[0] ?? record.explanation ?? 'Reviewed cross-layer classification memory.'
    }));
    const snapshotReferences = records.filter((record) => record.market_data?.available).slice(0, 12).map((record) => ({
      id: `snapshot:${record.contract.toLowerCase()}:${record.market_data?.snapshot_timestamp ?? observedAt}`,
      kind: 'persisted_snapshot' as const,
      label: `${record.display_name ?? record.ticker ?? 'Exact contract'} persisted market context`,
      href: `/rh-chain-signal-desk/tokens/${encodeURIComponent(record.contract)}`,
      observed_at: record.market_data?.snapshot_timestamp ?? record.market_data_timestamp ?? observedAt,
      note: 'Persisted provider context only; it does not prove direction, capital flow, control, or causality.'
    }));
    const receiptReferences = uniqueReceipts(records, observedAt);
    const explanation = supportingCount === 0
      ? 'No qualifying exact-contract reviewed overlap is available for this connection. Relative strength is withheld.'
      : `${supportingCount} qualifying reviewed overlap observation${supportingCount === 1 ? '' : 's'} contribute to this relative evidence share. It is not dollar flow and does not establish causality.`;
    return RhPulseConnectionSnapshotSchema.parse({
      id,
      source_layer: definition.source_layer,
      target_layer: definition.target_layer,
      label: definition.label,
      relative_strength: relativeStrength,
      recent_change: null,
      evidence_type: evidenceType,
      confidence,
      freshness,
      explanation,
      supporting_observation_count: supportingCount,
      observed_at: observedAt,
      methodology_version: RH_PULSE_METHODOLOGY_VERSION,
      source_references: [...sourceReferences, ...snapshotReferences],
      receipt_references: receiptReferences,
      under_watch: id === 'agents_to_rwas',
      is_strongest_current_signal: false
    });
  });
}

function uniqueReceipts(records: CrossLayerEntry[], fallbackObservedAt: string) {
  const seen = new Set<string>();
  return records.flatMap((record) => {
    const receipt = record.latest_receipt;
    if (!receipt || seen.has(receipt.receipt_id)) return [];
    seen.add(receipt.receipt_id);
    return [{
      id: `receipt:${receipt.receipt_id}`,
      kind: 'receipt' as const,
      label: receipt.summary,
      href: `/rh-chain-signal-desk/daily-receipts/${encodeURIComponent(receipt.receipt_id)}`,
      observed_at: receipt.timestamp ?? fallbackObservedAt,
      note: 'Reviewed public memory reference. It does not convert observed correlation into capital flow.'
    }];
  });
}

function connectionFreshness(records: CrossLayerEntry[], payloadFreshness?: 'fresh' | 'stale' | 'partial' | 'unavailable'): RhPulseFreshness {
  if (!records.length) return mapFreshness(payloadFreshness);
  const states = records.map((record) => mapFreshness(record.freshness ?? record.market_data?.freshness ?? payloadFreshness));
  if (states.every((state) => state === 'live')) return 'live';
  if (states.some((state) => state === 'stale')) return 'stale';
  if (states.some((state) => state === 'delayed')) return 'delayed';
  return states.some((state) => state === 'live') ? 'delayed' : 'unavailable';
}

function mapFreshness(value: string | undefined | null): RhPulseFreshness {
  if (value === 'fresh') return 'live';
  if (value === 'partial') return 'delayed';
  if (value === 'stale') return 'stale';
  return 'unavailable';
}

function connectionConfidence(records: CrossLayerEntry[], freshness: RhPulseFreshness, verified: boolean): RhPulseConfidence {
  if (!records.length) return 'insufficient';
  const confidences = records.map((record) => record.classification_confidence ?? 'low');
  if (verified && freshness === 'live' && confidences.every((value) => value === 'high')) return 'high';
  if (verified && !confidences.some((value) => value === 'low') && freshness !== 'unavailable') return 'medium';
  return 'low';
}

export function selectStrongestRhPulseConnection(connections: RhPulseConnectionSnapshot[]): RhPulseStrongestSelection {
  const measurable = connections.filter((connection) => connection.relative_strength !== null);
  if (!measurable.length) {
    return {
      state: 'insufficient_evidence',
      connectionId: null,
      explanation: 'No displayed connection has qualifying reviewed overlap observations, so no strongest signal is named.'
    };
  }
  const maximum = Math.max(...measurable.map((connection) => connection.relative_strength ?? -1));
  const leaders = measurable.filter((connection) => connection.relative_strength === maximum);
  if (leaders.length !== 1) {
    return {
      state: 'tied',
      connectionId: null,
      explanation: 'Multiple connections hold the same relative evidence share. Editorial emphasis does not break the tie.'
    };
  }
  return {
    state: 'measurable',
    connectionId: leaders[0].id,
    explanation: `${leaders[0].label} has the largest share of qualifying reviewed overlap observations in this bounded three-connection comparison. This is not a directional dollar-flow estimate.`
  };
}

function buildSourceHealth(context: ReadContext, generatedAt: string): RhPulseSourceHealth {
  const crossFreshness = mapFreshness(context.crossLayer?.freshness);
  const chainFreshness = memoryFreshness(context.chainPulse?.freshness_state);
  const memeFreshness = memoryFreshness(context.memePulse?.freshness_state);
  const launchpadFreshness = context.launchpad ? ageFreshness(context.launchpad.refreshed_at, generatedAt) : 'unavailable';
  const receiptObservedAt = context.latestReceipt?.observed_at ?? context.latestReceipt?.generated_at ?? null;
  const receiptFreshness = receiptObservedAt ? ageFreshness(receiptObservedAt, generatedAt, 48) : 'unavailable';
  const marketSnapshotFreshness = context.crossLayer?.entries.some((entry) => entry.market_data?.available)
    ? crossFreshness
    : 'unavailable';
  return RhPulseSourceHealthSchema.parse({
    overall: crossFreshness,
    items: [
      {
        id: 'cross_layer_memory',
        label: 'Reviewed cross-layer memory',
        freshness: crossFreshness,
        observed_at: context.crossLayer?.captured_at ?? context.crossLayer?.observed_at ?? null,
        detail: context.crossLayer ? 'Exact-contract reviewed intersections loaded through the shared RH Chain adapter.' : 'Reviewed cross-layer memory is unavailable; connection strength is withheld.'
      },
      {
        id: 'market_snapshot_memory',
        label: 'Persisted market snapshots',
        freshness: marketSnapshotFreshness,
        observed_at: latestTimestamp(context.crossLayer?.entries.map((entry) => entry.market_data?.snapshot_timestamp ?? entry.market_data_timestamp ?? null) ?? []),
        detail: marketSnapshotFreshness === 'unavailable' ? 'No validated persisted snapshot supports the displayed connections.' : 'Persisted provider context is present and remains separate from reviewed classification.'
      },
      {
        id: 'chain_pulse_memory',
        label: 'Chain pulse memory',
        freshness: chainFreshness,
        observed_at: context.chainPulse?.observed_at ?? null,
        detail: context.chainPulse ? 'Shared RH Chain chain-pulse snapshot loaded.' : 'No current chain-pulse snapshot is available.'
      },
      {
        id: 'meme_pulse_memory',
        label: 'Meme pulse memory',
        freshness: memeFreshness,
        observed_at: context.memePulse?.refreshed_at ?? null,
        detail: context.memePulse ? 'Shared RH Chain meme-pulse snapshot loaded.' : 'No current meme-pulse snapshot is available.'
      },
      {
        id: 'launchpad_memory',
        label: 'Launchpad memory',
        freshness: launchpadFreshness,
        observed_at: context.launchpad?.refreshed_at ?? null,
        detail: context.launchpad ? 'Shared launchpad snapshot is available as context only.' : 'Launchpad snapshot memory is unavailable.'
      },
      {
        id: 'receipt_memory',
        label: 'Reviewed receipt memory',
        freshness: receiptFreshness,
        observed_at: receiptObservedAt,
        detail: context.latestReceipt ? 'Latest reviewed RH Chain receipt is available as a reference.' : 'No reviewed receipt is attached to this read.'
      }
    ],
    caveats: [
      'Freshness describes the underlying memory, not a guarantee that a structural rotation exists.',
      'Correlation is not capital flow, causality, address control, or agent attribution.',
      ...context.failures.map((failure) => `Bounded read degraded: ${failure}.`)
    ]
  });
}

function memoryFreshness(value: string | undefined): RhPulseFreshness {
  if (value === 'fresh') return 'live';
  if (value === 'stale') return 'stale';
  if (value === 'source_required') return 'delayed';
  return 'unavailable';
}

function ageFreshness(observedAt: string, generatedAt: string, liveHours = 6): RhPulseFreshness {
  const ageMs = Date.parse(generatedAt) - Date.parse(observedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'unavailable';
  if (ageMs <= liveHours * 60 * 60 * 1_000) return 'live';
  if (ageMs <= liveHours * 4 * 60 * 60 * 1_000) return 'delayed';
  return 'stale';
}

function latestTimestamp(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function buildStructuralStatements(context: ReadContext, connections: RhPulseConnectionSnapshot[]) {
  const pulseCategories = new Set(Object.values(CONNECTION_DEFINITIONS).flatMap((definition) => definition.categories));
  const entries = (context.crossLayer?.entries ?? []).filter((entry) => pulseCategories.has(entry.category));
  const crossFreshness = mapFreshness(context.crossLayer?.freshness);
  const layerCount = (layer: string) => entries.filter((entry) => entry.primary_layer === layer || entry.secondary_layers?.includes(layer)).length;
  const memes = layerCount('meme');
  const agents = layerCount('agent');
  const rwas = layerCount('rwa');
  const agentRwa = connections.find((connection) => connection.id === 'agents_to_rwas')!;
  const statement = (count: number, available: string, unavailable: string) => count > 0 ? available : unavailable;
  const confidenceForCount = (count: number): RhPulseConfidence => count > 1 ? 'medium' : count === 1 ? 'low' : 'insufficient';
  return [
    {
      id: 'memes',
      label: 'Memes',
      state: statement(memes, 'Reviewed overlap is visible', 'Insufficient reviewed overlap'),
      confidence: confidenceForCount(memes),
      freshness: memes ? crossFreshness : 'unavailable',
      detail: memes ? `${memes} qualifying cross-layer observation${memes === 1 ? '' : 's'}.` : 'No live claim is inferred from unreviewed attention.'
    },
    {
      id: 'agents',
      label: 'Agents',
      state: statement(agents, 'Reviewed agent overlap is visible', 'Reviewed agent evidence remains thin'),
      confidence: confidenceForCount(agents),
      freshness: agents ? crossFreshness : 'unavailable',
      detail: agents ? `${agents} qualifying cross-layer observation${agents === 1 ? '' : 's'}.` : 'AI narrative is not treated as verified agent activity.'
    },
    {
      id: 'agents_x_rwas',
      label: 'Agents × RWAs',
      state: agentRwa.evidence_type === 'insufficient_evidence'
        ? 'Connection under watch; evidence insufficient'
        : agentRwa.evidence_type === 'narrative'
          ? 'Narrative ahead of public receipts'
          : 'Reviewed overlap is measurable',
      confidence: agentRwa.confidence,
      freshness: agentRwa.freshness,
      detail: 'Editorial importance is separate from measured relative strength.'
    },
    {
      id: 'rwas',
      label: 'RWAs',
      state: statement(rwas, 'Reviewed RWA overlap is visible', 'Insufficient reviewed overlap'),
      confidence: confidenceForCount(rwas),
      freshness: rwas ? crossFreshness : 'unavailable',
      detail: rwas ? `${rwas} qualifying cross-layer observation${rwas === 1 ? '' : 's'}.` : 'RWA narrative does not prove real-world backing.'
    }
  ];
}

function buildCallOptions(connections: RhPulseConnectionSnapshot[]) {
  const byId = new Map(connections.map((connection) => [connection.id, connection]));
  const observations = (id: RhPulseConnectionId) => {
    const connection = byId.get(id)!;
    return [
      connection.under_watch ? 'Connection Under Watch; editorial emphasis only.' : `${connection.label} is evaluated with equal option weight.`,
      `${connection.supporting_observation_count} qualifying reviewed observation${connection.supporting_observation_count === 1 ? '' : 's'}; freshness ${connection.freshness}.`,
      connection.evidence_type === 'insufficient_evidence' ? 'No relative strength is displayed without qualifying evidence.' : 'Relative strength is evidence share, not capital flow.'
    ];
  };
  return [
    {
      id: 'agents_to_rwas',
      label: 'Agents → RWAs',
      thesis: 'Coordination systems move toward tokenized real-world markets.',
      supporting_observations: observations('agents_to_rwas'),
      under_watch: true
    },
    {
      id: 'memes_to_agents',
      label: 'Memes → Agents',
      thesis: 'Liquidity and culture rotate into agent-coordinated markets.',
      supporting_observations: observations('memes_to_agents'),
      under_watch: false
    },
    {
      id: 'memes_to_rwas',
      label: 'Memes → RWAs',
      thesis: 'Speculative liquidity rotates toward reviewed RWA structures.',
      supporting_observations: observations('memes_to_rwas'),
      under_watch: false
    },
    {
      id: 'no_qualified_rotation',
      label: 'No Qualified Rotation',
      thesis: 'No connection clears the evidence standard for a structural call.',
      supporting_observations: [
        'Use the abstention path when reviewed evidence is insufficient or tied.',
        'Community conviction stays hidden until a verified call is committed.',
        'No selection is preselected.'
      ],
      under_watch: false
    }
  ];
}

function buildMethodology(): RhPulseMethodology {
  return RhPulseMethodologySchema.parse({
    version: RH_PULSE_METHODOLOGY_VERSION,
    layer_definitions: {
      memes: 'Reviewed meme and trading-culture classifications that may coordinate liquidity or attention.',
      agents: 'Reviewed operational agent classifications. AI-themed naming alone is not agent evidence.',
      rwas: 'Reviewed real-world-asset or tokenized-finance classifications. Narrative alone does not prove backing.'
    },
    evidence_definitions: {
      verified: 'Qualifying exact-contract reviewed overlap with retained classification evidence and no unresolved classification conflict.',
      activity_coupling: 'Reviewed overlap with persisted activity context. It describes co-observation, not directional flow.',
      narrative: 'Reviewed layer narrative exists, but persisted activity or receipt support is incomplete.',
      insufficient_evidence: 'No qualifying reviewed overlap supports a numeric relative strength.'
    },
    freshness_definitions: {
      live: 'The critical memory is within its published freshness window.',
      delayed: 'Some critical memory is partial, source-required, or beyond the live window.',
      stale: 'The latest retained observation is outside the acceptable live or delayed window.',
      unavailable: 'No validated observation is available for the field.'
    },
    confidence_definitions: {
      high: 'Reviewed evidence is consistently high-confidence and current.',
      medium: 'Reviewed evidence is usable with visible limitations.',
      low: 'Evidence exists but is narrow, incomplete, or weakly refreshed.',
      insufficient: 'The system withholds a conclusion.'
    },
    under_watch_policy: 'Agents ↔ RWAs is an editorially important connection under watch. That label never adds observations, increases strength, breaks a tie, or selects a call.',
    strength_policy: 'Relative strength is the share of qualifying reviewed overlap observations across the three displayed connections. It is not dollar flow, market share, direction, causality, or a trading recommendation.',
    correlation_warning: 'Observed correlation and co-activity are not capital flow. RH Pulse does not infer address control or agent operation without approved attribution.',
    disclaimer: RH_PULSE_INDEPENDENCE_DISCLAIMER
  });
}

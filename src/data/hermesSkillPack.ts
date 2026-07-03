export type HermesSkillRule = {
  id: string;
  title: string;
  description: string;
};

export type HermesSkillOutputSchema = {
  required_fields: string[];
  artifact_contract: string[];
  decision_states: Array<'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed'>;
  receipt_ready_fields: string[];
};

export type HermesSkill = {
  id: string;
  title: string;
  purpose: string;
  when_to_use: string[];
  rules: HermesSkillRule[];
  expected_outputs: HermesSkillOutputSchema;
  decision_mapping: Record<'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed', string>;
  linked_infopunks_primitives: string[];
};

export type HermesSkillPack = {
  id: string;
  title: string;
  summary: string;
  tagline: string;
  version: string;
  doctrine_rules: HermesSkillRule[];
  expected_output_schema: HermesSkillOutputSchema;
  decision_state_mapping: Record<'trust' | 'caution' | 'do_not_use_yet' | 'unproven' | 'disputed', string>;
  linked_infopunks_primitives: string[];
  skills: HermesSkill[];
};

const decisionStateMapping = {
  trust: 'Receipt-backed evidence supports use, with caveats still visible.',
  caution: 'Use only with limits, test spend, or explicit human review.',
  do_not_use_yet: 'Do not route money, trust a provider, or amplify a claim yet.',
  unproven: 'Evidence is insufficient; keep the investigation in watch state.',
  disputed: 'Evidence conflicts or has been challenged; do not promote reputation.'
} as const;

const doctrineRules: HermesSkillRule[] = [
  {
    id: 'no-receipt-no-trust',
    title: 'No receipt, no trust.',
    description: 'A run can recommend attention, but trust requires receipt-backed evidence.'
  },
  {
    id: 'separate-claim-from-evidence',
    title: 'Separate claim from evidence.',
    description: 'Claims must remain distinct from the artifacts that support or challenge them.'
  },
  {
    id: 'unknown-is-valid',
    title: 'Unknown is a valid state.',
    description: 'Hermes should preserve unknowns instead of filling gaps with invented certainty.'
  },
  {
    id: 'prefer-do-not-use-yet',
    title: 'Prefer do_not_use_yet over fake confidence.',
    description: 'When spend safety is unclear, block use until artifacts justify a narrower decision.'
  },
  {
    id: 'cite-artifacts',
    title: 'Every recommendation must cite artifacts.',
    description: 'Each decision should point to receipts, claims, loop runs, risk notes, scans, or skill traces.'
  },
  {
    id: 'map-decision-states',
    title: 'Decision states are bounded.',
    description: 'All judgments must map to trust, caution, do_not_use_yet, unproven, or disputed.'
  },
  {
    id: 'pre-spend-before-money',
    title: 'Pre-spend judgment comes first.',
    description: 'Investigate before payment, route selection, provider trust, or claim amplification.'
  }
];

const expectedOutputSchema: HermesSkillOutputSchema = {
  required_fields: [
    'run_id',
    'objective',
    'decision',
    'confidence',
    'summary',
    'risk_factors',
    'artifacts'
  ],
  artifact_contract: [
    'artifact_id',
    'label',
    'type',
    'summary',
    'uri'
  ],
  decision_states: ['trust', 'caution', 'do_not_use_yet', 'unproven', 'disputed'],
  receipt_ready_fields: [
    'source_run_id',
    'receipt_kind',
    'evidence_count',
    'source',
    'claim_candidate'
  ]
};

function skill(
  id: string,
  title: string,
  purpose: string,
  whenToUse: string[],
  linkedPrimitives: string[]
): HermesSkill {
  return {
    id,
    title,
    purpose,
    when_to_use: whenToUse,
    rules: doctrineRules,
    expected_outputs: expectedOutputSchema,
    decision_mapping: decisionStateMapping,
    linked_infopunks_primitives: linkedPrimitives
  };
}

export const infopunksHermesSkillPack: HermesSkillPack = {
  id: 'infopunks-pre-spend-skill-pack',
  title: 'Infopunks Pre-Spend Skill Pack',
  summary: 'A skill pack for agentic investigations before money moves.',
  tagline: 'Hermes runs the investigation. Infopunks keeps the receipts.',
  version: '0.1.0',
  doctrine_rules: doctrineRules,
  expected_output_schema: expectedOutputSchema,
  decision_state_mapping: decisionStateMapping,
  linked_infopunks_primitives: ['routes', 'providers', 'receipts', 'claims', 'loops', 'proof checks'],
  skills: [
    skill(
      'pre-spend-route-check',
      'Pre-Spend Route Check',
      'Investigate a candidate route before an agent spends through it.',
      [
        'Before selecting a route for autonomous spend.',
        'When a provider or service has stale, thin, or mixed route memory.',
        'When a safer route needs to be compared against a cheaper one.'
      ],
      ['routes', 'receipts', 'claims', 'loops', 'proof checks']
    ),
    skill(
      'provider-risk-check',
      'Provider Risk Check',
      'Review provider reliability, caveats, disputes, and observed route memory.',
      [
        'Before trusting a provider listing.',
        'When provider capability claims outrun receipts.',
        'When dispute history or degraded endpoint memory may affect spend.'
      ],
      ['providers', 'receipts', 'claims', 'loops']
    ),
    skill(
      'receipt-validator',
      'Receipt Validator',
      'Check whether an agent run has enough evidence to become durable Radar memory.',
      [
        'After Hermes produces investigation artifacts.',
        'Before converting run output into a ProofReceipt-compatible object.',
        'When evidence count, artifact quality, or source boundaries need review.'
      ],
      ['receipts', 'proof checks', 'claims']
    ),
    skill(
      'claim-dispute-review',
      'Claim Dispute Review',
      'Compare claims against attached receipts and flag disputed or stale evidence.',
      [
        'When a claim is challenged.',
        'When new evidence contradicts a previous recommendation.',
        'Before a claim updates provider or route reputation.'
      ],
      ['claims', 'receipts', 'proof checks', 'loops']
    ),
    skill(
      'signal-hunt-analyst',
      'Signal Hunt Analyst',
      'Scan narrative inputs and connect credible signals into proof and loop memory.',
      [
        'When narrative velocity suggests a market signal.',
        'When attention needs evidence before amplification.',
        'When signal claims should be held as unproven until artifacts attach.'
      ],
      ['claims', 'loops', 'proof checks']
    ),
    skill(
      'carbon-credit-instrument-check',
      'Carbon Credit Instrument Check',
      'Inspect carbon-credit instrument claims before routing spend, trust, or reputation updates.',
      [
        'Before treating a carbon-credit instrument as spend-ready.',
        'When offset, registry, retirement, or provenance claims need artifact separation.',
        'When environmental claims need dispute-aware evidence review.'
      ],
      ['routes', 'providers', 'receipts', 'claims', 'proof checks']
    )
  ]
};

export function listHermesSkillPackSkills(): HermesSkill[] {
  return infopunksHermesSkillPack.skills.map((skillItem) => ({
    ...skillItem,
    when_to_use: [...skillItem.when_to_use],
    rules: skillItem.rules.map((rule) => ({ ...rule })),
    expected_outputs: {
      ...skillItem.expected_outputs,
      required_fields: [...skillItem.expected_outputs.required_fields],
      artifact_contract: [...skillItem.expected_outputs.artifact_contract],
      decision_states: [...skillItem.expected_outputs.decision_states],
      receipt_ready_fields: [...skillItem.expected_outputs.receipt_ready_fields]
    },
    decision_mapping: { ...skillItem.decision_mapping },
    linked_infopunks_primitives: [...skillItem.linked_infopunks_primitives]
  }));
}

export function getHermesSkillById(skillId: string): HermesSkill | null {
  return listHermesSkillPackSkills().find((skillItem) => skillItem.id === skillId) ?? null;
}

export function getHermesSkillPack(): HermesSkillPack {
  return {
    ...infopunksHermesSkillPack,
    doctrine_rules: infopunksHermesSkillPack.doctrine_rules.map((rule) => ({ ...rule })),
    expected_output_schema: {
      ...infopunksHermesSkillPack.expected_output_schema,
      required_fields: [...infopunksHermesSkillPack.expected_output_schema.required_fields],
      artifact_contract: [...infopunksHermesSkillPack.expected_output_schema.artifact_contract],
      decision_states: [...infopunksHermesSkillPack.expected_output_schema.decision_states],
      receipt_ready_fields: [...infopunksHermesSkillPack.expected_output_schema.receipt_ready_fields]
    },
    decision_state_mapping: { ...infopunksHermesSkillPack.decision_state_mapping },
    linked_infopunks_primitives: [...infopunksHermesSkillPack.linked_infopunks_primitives],
    skills: listHermesSkillPackSkills()
  };
}

export type MachineExecutionProofProfileId =
  | 'machine_translation_safe_phrase'
  | 'bigquery_bounded_query'
  | 'stableupload_tiny_fixture'
  | 'naver_geocode_lookup'
  | 'qvac_runtime_registration_review';

type RequiredFieldRule = {
  field: string;
  type: 'present' | 'number' | 'boolean_true' | 'boolean_false';
};

export type MachineExecutionProofProfile = {
  profile_id: MachineExecutionProofProfileId;
  service_id: string;
  route_id: string;
  safe_input_class: string;
  expected_output_class: string;
  required_success_fields: RequiredFieldRule[];
  optional_success_fields: string[];
  forbidden_fields: string[];
  payment_evidence_policy: string;
  benchmark_policy: string;
  winner_policy: string;
  physical_world_policy: string;
  default_caveats: string[];
};

type ValidationInput = {
  service_id: string;
  execution_status: 'attempted' | 'succeeded' | 'failed';
  execution_occurred: boolean;
  response_summary: Record<string, unknown> | null;
};

export type MachineExecutionProofValidation = {
  profile: MachineExecutionProofProfile;
  issues: string[];
  success_proof_eligible: boolean;
};

const PROFILES: MachineExecutionProofProfile[] = [
  {
    profile_id: 'machine_translation_safe_phrase',
    service_id: 'cloud-translation',
    route_id: 'translation:POST:/translate',
    safe_input_class: 'safe_phrase',
    expected_output_class: 'semantic_translation',
    required_success_fields: [
      { field: 'translated_text_preview', type: 'present' },
      { field: 'source_language', type: 'present' },
      { field: 'target_language', type: 'present' },
      { field: 'semantic_translation_observed', type: 'boolean_true' }
    ],
    optional_success_fields: ['provider_request_id', 'word_count'],
    forbidden_fields: [],
    payment_evidence_policy: 'Do not claim payment success unless payment evidence exists.',
    benchmark_policy: 'Do not claim benchmark without benchmark artifact.',
    winner_policy: 'Do not claim winner without explicit criteria and artifact.',
    physical_world_policy: 'No physical-world execution implied by translation receipts.',
    default_caveats: ['Service-specific execution receipt only.']
  },
  {
    profile_id: 'bigquery_bounded_query',
    service_id: 'bigquery',
    route_id: 'bigquery:POST:/query',
    safe_input_class: 'bounded_public_or_synthetic_query',
    expected_output_class: 'tabular_result_preview',
    required_success_fields: [
      { field: 'query_label', type: 'present' },
      { field: 'row_count', type: 'number' },
      { field: 'result_preview', type: 'present' },
      { field: 'dataset_classification', type: 'present' },
      { field: 'bounded_query_confirmed', type: 'boolean_true' }
    ],
    optional_success_fields: ['query_cost_estimate', 'execution_location'],
    forbidden_fields: ['personal_data', 'sensitive_business_data', 'unbounded_query'],
    payment_evidence_policy: 'Do not claim payment success unless payment evidence exists.',
    benchmark_policy: 'Do not claim benchmark without benchmark artifact.',
    winner_policy: 'Do not claim winner without explicit criteria and artifact.',
    physical_world_policy: 'Digital query route only; no physical-world execution claim.',
    default_caveats: ['Bounded public/synthetic query only.']
  },
  {
    profile_id: 'stableupload_tiny_fixture',
    service_id: 'stableupload',
    route_id: 'stableupload:POST:/upload',
    safe_input_class: 'tiny_non_sensitive_fixture',
    expected_output_class: 'upload_receipt_reference',
    required_success_fields: [
      { field: 'file_size_bytes', type: 'number' },
      { field: 'file_hash', type: 'present' },
      { field: 'upload_reference', type: 'present' },
      { field: 'sensitive_data_flag', type: 'boolean_false' }
    ],
    optional_success_fields: ['mime_type', 'storage_region'],
    forbidden_fields: ['private_file', 'regulated_data', 'production_asset'],
    payment_evidence_policy: 'Do not claim payment success unless payment evidence exists.',
    benchmark_policy: 'Do not claim benchmark without benchmark artifact.',
    winner_policy: 'Do not claim winner without explicit criteria and artifact.',
    physical_world_policy: 'Storage fixture route only; no physical-world execution claim.',
    default_caveats: ['Tiny non-sensitive fixture only.']
  },
  {
    profile_id: 'naver_geocode_lookup',
    service_id: 'naver-maps',
    route_id: 'naver-maps:GET:/map-geocode/v2/geocode',
    safe_input_class: 'non_operational_geocode_lookup',
    expected_output_class: 'geocode_coordinates_preview',
    required_success_fields: [
      { field: 'query_label', type: 'present' },
      { field: 'geocode_result_preview', type: 'present' },
      { field: 'coordinates_present', type: 'boolean_true' },
      { field: 'no_robot_command', type: 'boolean_true' },
      { field: 'no_physical_movement', type: 'boolean_true' }
    ],
    optional_success_fields: ['region_hint', 'country_code'],
    forbidden_fields: ['driving_directions', 'robot_dispatch', 'operational_route_guidance'],
    payment_evidence_policy: 'Do not claim payment success unless payment evidence exists.',
    benchmark_policy: 'Do not claim benchmark without benchmark artifact.',
    winner_policy: 'Do not claim winner without explicit criteria and artifact.',
    physical_world_policy: 'No robot command, no physical movement, no operational guidance.',
    default_caveats: [
      'Non-operational geocode lookup only.',
      'No robot command.',
      'No physical movement.',
      'Public context is not Radar execution evidence.'
    ]
  },
  {
    profile_id: 'qvac_runtime_registration_review',
    service_id: 'qvac',
    route_id: 'qvac:review:runtime_registration',
    safe_input_class: 'runtime_registration_review',
    expected_output_class: 'review_status_bundle',
    required_success_fields: [
      { field: 'runtime_registration_status', type: 'present' },
      { field: 'operator_review_status', type: 'present' },
      { field: 'route_surface_status', type: 'present' }
    ],
    optional_success_fields: ['review_notes', 'registration_reference'],
    forbidden_fields: [],
    payment_evidence_policy: 'Do not claim payment success unless payment evidence exists.',
    benchmark_policy: 'Do not claim benchmark without benchmark artifact.',
    winner_policy: 'Do not claim winner without explicit criteria and artifact.',
    physical_world_policy: 'Review/registration evidence only; no autonomous execution claim.',
    default_caveats: ['Runtime/operator review only; no autonomous execution claim.']
  }
];

const PROFILE_BY_SERVICE_ID = new Map<string, MachineExecutionProofProfile>([
  ...PROFILES.map((profile) => [profile.service_id, profile] as const),
  ['anytrans', PROFILES[0]],
  ['alibaba-machine-translation-general', PROFILES[0]]
]);

export function getMachineExecutionProofProfile(serviceId: string): MachineExecutionProofProfile | null {
  return PROFILE_BY_SERVICE_ID.get(serviceId) ?? null;
}

export function validateMachineExecutionProofByProfile(input: ValidationInput): MachineExecutionProofValidation {
  const profile = getMachineExecutionProofProfile(input.service_id);
  if (!profile) {
    return {
      profile: {
        ...PROFILES[0],
        service_id: input.service_id,
        route_id: 'unknown',
        profile_id: 'machine_translation_safe_phrase'
      },
      issues: [`proof_profile_not_found_for_service_id:${input.service_id}`],
      success_proof_eligible: false
    };
  }

  if (input.execution_status !== 'succeeded') {
    return { profile, issues: [], success_proof_eligible: false };
  }

  const issues: string[] = [];
  if (!input.execution_occurred) {
    issues.push('execution_occurred=true required for succeeded execution_status');
  }

  const summary = input.response_summary;
  if (!summary || typeof summary !== 'object') {
    issues.push('response_summary required for succeeded execution_status');
  } else {
    for (const rule of profile.required_success_fields) {
      const value = summary[rule.field];
      if (!matchesRule(value, rule.type)) {
        issues.push(`response_summary.${rule.field} required for profile ${profile.profile_id}`);
      }
    }
    for (const forbiddenField of profile.forbidden_fields) {
      if (forbiddenField in summary) {
        issues.push(`response_summary.${forbiddenField} forbidden for profile ${profile.profile_id}`);
      }
    }
  }

  return { profile, issues, success_proof_eligible: issues.length === 0 };
}

function matchesRule(value: unknown, type: RequiredFieldRule['type']) {
  if (type === 'present') {
    if (typeof value === 'string') return value.trim().length > 0;
    return value != null;
  }
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean_true') return value === true;
  return value === false;
}

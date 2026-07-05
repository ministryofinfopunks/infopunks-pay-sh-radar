import {
  type WalletSafetyIntegrationProfile,
  type WalletSafetyIntegrationReadinessState,
  type WalletSafetyIntegrationRegistrySummary,
  walletSafetyIntegrationProfiles
} from '../data/walletSafetyIntegrations';
import { hermesDeskGeneratedAt } from '../data/hermesDesk';

export type WalletSafetyIntegrationRequirement = {
  id: string;
  label: string;
  status: 'passed' | 'missing' | 'watch' | 'not_applicable';
  summary: string;
};

export type WalletSafetyIntegrationProofItem = {
  id: string;
  label: string;
  summary: string;
  source: 'profile' | 'receipt_pattern' | 'policy' | 'registry' | 'manual';
};

export type WalletSafetyIntegrationReadinessReport = {
  integration_id: string;
  generated_at: string;
  profile: WalletSafetyIntegrationProfile;
  readiness_state: WalletSafetyIntegrationReadinessState;
  readiness_score: number;
  requirements: WalletSafetyIntegrationRequirement[];
  proof_items: WalletSafetyIntegrationProofItem[];
  missing_items: WalletSafetyIntegrationRequirement[];
  next_steps: string[];
};

const CORE_RECEIPT_FIELDS = [
  'wallet_safety_check_id',
  'policy_receipt_id',
  'risk_score_id',
  'audit_trail_id',
  'agent_action_taken'
] as const;

function cloneProfile(profile: WalletSafetyIntegrationProfile): WalletSafetyIntegrationProfile {
  return {
    ...profile,
    supported_chains: [...profile.supported_chains],
    supported_payment_rails: [...profile.supported_payment_rails],
    readiness_notes: [...profile.readiness_notes],
    linked_routes: profile.linked_routes ? [...profile.linked_routes] : undefined,
    linked_providers: profile.linked_providers ? [...profile.linked_providers] : undefined,
    linked_services: profile.linked_services ? [...profile.linked_services] : undefined,
    example_receipt_fields: [...profile.example_receipt_fields]
  };
}

function countByState(
  integrations: WalletSafetyIntegrationProfile[],
  state: WalletSafetyIntegrationReadinessState
): number {
  return integrations.filter((integration) => integration.readiness_state === state).length;
}

export function listWalletSafetyIntegrations(): WalletSafetyIntegrationProfile[] {
  return walletSafetyIntegrationProfiles.map(cloneProfile);
}

export function buildWalletSafetyIntegrationRegistry(): WalletSafetyIntegrationRegistrySummary {
  const integrations = listWalletSafetyIntegrations();
  return {
    generated_at: hermesDeskGeneratedAt,
    integration_count: integrations.length,
    ready_count: countByState(integrations, 'ready'),
    testing_count: countByState(integrations, 'testing'),
    needs_receipts_count: countByState(integrations, 'needs_receipts'),
    watch_count: countByState(integrations, 'watch'),
    not_ready_count: countByState(integrations, 'not_ready'),
    integrations
  };
}

export function getWalletSafetyIntegrationById(integrationId: string): WalletSafetyIntegrationProfile | undefined {
  const normalized = integrationId.trim();
  const match = walletSafetyIntegrationProfiles.find((integration) => integration.integration_id === normalized);
  return match ? cloneProfile(match) : undefined;
}

export function listWalletSafetyReadyIntegrations(): WalletSafetyIntegrationProfile[] {
  return walletSafetyIntegrationProfiles
    .filter((integration) => integration.readiness_state === 'ready')
    .map(cloneProfile);
}

function hasCoreReceiptFields(profile: WalletSafetyIntegrationProfile): boolean {
  const fields = new Set(profile.example_receipt_fields);
  return CORE_RECEIPT_FIELDS.every((field) => fields.has(field));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function buildReadinessScore(profile: WalletSafetyIntegrationProfile): number {
  let score = 0;
  if (profile.uses_wallet_safety_check) score += 30;
  if (profile.writes_integration_receipts) score += 30;
  if (profile.fail_closed_behavior) score += 25;
  if (profile.supported_chains.length > 0) score += 5;
  if (profile.supported_payment_rails.length > 0) score += 5;
  if (profile.readiness_state === 'ready') score += 5;
  return clampScore(score);
}

function buildRequirements(profile: WalletSafetyIntegrationProfile): WalletSafetyIntegrationRequirement[] {
  return [
    {
      id: 'wallet_safety_api_usage',
      label: 'Wallet Safety API usage',
      status: profile.uses_wallet_safety_check ? 'passed' : 'missing',
      summary: profile.uses_wallet_safety_check
        ? 'Calls POST /v1/hermes/wallet-safety/check before spend.'
        : 'Add Wallet Safety API usage before autonomous spend.'
    },
    {
      id: 'integration_receipt_writing',
      label: 'Integration receipt writing',
      status: profile.writes_integration_receipts ? 'passed' : 'missing',
      summary: profile.writes_integration_receipts
        ? 'Writes integration receipts that preserve wallet safety evidence.'
        : 'Add integration receipt writing to preserve wallet safety evidence.'
    },
    {
      id: 'fail_closed_behavior',
      label: 'Fail-closed behavior',
      status: profile.fail_closed_behavior ? 'passed' : profile.uses_wallet_safety_check ? 'watch' : 'missing',
      summary: profile.fail_closed_behavior
        ? 'Fails closed when wallet safety is unavailable.'
        : profile.uses_wallet_safety_check
          ? 'Improve fail-closed behavior so missing safety evidence cannot become approval.'
          : 'Add fail-closed behavior after Wallet Safety API usage is implemented.'
    },
    {
      id: 'supported_chain_declaration',
      label: 'Supported chain declaration',
      status: profile.supported_chains.length > 0 ? 'passed' : 'missing',
      summary: profile.supported_chains.length > 0
        ? `Declares supported chains: ${profile.supported_chains.join(', ')}.`
        : 'Declare which chains this integration supports.'
    },
    {
      id: 'supported_payment_rail_declaration',
      label: 'Supported payment rail declaration',
      status: profile.supported_payment_rails.length > 0 ? 'passed' : 'missing',
      summary: profile.supported_payment_rails.length > 0
        ? `Declares supported payment rails: ${profile.supported_payment_rails.join(', ')}.`
        : 'Declare which payment rails this integration supports.'
    },
    {
      id: 'receipt_field_completeness',
      label: 'Receipt field completeness',
      status: !profile.writes_integration_receipts
        ? 'missing'
        : hasCoreReceiptFields(profile)
          ? 'passed'
          : 'watch',
      summary: !profile.writes_integration_receipts
        ? 'Add receipt fields that store wallet_safety_check_id, policy_receipt_id, risk_score_id, audit_trail_id, and agent_action_taken.'
        : hasCoreReceiptFields(profile)
          ? 'Example receipt fields include the core wallet safety evidence handles.'
          : 'Expand example receipt fields to include the core wallet safety evidence handles.'
    }
  ];
}

function buildProofItems(profile: WalletSafetyIntegrationProfile): WalletSafetyIntegrationProofItem[] {
  const items: WalletSafetyIntegrationProofItem[] = [
    {
      id: 'registry_profile',
      label: 'Registry profile',
      summary: `${profile.name} is listed in the seeded Wallet Safety Integration Registry as ${profile.readiness_state}.`,
      source: 'registry'
    },
    {
      id: 'verification_timestamp',
      label: 'Last verified run',
      summary: `Last verified at ${profile.last_verified_at}.`,
      source: 'manual'
    }
  ];

  if (profile.uses_wallet_safety_check) {
    items.push({
      id: 'wallet_safety_check_usage',
      label: 'Wallet Safety check usage',
      summary: 'The profile declares Wallet Safety API usage before spend.',
      source: 'profile'
    });
  }

  if (profile.writes_integration_receipts) {
    items.push({
      id: 'integration_receipt_pattern',
      label: 'Integration receipt pattern',
      summary: `Example receipt fields: ${profile.example_receipt_fields.join(', ')}.`,
      source: 'receipt_pattern'
    });
  }

  if (profile.fail_closed_behavior) {
    items.push({
      id: 'fail_closed_policy',
      label: 'Fail-closed policy',
      summary: 'The integration declares fail-closed behavior when safety evidence is unavailable.',
      source: 'policy'
    });
  }

  if (profile.linked_routes?.length) {
    items.push({
      id: 'linked_routes',
      label: 'Linked routes',
      summary: `Linked routes: ${profile.linked_routes.join(', ')}.`,
      source: 'registry'
    });
  }

  if (profile.linked_providers?.length) {
    items.push({
      id: 'linked_providers',
      label: 'Linked providers',
      summary: `Linked providers: ${profile.linked_providers.join(', ')}.`,
      source: 'registry'
    });
  }

  if (profile.linked_services?.length) {
    items.push({
      id: 'linked_services',
      label: 'Linked services',
      summary: `Linked services: ${profile.linked_services.join(', ')}.`,
      source: 'registry'
    });
  }

  return items;
}

function buildNextSteps(profile: WalletSafetyIntegrationProfile): string[] {
  const byState: Record<WalletSafetyIntegrationReadinessState, string[]> = {
    ready: ['This integration meets the seeded readiness requirements.'],
    needs_receipts: ['Add integration receipt writing to become ready.'],
    watch: ['Improve fail-closed behavior and continue verification.'],
    testing: ['Complete verification runs and receipt evidence.'],
    not_ready: ['Add Wallet Safety API usage, receipts, and fail-closed behavior.']
  };

  return [
    ...byState[profile.readiness_state],
    'Call POST /v1/hermes/wallet-safety/check before spend.',
    'Respect final_recommendation.',
    'Never treat API failure as approval.',
    'Write an integration receipt.',
    'Store policy_receipt_id, risk_score_id, and audit_trail_id.',
    'Expose agent_action_taken.',
    'Fail closed when safety is unavailable.'
  ];
}

export function buildWalletSafetyIntegrationReadinessReport(integrationId: string): WalletSafetyIntegrationReadinessReport | undefined {
  const profile = getWalletSafetyIntegrationById(integrationId);
  if (!profile) return undefined;

  const requirements = buildRequirements(profile);

  return {
    integration_id: profile.integration_id,
    generated_at: hermesDeskGeneratedAt,
    profile,
    readiness_state: profile.readiness_state,
    readiness_score: buildReadinessScore(profile),
    requirements,
    proof_items: buildProofItems(profile),
    missing_items: requirements.filter((requirement) => requirement.status === 'missing' || requirement.status === 'watch'),
    next_steps: buildNextSteps(profile)
  };
}

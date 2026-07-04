import {
  type WalletSafetyIntegrationProfile,
  type WalletSafetyIntegrationReadinessState,
  type WalletSafetyIntegrationRegistrySummary,
  walletSafetyIntegrationProfiles
} from '../data/walletSafetyIntegrations';
import { hermesDeskGeneratedAt } from '../data/hermesDesk';

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

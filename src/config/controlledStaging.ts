/** Controlled Track A staging cannot acquire spend, execution or publication authority. */
export const STAGING_DISABLED_FLAGS = [
  'JUDGMENT_PAYMENT_ENABLED', 'MACHINE_EXECUTION_ENABLED', 'MACHINE_DEMO_SEED',
  'ECONOMIC_ENGINE_ENABLED', 'ECONOMIC_ENGINE_AUTHORIZATION_ENABLED', 'ECONOMIC_ENGINE_JEV_ENABLED',
  'MONITOR_ENABLED', 'MONITOR_ALLOW_PAID_ENDPOINTS', 'OPENAI_DECISIONS_SHADOW_ENABLED',
  'EVALUATION_REPUTATION_PROJECTION_ENABLED', 'IPX_PLTR_SHADOW_OBSERVATION_ENABLED',
  'IPX_PLTR_SHADOW_CAPACITY_SWEEP_ENABLED', 'RH_CHAIN_AUTOMATION_ENABLED',
  'RH_4663_PHASE2_ENABLED', 'RH_4663_PHASE3_ENABLED', 'RH_4663_PHASE3_PUBLICATION_ENABLED',
  'RH_4663_AUTO_PUBLICATION_ENABLED', 'RH_4663_EXTERNAL_DISTRIBUTION_ENABLED',
  'RH_4663_CAMPAIGN_REHEARSAL_ENABLED'
] as const;
export const STAGING_ABSENT_BINDINGS = [
  'JUDGMENT_FACILITATOR_URL', 'JUDGMENT_PAY_TO', 'JUDGMENT_RESOURCE_URL',
  'JUDGMENT_SIGNING_PRIVATE_KEY', 'JUDGMENT_ISSUER_KEYS_JSON', 'JUDGMENT_RH_RPC_URL',
  'EXECUTION_PROOF_BASE_RPC_URL', 'ECONOMIC_ENGINE_FACILITATOR_URL',
  'ECONOMIC_ENGINE_SIGNING_PRIVATE_KEY', 'PAY_SH_TRANSLATION_AUTH_TOKEN',
  'PAY_SH_TRANSLATION_PAYMENT_VALUE', 'RH_4663_RESOLUTION_PRIVATE_KEY',
  'RH_4663_ANCHOR_PRIVATE_KEY', 'IPX_LAUNCH_POLICY_PATH', 'IPX_SOLANA_RPC_URL',
  'IPX_SOLANA_WATCH_MANIFEST_PATH', 'OPENAI_API_KEY', 'HERMES_API_KEY',
  'EVALUATION_REVIEWER_TRUST_JSON', 'EXECUTION_AUTHORIZATION_PRIVATE_KEY',
  'EXECUTION_AUTHORIZATION_KEYS_JSON', 'TYPESAFE_API_KEY'
] as const;
export function controlledStagingIssues(env: NodeJS.ProcessEnv): Array<{ variable: string; code: string }> {
  if (env.RADAR_CONTROLLED_STAGING !== 'true') return [];
  return [
    ...STAGING_DISABLED_FLAGS.filter(name => env[name] !== undefined && env[name] !== '' && env[name] !== 'false')
      .map(variable => ({ variable, code: 'controlled_staging_capability_forbidden' })),
    ...STAGING_ABSENT_BINDINGS.filter(name => Boolean(env[name]?.trim()))
      .map(variable => ({ variable, code: 'controlled_staging_binding_forbidden' })),
    ...(env.MONITOR_MODE && env.MONITOR_MODE !== 'disabled' ? [{ variable: 'MONITOR_MODE', code: 'controlled_staging_monitor_forbidden' }] : [])
  ];
}
/** Only the bounded assessment endpoints may append their free idempotency journal. */
export function controlledStagingRequestError(method: string, route: string): string | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return null;
  if (method === 'POST' && ['/v1/pre-spend/check', '/v1/decide'].includes(route)) return null;
  return 'controlled_staging_write_disabled';
}

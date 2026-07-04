export type WalletSafetyIntegrationReadinessState =
  | 'ready'
  | 'testing'
  | 'needs_receipts'
  | 'watch'
  | 'not_ready';

export type WalletSafetyIntegrationProfile = {
  integration_id: string;
  name: string;
  summary: string;
  agent_type:
    | 'agent_wallet'
    | 'route_guard'
    | 'service_router'
    | 'research_agent'
    | 'payment_app'
    | 'unknown';
  supported_chains: string[];
  supported_payment_rails: string[];
  uses_wallet_safety_check: boolean;
  writes_integration_receipts: boolean;
  fail_closed_behavior: boolean;
  last_verified_at: string;
  readiness_state: WalletSafetyIntegrationReadinessState;
  readiness_notes: string[];
  linked_routes?: string[];
  linked_providers?: string[];
  linked_services?: string[];
  example_receipt_fields: string[];
};

export type WalletSafetyIntegrationRegistrySummary = {
  generated_at: string;
  integration_count: number;
  ready_count: number;
  testing_count: number;
  needs_receipts_count: number;
  watch_count: number;
  not_ready_count: number;
  integrations: WalletSafetyIntegrationProfile[];
};

export const walletSafetyIntegrationProfiles: WalletSafetyIntegrationProfile[] = [
  {
    integration_id: 'agent_wallet_demo',
    name: 'Agent Wallet Demo',
    summary: 'Reference autonomous wallet integration that checks before spend, writes receipts, and fails closed when safety is unavailable.',
    agent_type: 'agent_wallet',
    supported_chains: ['base', 'solana'],
    supported_payment_rails: ['x402', 'pay.sh'],
    uses_wallet_safety_check: true,
    writes_integration_receipts: true,
    fail_closed_behavior: true,
    last_verified_at: '2026-07-03T00:00:00.000Z',
    readiness_state: 'ready',
    readiness_notes: [
      'Calls POST /v1/hermes/wallet-safety/check before autonomous spend.',
      'Stores policy, risk score, and audit trail identifiers in integration receipts.',
      'Pauses the wallet when the safety API is unavailable.'
    ],
    linked_routes: ['route_pay_sh_market_research_01'],
    linked_providers: ['provider_pay_sh_lattice'],
    linked_services: ['service_market_research'],
    example_receipt_fields: [
      'wallet_safety_check_id',
      'policy_receipt_id',
      'risk_score_id',
      'audit_trail_id',
      'agent_action_taken',
      'timestamp'
    ]
  },
  {
    integration_id: 'pay_sh_route_guard',
    name: 'Pay.sh Route Guard',
    summary: 'Route guard for Pay.sh flows that blocks spend unless the Wallet Safety bundle and receipt trail are both present.',
    agent_type: 'route_guard',
    supported_chains: ['base', 'solana'],
    supported_payment_rails: ['pay.sh'],
    uses_wallet_safety_check: true,
    writes_integration_receipts: true,
    fail_closed_behavior: true,
    last_verified_at: '2026-07-03T00:00:00.000Z',
    readiness_state: 'ready',
    readiness_notes: [
      'Runs safety checks before route selection and payment execution.',
      'Writes integration receipts for route-level policy enforcement.',
      'Treats missing safety evidence as a stop condition.'
    ],
    linked_routes: ['route_pay_sh_market_research_01'],
    linked_providers: ['provider_pay_sh_lattice'],
    example_receipt_fields: [
      'wallet_safety_check_id',
      'policy_receipt_id',
      'risk_score_id',
      'audit_trail_id',
      'agent_action_taken',
      'route_id'
    ]
  },
  {
    integration_id: 'x402_service_router',
    name: 'x402 Service Router',
    summary: 'Service router for x402 payments that checks wallet safety but still needs durable integration receipt writing.',
    agent_type: 'service_router',
    supported_chains: ['base'],
    supported_payment_rails: ['x402'],
    uses_wallet_safety_check: true,
    writes_integration_receipts: false,
    fail_closed_behavior: true,
    last_verified_at: '2026-07-03T00:00:00.000Z',
    readiness_state: 'needs_receipts',
    readiness_notes: [
      'Safety check is wired before spend routing.',
      'Router blocks on unavailable safety checks.',
      'Integration receipt persistence is still missing.'
    ],
    linked_providers: ['provider_pay_sh_lattice'],
    linked_services: ['service_market_research'],
    example_receipt_fields: [
      'wallet_safety_check_id',
      'policy_receipt_id',
      'risk_score_id',
      'audit_trail_id'
    ]
  },
  {
    integration_id: 'autonomous_research_agent',
    name: 'Autonomous Research Agent',
    summary: 'Research agent integration that checks before spend and writes receipts, but still needs stricter fail-closed behavior for unattended operation.',
    agent_type: 'research_agent',
    supported_chains: ['base'],
    supported_payment_rails: ['x402', 'agentic.market'],
    uses_wallet_safety_check: true,
    writes_integration_receipts: true,
    fail_closed_behavior: false,
    last_verified_at: '2026-07-03T00:00:00.000Z',
    readiness_state: 'watch',
    readiness_notes: [
      'Writes integration receipts after safety checks.',
      'Still allows manual operator override when the safety API is unavailable.',
      'Needs evidence that autonomous paths stop instead of failing open.'
    ],
    linked_routes: ['route_pay_sh_market_research_01'],
    linked_providers: ['provider_pay_sh_lattice'],
    linked_services: ['service_market_research'],
    example_receipt_fields: [
      'wallet_safety_check_id',
      'policy_receipt_id',
      'risk_score_id',
      'audit_trail_id',
      'agent_action_taken',
      'objective'
    ]
  }
];

import { z } from 'zod';

/** v1 registry is deliberately closed. A subject never selects an arbitrary policy. */
export const JudgmentSubjectTypeSchema = z.enum(['service_route', 'provider', 'machine_payment_endpoint', 'token_contract', 'liquidity_pool', 'stock_token_market', 'market_operation']);
export const JudgmentDomainContextSchema = z.object({
  version: z.literal('radar-judgment-context.v1'),
  subject: z.object({
    type: JudgmentSubjectTypeSchema,
    id: z.string().min(1).max(256),
    network: z.enum(['solana:mainnet', 'eip155:4663'])
  }).strict(),
  policy: z.object({ id: z.enum(['solana.service-spend', 'rh.market-inspection']), version: z.literal('1') }).strict(),
  evidence_refs: z.array(z.string().min(1).max(256)).max(20),
  /** Fee settlement, not the subject's chain or preferred service payment method. */
  settlement_network: z.string().min(1).max(64),
  expires_at: z.string().datetime({ offset: true })
}).strict().superRefine((value, ctx) => {
  const prefix = `${value.subject.network}:${value.subject.type}:`;
  const identifier = value.subject.id.slice(prefix.length);
  if (!value.subject.id.startsWith(prefix) || !identifier || !/^[A-Za-z0-9_.:-]+$/.test(identifier)) {
    ctx.addIssue({ code: 'custom', path: ['subject', 'id'], message: 'namespaced_subject_required' });
  }
  const service = ['service_route', 'provider', 'machine_payment_endpoint'].includes(value.subject.type);
  if ((value.subject.network === 'solana:mainnet') !== service ||
      value.policy.id !== (service ? 'solana.service-spend' : 'rh.market-inspection')) {
    ctx.addIssue({ code: 'custom', path: ['policy'], message: 'subject_policy_mismatch' });
  }
  if (['token_contract', 'market_operation'].includes(value.subject.type) && !/^0x[a-fA-F0-9]{40}$/.test(identifier)) {
    ctx.addIssue({ code: 'custom', path: ['subject', 'id'], message: 'contract_identity_required' });
  }
  if (['liquidity_pool', 'stock_token_market'].includes(value.subject.type) && !/^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(identifier)) {
    ctx.addIssue({ code: 'custom', path: ['subject', 'id'], message: 'pool_identity_required' });
  }
});
export type JudgmentDomainContext = z.infer<typeof JudgmentDomainContextSchema>;

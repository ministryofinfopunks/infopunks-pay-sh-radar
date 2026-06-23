import { describe, expect, it } from 'vitest';
import { createInMemoryProofCheckRepository } from '../src/repositories/proofCheckRepository';
import { createProofCheckService } from '../src/services/proofCheckService';

describe('proof check service', () => {
  it('produces do_not_use_yet for autonomy claims without receipts or validation', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Autonomous agent can route and settle everything now.' });

    expect(result.decision_state).toBe('do_not_use_yet');
    expect(result.risk_flags).toContain('autonomy_unproven');
  });

  it('produces caution for route claims with partial receipts and no human validation', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Pay.sh route latency and performance claim for market intelligence.' });

    expect(result.decision_state).toBe('caution');
    expect(result.receipt_strength).toBe('partial_receipts');
  });

  it('produces trust for provider reliability claims with validated language', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Provider reliability validated and verified across receipt parsing runs.' });

    expect(result.decision_state).toBe('trust');
    expect(result.validation_status).toBe('human_validated');
  });

  it('produces disputed when the input contains a conflicting partnership claim', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'Partnership claim has conflicting screenshots and an open dispute.' });

    expect(result.decision_state).toBe('disputed');
    expect(result.validation_status).toBe('disputed');
  });

  it('produces unproven for a generic low-evidence claim', () => {
    const service = createProofCheckService(createInMemoryProofCheckRepository([]));
    const result = service.createProofCheck({ input: 'This project is the future.' });

    expect(result.decision_state).toBe('unproven');
    expect(result.receipt_strength).toBe('no_receipts');
  });
});

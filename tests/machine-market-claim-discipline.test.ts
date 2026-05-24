import { describe, expect, it } from 'vitest';
import {
  resolveMachinePaymentStatus,
  resolveMachineReceiptTaxonomy,
  summarizeMachineEvidenceCounts
} from '../src/services/machineMarketService';

describe('machine market claim discipline', () => {
  it('keeps market-wide execution claims at zero while counting service-specific execution receipts', () => {
    const counts = summarizeMachineEvidenceCounts([{
      receipt_type: 'machine_execution',
      execution_service_id: 'alibaba-machine-translation-general',
      execution_occurred: true,
      execution_status: 'succeeded',
      payment_occurred: false,
      payment_evidence: null,
      evidence_stage: 'execution-tested'
    }]);

    expect(counts.robotic_sh_market_wide_execution_claims).toBe(0);
    expect(counts.service_specific_execution_receipts).toBe(1);
  });

  it('keeps payment success claims at zero when payment is not confirmed', () => {
    const counts = summarizeMachineEvidenceCounts([{
      receipt_type: 'machine_execution',
      execution_service_id: 'alibaba-machine-translation-general',
      execution_occurred: true,
      execution_status: 'succeeded',
      payment_occurred: false,
      payment_evidence: null,
      evidence_stage: 'execution-tested'
    }]);

    expect(resolveMachinePaymentStatus({ payment_occurred: false, payment_evidence: null })).toBe('not_confirmed');
    expect(counts.payment_success_claims).toBe(0);
  });

  it('does not count benchmark/winner claims without benchmark artifacts or criteria', () => {
    const counts = summarizeMachineEvidenceCounts([
      {
        receipt_type: 'machine_execution',
        execution_service_id: 'alibaba-machine-translation-general',
        execution_occurred: true,
        execution_status: 'succeeded',
        payment_occurred: false,
        payment_evidence: null,
        evidence_stage: 'repeatability-recorded'
      },
      // Pay.sh-side benchmark metadata must not become Machine Market benchmark claims.
      {
        receipt_type: 'benchmark_artifact',
        execution_service_id: 'pay-sh-benchmark-lane',
        execution_occurred: true,
        execution_status: 'succeeded',
        payment_occurred: false,
        payment_evidence: null,
        evidence_stage: 'benchmark-recorded'
      } as any
    ]);

    expect(counts.benchmark_claims).toBe(0);
    expect(counts.winner_claims).toBe(0);
  });

  it('classifies execution receipts as service-specific unless payment evidence confirms payment', () => {
    const serviceExecution = resolveMachineReceiptTaxonomy({
      receipt_type: 'machine_execution',
      execution_service_id: 'alibaba-machine-translation-general',
      execution_occurred: true,
      payment_occurred: false,
      payment_evidence: null,
      evidence_stage: 'execution-tested'
    });
    expect(serviceExecution.scope).toBe('service_execution');
    expect(serviceExecution.payment_status).toBe('not_confirmed');

    const confirmedPayment = resolveMachineReceiptTaxonomy({
      receipt_type: 'machine_execution',
      execution_service_id: 'alibaba-machine-translation-general',
      execution_occurred: true,
      payment_occurred: true,
      payment_evidence: 'tx:0xabc',
      evidence_stage: 'execution-tested'
    });
    expect(confirmedPayment.scope).toBe('payment_confirmation');
    expect(confirmedPayment.payment_status).toBe('confirmed');
  });
});


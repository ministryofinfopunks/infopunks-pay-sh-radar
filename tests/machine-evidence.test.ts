import { describe, expect, it } from 'vitest';
import {
  canClaimBenchmarkRecorded,
  canClaimExecutionTested,
  canClaimReceiptRecorded,
  compareEvidenceStages,
  evidenceStageRank,
  formatEvidenceStage,
  getEvidenceStageDescription
} from '../src/services/machineEvidenceService';

describe('machine evidence semantics', () => {
  it('ranks and compares evidence stages', () => {
    expect(evidenceStageRank('listed')).toBeGreaterThanOrEqual(0);
    expect(evidenceStageRank('unknown-stage')).toBe(-1);
    expect(compareEvidenceStages('classified', 'listed')).toBeGreaterThan(0);
    expect(compareEvidenceStages('listed', 'benchmark-recorded')).toBeLessThan(0);
  });

  it('guards execution claims by stage', () => {
    expect(canClaimExecutionTested({ evidence_stage: 'policy-mapped' })).toBe(false);
    expect(canClaimExecutionTested({ evidence_stage: 'execution-tested' })).toBe(true);
    expect(canClaimReceiptRecorded({ evidence_stage: 'execution-tested' })).toBe(false);
    expect(canClaimReceiptRecorded({ evidence_stage: 'receipt-recorded' })).toBe(true);
    expect(canClaimBenchmarkRecorded({ evidence_stage: 'receipt-recorded' })).toBe(false);
    expect(canClaimBenchmarkRecorded({ evidence_stage: 'benchmark-recorded' })).toBe(true);
  });

  it('formats and describes evidence stages', () => {
    expect(formatEvidenceStage('policy-mapped')).toBe('policy-mapped');
    expect(formatEvidenceStage(null)).toBe('none');
    expect(getEvidenceStageDescription('listed')).toBe('Service was observed in the robotic.sh market snapshot.');
    expect(getEvidenceStageDescription('classified')).toBe('Service has category, source market, and chain metadata.');
    expect(getEvidenceStageDescription('policy-mapped')).toBe('Service has a machine use case, policy risk, and caveats.');
    expect(getEvidenceStageDescription('preflight-ready')).toBe("Service can be evaluated by Radar's machine preflight policy engine.");
    expect(getEvidenceStageDescription('execution-tested')).toBe('Service execution-tested remains inactive until a real recorded service call occurs.');
    expect(getEvidenceStageDescription('receipt-recorded')).toBe('Receipt-recorded means a decision receipt unless explicitly marked as execution or payment receipt.');
    expect(getEvidenceStageDescription('benchmark-recorded')).toBe('Benchmark-recorded remains inactive until repeatable benchmark artifacts exist.');
  });
});

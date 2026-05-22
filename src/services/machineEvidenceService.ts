import { MachineMarketEvidenceStage } from './machineMarketService';

export const MACHINE_EVIDENCE_STAGES: MachineMarketEvidenceStage[] = [
  'listed',
  'classified',
  'policy-mapped',
  'preflight-ready',
  'execution-tested',
  'receipt-recorded',
  'benchmark-recorded'
];

const EVIDENCE_STAGE_DESCRIPTION: Record<MachineMarketEvidenceStage, string> = {
  listed: 'Service was observed in the robotic.sh market snapshot.',
  classified: 'Service has category, source market, and chain metadata.',
  'policy-mapped': 'Service has a machine use case, policy risk, and caveats.',
  'preflight-ready': 'Service can be evaluated by Radar\'s machine preflight policy engine.',
  'execution-tested': 'Service has been called in a recorded test.',
  'receipt-recorded': 'A decision or execution receipt has been recorded.',
  'benchmark-recorded': 'A benchmark artifact exists with repeatable run data.'
};

export function evidenceStageRank(stage: string | null | undefined): number {
  if (!stage) return -1;
  return MACHINE_EVIDENCE_STAGES.indexOf(stage as MachineMarketEvidenceStage);
}

export function compareEvidenceStages(a: string | null | undefined, b: string | null | undefined): number {
  return evidenceStageRank(a) - evidenceStageRank(b);
}

export function canClaimExecutionTested(serviceOrReceipt: { evidence_stage?: string | null } | null | undefined): boolean {
  return compareEvidenceStages(serviceOrReceipt?.evidence_stage, 'execution-tested') >= 0;
}

export function canClaimReceiptRecorded(serviceOrReceipt: { evidence_stage?: string | null } | null | undefined): boolean {
  return compareEvidenceStages(serviceOrReceipt?.evidence_stage, 'receipt-recorded') >= 0;
}

export function canClaimBenchmarkRecorded(serviceOrReceipt: { evidence_stage?: string | null } | null | undefined): boolean {
  return compareEvidenceStages(serviceOrReceipt?.evidence_stage, 'benchmark-recorded') >= 0;
}

export function formatEvidenceStage(stage: string | null | undefined): string {
  if (!stage) return 'none';
  if (stage === 'policy-mapped') return 'policy-mapped';
  if (stage === 'preflight-ready') return 'preflight-ready';
  if (stage === 'execution-tested') return 'execution-tested';
  if (stage === 'receipt-recorded') return 'receipt-recorded';
  if (stage === 'benchmark-recorded') return 'benchmark-recorded';
  if (stage === 'listed' || stage === 'classified') return stage;
  return stage;
}

export function getEvidenceStageDescription(stage: string | null | undefined): string {
  if (!stage) return 'No evidence stage has been recorded.';
  return EVIDENCE_STAGE_DESCRIPTION[stage as MachineMarketEvidenceStage] ?? 'Evidence stage is not recognized in this phase scope.';
}

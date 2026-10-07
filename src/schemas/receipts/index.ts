export * from './observationReceipt';
export * from './judgmentReceipt';
export * from './executionReceipt';
export * from './evaluationReceipt';
export const CANONICAL_RECEIPT_SCHEMA_VERSION = 'canonical-receipts.v1' as const;
export type ReceiptKind = 'observation' | 'judgment' | 'execution' | 'evaluation';

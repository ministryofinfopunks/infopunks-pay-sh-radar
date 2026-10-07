import type { EvaluationReceipt } from '../schemas/receipts';
import type { ReceiptAppendStore } from '../services/receiptAuthorityService';
export interface EvaluationReceiptRepository {
  append(receipt: EvaluationReceipt): Promise<EvaluationReceipt>;
  get(id: string): Promise<EvaluationReceipt | null>;
  list(): Promise<EvaluationReceipt[]>;
}
export function createEvaluationReceiptRepository(store: ReceiptAppendStore): EvaluationReceiptRepository {
  return {
    append: (receipt) => store.append('evaluation', receipt) as Promise<EvaluationReceipt>,
    get: (id) => store.get('evaluation', id) as Promise<EvaluationReceipt | null>,
    list: () => store.list('evaluation') as Promise<EvaluationReceipt[]>
  };
}

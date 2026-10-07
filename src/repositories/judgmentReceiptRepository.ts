import type { JudgmentReceipt } from '../schemas/receipts';
import type { ReceiptAppendStore } from '../services/receiptAuthorityService';
export interface JudgmentReceiptRepository {
  append(receipt: JudgmentReceipt): Promise<JudgmentReceipt>;
  get(id: string): Promise<JudgmentReceipt | null>;
  list(): Promise<JudgmentReceipt[]>;
}
export function createJudgmentReceiptRepository(store: ReceiptAppendStore): JudgmentReceiptRepository {
  return {
    append: (receipt) => store.append('judgment', receipt) as Promise<JudgmentReceipt>,
    get: (id) => store.get('judgment', id) as Promise<JudgmentReceipt | null>,
    list: () => store.list('judgment') as Promise<JudgmentReceipt[]>
  };
}

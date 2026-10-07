import type { ExecutionReceipt } from '../schemas/receipts';
import type { ReceiptAppendStore } from '../services/receiptAuthorityService';
export interface ExecutionReceiptRepository {
  append(receipt: ExecutionReceipt): Promise<ExecutionReceipt>;
  get(id: string): Promise<ExecutionReceipt | null>;
  list(): Promise<ExecutionReceipt[]>;
}
export function createExecutionReceiptRepository(store: ReceiptAppendStore): ExecutionReceiptRepository {
  return {
    append: (receipt) => store.append('execution', receipt) as Promise<ExecutionReceipt>,
    get: (id) => store.get('execution', id) as Promise<ExecutionReceipt | null>,
    list: () => store.list('execution') as Promise<ExecutionReceipt[]>
  };
}

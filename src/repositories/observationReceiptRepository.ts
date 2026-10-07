import type { ObservationReceipt } from '../schemas/receipts';
import type { ReceiptAppendStore } from '../services/receiptAuthorityService';
export interface ObservationReceiptRepository {
  append(receipt: ObservationReceipt): Promise<ObservationReceipt>;
  get(id: string): Promise<ObservationReceipt | null>;
  list(): Promise<ObservationReceipt[]>;
}
export function createObservationReceiptRepository(store: ReceiptAppendStore): ObservationReceiptRepository {
  return {
    append: (receipt) => store.append('observation', receipt) as Promise<ObservationReceipt>,
    get: (id) => store.get('observation', id) as Promise<ObservationReceipt | null>,
    list: () => store.list('observation') as Promise<ObservationReceipt[]>
  };
}

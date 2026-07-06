import {
  DEFAULT_REVENUE_RECEIPT_USE_OF_FUNDS_POLICY,
  revenueReceipts
} from '../data/revenueReceipts';
import {
  RevenueReceiptListSchema,
  RevenueReceiptSchema,
  RevenueReceiptSummarySchema,
  type RevenueReceipt,
  type RevenueReceiptList,
  type RevenueReceiptSummary
} from '../schemas/entities';

export const REVENUE_RECEIPTS_GENERATED_AT = '2026-07-06T10:00:00.000Z';

export const REVENUE_RECEIPTS_COPY = {
  title: 'Infopunks Revenue Receipts',
  tagline: 'No receipt, no trust.',
  subline: 'Public ledger for paid evaluations, bounties, reports, listings, studio work, and API access.',
  trustLine: 'Projects can buy evaluation, not conviction.',
  warningLine: 'Template receipts are examples only. They are not real revenue.'
} as const;

export function listRevenueReceipts(): RevenueReceipt[] {
  return revenueReceipts.map((receipt) => RevenueReceiptSchema.parse(receipt));
}

export function getRevenueReceipt(receiptId: string): RevenueReceipt | null {
  const receipt = revenueReceipts.find((item) => item.id === receiptId);
  return receipt ? RevenueReceiptSchema.parse(receipt) : null;
}

export function buildRevenueReceiptList(): RevenueReceiptList {
  const receipts = listRevenueReceipts();
  return RevenueReceiptListSchema.parse({
    generated_at: REVENUE_RECEIPTS_GENERATED_AT,
    count: receipts.length,
    receipts
  });
}

export function buildRevenueReceiptSummary(): RevenueReceiptSummary {
  const receipts = listRevenueReceipts();
  return RevenueReceiptSummarySchema.parse({
    generated_at: REVENUE_RECEIPTS_GENERATED_AT,
    title: REVENUE_RECEIPTS_COPY.title,
    tagline: REVENUE_RECEIPTS_COPY.tagline,
    subline: REVENUE_RECEIPTS_COPY.subline,
    trust_line: REVENUE_RECEIPTS_COPY.trustLine,
    warning_line: REVENUE_RECEIPTS_COPY.warningLine,
    use_of_funds_policy: DEFAULT_REVENUE_RECEIPT_USE_OF_FUNDS_POLICY,
    receipts
  });
}

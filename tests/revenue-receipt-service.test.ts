import { describe, expect, it } from 'vitest';
import { DEFAULT_REVENUE_RECEIPT_USE_OF_FUNDS_POLICY } from '../src/data/revenueReceipts';
import {
  buildRevenueReceiptList,
  buildRevenueReceiptSummary,
  getRevenueReceipt,
  listRevenueReceipts
} from '../src/services/revenueReceiptService';

describe('revenue receipt service', () => {
  it('returns the seeded public receipt set', () => {
    const receipts = listRevenueReceipts();

    expect(receipts.map((receipt) => receipt.id)).toEqual([
      'rr_open_evaluation_slot',
      'rr_template_001',
      'rr_unicorn_radar_build'
    ]);
    expect(receipts.map((receipt) => receipt.status)).toEqual(['open_slot', 'pending', 'completed']);
    expect(receipts.map((receipt) => receipt.source)).toEqual([
      'sponsored_radar_evaluation',
      'sponsored_radar_evaluation',
      'internal_build'
    ]);
  });

  it('uses the default use-of-funds policy and computes the open-slot allocation', () => {
    expect(DEFAULT_REVENUE_RECEIPT_USE_OF_FUNDS_POLICY).toEqual([
      { bucket: 'product_treasury', percentage: 40 },
      { bucket: 'hunter_rewards', percentage: 30 },
      { bucket: 'community_ops', percentage: 20 },
      { bucket: 'content_design_bounties', percentage: 10 }
    ]);

    const openSlot = getRevenueReceipt('rr_open_evaluation_slot');
    expect(openSlot?.useOfFunds).toEqual([
      { bucket: 'product_treasury', percentage: 40, amount_usd: 40 },
      { bucket: 'hunter_rewards', percentage: 30, amount_usd: 30 },
      { bucket: 'community_ops', percentage: 20, amount_usd: 20 },
      { bucket: 'content_design_bounties', percentage: 10, amount_usd: 10 }
    ]);
    expect(openSlot?.hunterReward).toBe(30);
  });

  it('never seeds fake completed revenue receipt #001', () => {
    const receipts = listRevenueReceipts();

    expect(receipts.some((receipt) => receipt.receiptNumber === '001')).toBe(false);
    expect(getRevenueReceipt('rr_template_001')).toEqual(expect.objectContaining({
      receiptNumber: 'Template',
      amount: 0,
      status: 'pending',
      notes: expect.arrayContaining(['Not real revenue.', 'Not Revenue Receipt #001.'])
    }));
  });

  it('builds summary and list payloads with trust copy', () => {
    const summary = buildRevenueReceiptSummary();
    const list = buildRevenueReceiptList();

    expect(summary).toEqual(expect.objectContaining({
      title: 'Infopunks Revenue Receipts',
      tagline: 'No receipt, no trust.',
      trust_line: 'Projects can buy evaluation, not conviction.',
      receipts: expect.arrayContaining([expect.objectContaining({ id: 'rr_unicorn_radar_build' })])
    }));
    expect(list.count).toBe(3);
  });
});


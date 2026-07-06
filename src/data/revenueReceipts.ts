import type { RevenueReceipt, RevenueReceiptUseOfFundsAllocation } from '../schemas/entities';

const RECEIPT_PUBLISHED_AT = '2026-07-06T10:00:00.000Z';

export const DEFAULT_REVENUE_RECEIPT_USE_OF_FUNDS_POLICY = [
  { bucket: 'product_treasury', percentage: 40 },
  { bucket: 'hunter_rewards', percentage: 30 },
  { bucket: 'community_ops', percentage: 20 },
  { bucket: 'content_design_bounties', percentage: 10 }
] as const satisfies ReadonlyArray<Pick<RevenueReceiptUseOfFundsAllocation, 'bucket' | 'percentage'>>;

function buildUseOfFunds(amount: number): RevenueReceiptUseOfFundsAllocation[] {
  return DEFAULT_REVENUE_RECEIPT_USE_OF_FUNDS_POLICY.map((allocation) => ({
    bucket: allocation.bucket,
    percentage: allocation.percentage,
    amount_usd: amount > 0 ? Number(((amount * allocation.percentage) / 100).toFixed(2)) : 0
  }));
}

export const revenueReceipts: RevenueReceipt[] = [
  {
    id: 'rr_open_evaluation_slot',
    receiptNumber: 'Open Slot',
    title: 'Open Unicorn Radar Evaluation Slot',
    source: 'sponsored_radar_evaluation',
    clientName: 'Open',
    clientType: 'project',
    amount: 100,
    currency: 'USD',
    status: 'open_slot',
    publishedAt: RECEIPT_PUBLISHED_AT,
    completedAt: null,
    relatedProduct: 'Unicorn Radar',
    relatedCandidateId: null,
    relatedCandidateUrl: null,
    disclosure: 'Projects can buy evaluation, not conviction.',
    verdictIndependenceStatement: 'Payment does not guarantee a positive verdict.',
    useOfFunds: buildUseOfFunds(100),
    hunterReward: 30,
    txHash: null,
    paymentMethod: null,
    notes: [
      'Introductory paid evaluation slot.',
      'Completed work will receive a public receipt.',
      'Paid status must be disclosed if the evaluated project receives a public candidate card.'
    ],
    ogImageUrl: '/og/revenue-receipts/rr_open_evaluation_slot.png'
  },
  {
    id: 'rr_template_001',
    receiptNumber: 'Template',
    title: 'Revenue Receipt Template',
    source: 'sponsored_radar_evaluation',
    clientName: 'Example',
    clientType: 'example',
    amount: 0,
    currency: 'USD',
    status: 'pending',
    publishedAt: RECEIPT_PUBLISHED_AT,
    completedAt: null,
    relatedProduct: 'Unicorn Radar',
    relatedCandidateId: null,
    relatedCandidateUrl: null,
    disclosure: 'This is a template showing how completed revenue receipts will be published.',
    verdictIndependenceStatement: 'Projects can buy evaluation, not conviction.',
    useOfFunds: buildUseOfFunds(0),
    hunterReward: null,
    txHash: null,
    paymentMethod: null,
    notes: [
      'Template only.',
      'Not real revenue.',
      'Not Revenue Receipt #001.'
    ],
    ogImageUrl: '/og/revenue-receipts/rr_template_001.png'
  },
  {
    id: 'rr_unicorn_radar_build',
    receiptNumber: 'Build Receipt',
    title: 'Unicorn Radar Internal Build Receipt',
    source: 'internal_build',
    clientName: 'Infopunks',
    clientType: 'internal',
    amount: 0,
    currency: 'USD',
    status: 'completed',
    publishedAt: RECEIPT_PUBLISHED_AT,
    completedAt: RECEIPT_PUBLISHED_AT,
    relatedProduct: 'Unicorn Radar',
    relatedCandidateId: null,
    relatedCandidateUrl: null,
    disclosure: 'Internal build receipt. No paid coverage.',
    verdictIndependenceStatement: 'Unicorn Radar launched with verified candidates before paid coverage.',
    useOfFunds: buildUseOfFunds(0),
    hunterReward: null,
    txHash: null,
    paymentMethod: 'internal ledger',
    notes: [
      'Verified production candidates shipped before paid coverage.',
      'DexScreener market data is attributed separately.',
      'Infopunks verdicts remain independent.'
    ],
    ogImageUrl: '/og/revenue-receipts/rr_unicorn_radar_build.png'
  }
];


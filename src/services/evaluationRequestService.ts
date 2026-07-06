import { randomBytes } from 'node:crypto';
import {
  EvaluationRequestInputSchema,
  EvaluationRequestResponseSchema,
  type EvaluationRequest,
  type EvaluationRequestInput,
  type EvaluationRequestResponse
} from '../schemas/entities';

export const EVALUATION_REVENUE_RECEIPT_POLICY = 'Paid evaluations may receive public Revenue Receipts. Payment buys evaluation, not conviction.';
export const EVALUATION_DISCLOSURE_MESSAGE = 'You must acknowledge that payment buys evaluation, not conviction.';

type CreateEvaluationRequestOptions = {
  webhookUrl?: string | null;
  fetchImpl?: typeof fetch;
  now?: Date;
  randomSuffix?: string;
};

type WebhookPayload = {
  request_id: string;
  generated_at: string;
  disclosure_acknowledged: true;
  revenue_receipt_policy: typeof EVALUATION_REVENUE_RECEIPT_POLICY;
  evaluation_request: EvaluationRequest;
};

export class EvaluationRequestValidationError extends Error {
  readonly code: 'DISCLOSURE_REQUIRED' | 'INVALID_REQUEST';
  readonly statusCode = 400;
  readonly issues?: Array<{ path: string; message: string }>;

  constructor(code: 'DISCLOSURE_REQUIRED' | 'INVALID_REQUEST', message: string, issues?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'EvaluationRequestValidationError';
    this.code = code;
    this.issues = issues;
  }
}

function normalizeRequiredString(value: string | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value: string | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function omitNullishFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== '')
  ) as Partial<T>;
}

function createRequestId(now: Date, randomSuffix = randomBytes(3).toString('hex')) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = randomSuffix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'manual';
  return `er_${stamp}_${suffix}`;
}

function createRequestPacket(requestId: string, generatedAt: string, evaluationRequest: EvaluationRequest) {
  return JSON.stringify({
    request_id: requestId,
    generated_at: generatedAt,
    submitted_at: evaluationRequest.submittedAt,
    disclosure_acknowledged: true,
    revenue_receipt_policy: EVALUATION_REVENUE_RECEIPT_POLICY,
    policy_note: 'Payment buys evaluation, not conviction. Any paid status may be publicly disclosed.',
    evaluation_request: omitNullishFields({
      ...evaluationRequest,
      submittedAt: evaluationRequest.submittedAt
    })
  }, null, 2);
}

function validateAndNormalize(input: EvaluationRequestInput, now: Date, requestId: string): EvaluationRequest {
  const issues: Array<{ path: string; message: string }> = [];

  const projectName = normalizeRequiredString(input.projectName);
  if (!projectName) issues.push({ path: 'projectName', message: 'Required' });

  const ticker = normalizeRequiredString(input.ticker);
  if (!ticker) issues.push({ path: 'ticker', message: 'Required' });

  const chain = normalizeRequiredString(input.chain);
  if (!chain) issues.push({ path: 'chain', message: 'Required' });

  const contact = normalizeRequiredString(input.contact);
  if (!contact) issues.push({ path: 'contact', message: 'Required' });

  const upsideThesis = normalizeRequiredString(input.upsideThesis);
  if (!upsideThesis) issues.push({ path: 'upsideThesis', message: 'Required' });

  const riskFlags = normalizeRequiredString(input.riskFlags);
  if (!riskFlags) issues.push({ path: 'riskFlags', message: 'Required' });

  if (input.disclosureAcknowledged !== true) {
    throw new EvaluationRequestValidationError('DISCLOSURE_REQUIRED', EVALUATION_DISCLOSURE_MESSAGE);
  }

  if (issues.length > 0) {
    throw new EvaluationRequestValidationError('INVALID_REQUEST', 'Missing required evaluation request fields.', issues);
  }

  return {
    id: requestId,
    projectName,
    ticker,
    chain,
    tokenAddress: normalizeOptionalString(input.tokenAddress),
    website: normalizeOptionalString(input.website),
    xAccount: normalizeOptionalString(input.xAccount),
    contact,
    dexScreenerUrl: normalizeOptionalString(input.dexScreenerUrl),
    solscanUrl: normalizeOptionalString(input.solscanUrl),
    marketCap: normalizeOptionalString(input.marketCap),
    liquidity: normalizeOptionalString(input.liquidity),
    holderCount: normalizeOptionalString(input.holderCount),
    top10HolderConcentration: normalizeOptionalString(input.top10HolderConcentration),
    top25HolderConcentration: normalizeOptionalString(input.top25HolderConcentration),
    supplyNotes: normalizeOptionalString(input.supplyNotes),
    launchStructure: normalizeOptionalString(input.launchStructure),
    teamTreasuryWallets: normalizeOptionalString(input.teamTreasuryWallets),
    productReceipts: normalizeOptionalString(input.productReceipts),
    marketplaceEconomyReceipts: normalizeOptionalString(input.marketplaceEconomyReceipts),
    communityReceipts: normalizeOptionalString(input.communityReceipts),
    upsideThesis,
    riskFlags,
    whyNow: normalizeOptionalString(input.whyNow),
    requestedReviewType: input.requestedReviewType ?? 'unicorn_radar_evaluation',
    paidEvaluationBudget: normalizeOptionalString(input.paidEvaluationBudget),
    disclosureAcknowledged: true,
    submittedAt: now.toISOString()
  };
}

async function deliverToWebhook(webhookUrl: string, payload: WebhookPayload, fetchImpl: typeof fetch) {
  const response = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`webhook_delivery_failed_${response.status}`);
}

export async function createEvaluationRequest(
  rawInput: unknown,
  options: CreateEvaluationRequestOptions = {}
): Promise<EvaluationRequestResponse> {
  const parsed = EvaluationRequestInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new EvaluationRequestValidationError(
      'INVALID_REQUEST',
      'Invalid evaluation request payload.',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.') || 'body', message: issue.message }))
    );
  }

  const now = options.now ?? new Date();
  const requestId = createRequestId(now, options.randomSuffix);
  const evaluationRequest = validateAndNormalize(parsed.data, now, requestId);
  const generatedAt = now.toISOString();
  const requestPacket = createRequestPacket(requestId, generatedAt, evaluationRequest);
  const webhookUrl = options.webhookUrl ?? process.env.EVALUATION_REQUEST_WEBHOOK_URL ?? null;
  const fetchImpl = options.fetchImpl ?? fetch;

  const baseResponse = {
    request_id: requestId,
    generated_at: generatedAt,
    disclosure_acknowledged: true as const,
    revenue_receipt_policy: EVALUATION_REVENUE_RECEIPT_POLICY,
    request_packet: requestPacket,
    evaluation_request: evaluationRequest
  };

  if (webhookUrl) {
    try {
      await deliverToWebhook(webhookUrl, {
        request_id: requestId,
        generated_at: generatedAt,
        disclosure_acknowledged: true,
        revenue_receipt_policy: EVALUATION_REVENUE_RECEIPT_POLICY,
        evaluation_request: evaluationRequest
      }, fetchImpl);

      return EvaluationRequestResponseSchema.parse({
        ...baseResponse,
        status: 'accepted',
        next_steps: [
          'Infopunks intake received the request packet.',
          'Payment buys evaluation, not conviction.',
          'Paid status may be publicly disclosed through Revenue Receipts.'
        ]
      });
    } catch {
      // Fall through to the honest manual-delivery path when configured intake is unavailable.
    }
  }

  return EvaluationRequestResponseSchema.parse({
    ...baseResponse,
    status: 'manual_delivery_required',
    next_steps: [
      'Copy the request packet below.',
      'Send it to Infopunks through the current manual intake channel.',
      'Paid evaluation does not guarantee a positive verdict. Strong risks may result in Watchlist or Do Not Touch Yet.'
    ]
  });
}

import { CanonicalJudgmentResponseSchema } from '../schemas/preSpend';
import { getApiBaseUrl, toApiUrl } from './apiBaseUrl';
import type { PreSpendCheckRequest } from '../schemas/entities';

/** No payment header, transaction signature or automatic payment retry belongs in the browser check. */
export async function requestJudgment(input: PreSpendCheckRequest, idempotencyKey: string, signal: AbortSignal, apiKey?: string) {
  const authorization = apiKey?.trim();
  const response = await fetch(toApiUrl(getApiBaseUrl(), '/v1/pre-spend/check'), {
    method: 'POST', signal, cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
    body: JSON.stringify(input)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok && response.status !== 402) throw new Error(response.status === 429
    ? 'Too many checks. Wait a minute, then try again.'
    : response.status === 401 ? 'Enter a valid tenant access key. Your wallet has not been used.'
      : response.status === 503 ? 'Tenant identity is unavailable. No Judgment was issued and your wallet was not used.'
        : 'Check unavailable. Your wallet has not been used. Try again.');
  const parsed = CanonicalJudgmentResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error('The check returned an invalid judgment. Try again.');
  return { judgment: parsed.data, quoted: response.status === 402 };
}

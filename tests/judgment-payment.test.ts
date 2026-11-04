// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from '@x402/core/http';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { ECONOMIC_RAILS } from '../src/security/economicRails';
import { createBrowserPaymentSignature, decodePaymentResponseHeader, parseJudgmentPaymentQuote } from '../src/web/judgmentPayment';
import type { CanonicalJudgmentResponse } from '../src/schemas/preSpend';

const resourceUrl = 'http://localhost/v1/pre-spend/check';
const requirement: PaymentRequirements = {
  scheme: 'exact', network: 'eip155:4663', asset: ECONOMIC_RAILS['eip155:4663'].token,
  payTo: '0x2222222222222222222222222222222222222222', amount: '10000', maxTimeoutSeconds: 120,
  extra: { name: 'Global Dollar', version: '1', assetTransferMethod: 'eip3009' }
};
const challenge: PaymentRequired = {
  x402Version: 2, accepts: [requirement], resource: { url: resourceUrl, description: 'Canonical pre-spend judgment', mimeType: 'application/json' }
};
const judgment: CanonicalJudgmentResponse = {
  judgment_id: 'judgment_fixture', decision: 'proceed', confidence: 90,
  issued_at: '2026-11-04T00:00:00.000Z', valid_until: '2026-11-04T00:01:00.000Z',
  reasons: ['Fixture evidence is sufficient.'], cited_observations: ['observation_fixture'],
  cost: { amount: '0.01', asset: 'USDG' }, payment_required: true, receipt: null
};

afterEach(() => {
  vi.restoreAllMocks();
  delete window.ethereum;
});

it('accepts only a matching single-rail x402 quote for the current resource', () => {
  const parsed = parseJudgmentPaymentQuote(encodePaymentRequiredHeader(challenge), judgment, resourceUrl);
  expect(parsed.requirement).toMatchObject({ network: 'eip155:4663', amount: '10000', payTo: requirement.payTo });
  expect(() => parseJudgmentPaymentQuote(encodePaymentRequiredHeader(challenge), judgment, 'https://elsewhere.invalid/v1/pre-spend/check')).toThrow('payment_challenge_not_supported');
  expect(() => parseJudgmentPaymentQuote(encodePaymentRequiredHeader({ ...challenge, accepts: [requirement, requirement] }), judgment, resourceUrl)).toThrow('payment_challenge_not_supported');
  expect(() => parseJudgmentPaymentQuote(encodePaymentRequiredHeader(challenge), { ...judgment, cost: { amount: '0.02', asset: 'USDG' } }, resourceUrl)).toThrow('payment_challenge_mismatch');
  expect(() => parseJudgmentPaymentQuote(encodePaymentRequiredHeader(challenge), { ...judgment, receipt: { judgment_id: 'already-issued' } as never }, resourceUrl)).toThrow('payment_challenge_unavailable');
  expect(() => parseJudgmentPaymentQuote(encodePaymentRequiredHeader({ ...challenge, accepts: [{ ...requirement, network: 'eip155:8453', asset: ECONOMIC_RAILS['eip155:8453'].token, extra: {} }] }), { ...judgment, cost: { amount: '0.01', asset: 'USDC' } }, resourceUrl)).toThrow('payment_challenge_not_supported');
  expect(() => parseJudgmentPaymentQuote(encodePaymentRequiredHeader({ ...challenge, accepts: [{ ...requirement, extra: { name: 'Unverified token', version: '1', assetTransferMethod: 'eip3009' } }] }), judgment, resourceUrl)).toThrow('payment_challenge_mismatch');
});

it('creates an x402 signature only after requesting wallet accounts on the quoted network', async () => {
  const signTypedData = vi.fn(async () => '0x' + 'a'.repeat(130));
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_requestAccounts') return ['0x1111111111111111111111111111111111111111'];
    if (method === 'eth_chainId') return '0x1237';
    if (method === 'eth_signTypedData_v4') return signTypedData();
    throw new Error(`unexpected_wallet_method:${method}`);
  });
  window.ethereum = { request };
  const signature = await createBrowserPaymentSignature(parseJudgmentPaymentQuote(encodePaymentRequiredHeader(challenge), judgment, resourceUrl));
  const payload = decodePaymentSignatureHeader(signature);
  expect(payload.x402Version).toBe(2);
  expect(payload.accepted).toMatchObject({ network: 'eip155:4663', asset: requirement.asset, payTo: requirement.payTo, amount: '10000' });
  expect(signTypedData).toHaveBeenCalledTimes(1);
});

it('fails closed on wallet network mismatch or wallet denial', async () => {
  const quote = parseJudgmentPaymentQuote(encodePaymentRequiredHeader(challenge), judgment, resourceUrl);
  window.ethereum = { request: vi.fn(async ({ method }) => method === 'eth_requestAccounts' ? ['0x1111111111111111111111111111111111111111'] : '0x1') };
  await expect(createBrowserPaymentSignature(quote)).rejects.toThrow('wallet_network_mismatch');
  window.ethereum = { request: vi.fn(async ({ method }) => {
    if (method === 'eth_requestAccounts') throw Object.assign(new Error('user rejected'), { code: 4001 });
    throw new Error(`unexpected_wallet_method:${method}`);
  }) };
  await expect(createBrowserPaymentSignature(quote)).rejects.toThrow('user rejected');
});

it('accepts only successful x402 payment responses with settlement metadata', () => {
  expect(decodePaymentResponseHeader(btoa(JSON.stringify({ success: true, transaction: '0xfixture', network: 'eip155:4663' }))))
    .toEqual({ success: true, transaction: '0xfixture', network: 'eip155:4663' });
  expect(() => decodePaymentResponseHeader(null)).toThrow('payment_response_missing');
  expect(() => decodePaymentResponseHeader(btoa(JSON.stringify({ success: false })))).toThrow('payment_response_invalid');
});

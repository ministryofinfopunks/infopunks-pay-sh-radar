import { createInfopunksPreSpendClient, InfopunksPreSpendClientError } from 'infopunks-pay-sh-radar/sdk';

const client = createInfopunksPreSpendClient({
  baseUrl: 'https://radar.infopunks.fun',
  fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12_000) })
});

async function main() {
try {
  const result = await client.checkPreSpend({
    agent_id: 'agent_001', intent: 'buy_market_research', budget: 25,
    risk_tolerance: 'low', preferred_settlement: 'stablecoin', required_confidence: 80
  });
  const judgment = result.canonical_judgment;
  console.log(`Canonical decision: ${judgment?.decision ?? 'unavailable'}`);
  // Legacy diagnostic labels cannot grant permission. An absent/expired receipt stops action.
  if (!judgment?.receipt || Date.parse(judgment.valid_until) <= Date.now()) {
    console.log('No valid issued canonical receipt. Do not act.');
  } else {
    console.log('Inspect the bound evidence and policy. Execution requires separate authorization.');
  }
} catch (error) {
  if (error instanceof InfopunksPreSpendClientError && [401, 402].includes(error.status)) {
    console.log('An authorized paid integration is required. No payment or execution was attempted.');
  } else {
    throw error;
  }
}

}
void main();

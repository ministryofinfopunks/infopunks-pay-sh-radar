import { createInfopunksPreSpendClient } from 'infopunks-pay-sh-radar/sdk';

const client = createInfopunksPreSpendClient({
  baseUrl: 'https://radar.infopunks.fun'
});

const decision = await client.checkPreSpend({
  agent_id: 'agent_001',
  intent: 'buy_market_research',
  budget: 25,
  risk_tolerance: 'low',
  preferred_settlement: 'stablecoin',
  required_confidence: 75
});

console.log(`Decision: ${decision.decision}`);

if (decision.decision === 'approved') {
  console.log('Proceed');
}

if (decision.decision === 'requires_human_approval') {
  console.log('Pause for human approval');
}

if (decision.decision === 'do_not_use') {
  console.log('Abort spend');
}

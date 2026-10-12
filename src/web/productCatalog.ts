export const PRODUCT_LINKS = [
  { href: '/', label: 'Radar' },
  { href: '/solana', label: 'Solana' },
  { href: '/rh-chain-signal-desk', label: 'Robinhood Chain' },
  { href: '/#proof', label: 'Proof' },
  { href: '/developers', label: 'Developers' }
] as const;
export const ECONOMY_ENTRIES = [
  { id: 'solana', label: 'Solana Radar', title: 'Should this agent spend?', description: 'Evaluate services, providers, payment routes, costs, execution evidence, and agent readiness before committing funds.', href: '/spend-terminal', action: 'Check a Spend Route', scope: 'Advisory checks · execution separately authorized' },
  { id: 'rh', label: 'Robinhood Chain', title: 'Does this market deserve trust?', description: 'Inspect contracts, liquidity, stock-token relationships, counterparties, risk, and evidence before taking action.', href: '/rh-chain-signal-desk/market', action: 'Inspect a Market', scope: 'Read-only inspection · trading policy unqualified' }
] as const;
export const PROOF_STAGES = [
  { label: 'Observation', question: 'What was observed?', detail: 'Source, identity, freshness, and gaps. A reference alone does not prove truth.' },
  { label: 'Judgment', question: 'What does the evidence justify?', detail: 'Accepted evidence and a frozen policy determine the decision and its expiry.' },
  { label: 'Execution', question: 'What actually happened?', detail: 'A separately authorized rail acts. An independent proof must verify execution.' },
  { label: 'Evaluation', question: 'Did the outcome hold up?', detail: 'Eligible accepted evaluations inform future judgment. Unknown outcomes stay unknown.' }
] as const;

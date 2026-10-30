export { PRODUCT_LINKS, ECONOMY_ENTRIES } from './radarNavigationCatalog';
export const PROOF_STAGES = [
  { label: 'Observation', question: 'What was observed?', detail: 'Source, identity, freshness, and gaps. A reference alone does not prove truth.' },
  { label: 'Judgment', question: 'What does the evidence justify?', detail: 'Accepted evidence and a frozen policy determine the decision and its expiry.' },
  { label: 'Execution', question: 'What actually happened?', detail: 'A separately authorized rail acts. An independent proof must verify execution.' },
  { label: 'Evaluation', question: 'Did the outcome hold up?', detail: 'Eligible accepted evaluations inform future judgment. Unknown outcomes stay unknown.' }
] as const;

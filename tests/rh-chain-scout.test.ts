import { describe, expect, it } from 'vitest';
import { classifyRhChainScoutQuery, queryRhChainScout } from '../src/services/rhChainScoutService';

describe('RH Chain Scout', () => {
  it.each([
    ['What changed in the last 24h?', 'market_pulse'],
    ['Show clone and LP risks', 'risk_memory'],
    ['Is this a larger meme narrative?', 'narrative_mutation'],
    ['What does this token contract know?', 'token_context'],
    ['Show wallet and bridge access context', 'launch_context'],
    ['What happened with NOXA?', 'launch_context'],
    ['Why does NOXA fee change matter?', 'launch_context'],
    ['Why track fee claims as source_required?', 'launch_context'],
    ['What does launchpad fragmentation mean?', 'launch_context'],
    ['What changed in RH Chain narrative?', 'narrative_mutation'],
    ['Why does Vlad’s RWA messaging matter?', 'narrative_mutation'],
    ['How do memes, RWAs, and agents connect?', 'narrative_mutation'],
    ['What is meme/RWA divergence?', 'narrative_mutation'],
    ['What changed in RH Chain over the past 36 hours?', 'narrative_mutation'],
    ['Is RH Chain still just a meme chain?', 'narrative_mutation'],
    ['What does post-drama stabilization mean?', 'narrative_mutation'],
    ['Why does 4663 separate detected activity from reviewed memory?', 'narrative_mutation'],
    ['What happened in the first 4663 review cycle?', 'narrative_mutation'],
    ['How does discovery become reviewed memory?', 'narrative_mutation'],
    ['Why does 4663 not trust ticker-only discovery?', 'narrative_mutation'],
    ['What is the difference between detected and reviewed?', 'narrative_mutation'],
    ['Which RH Chain layer is gaining power?', 'narrative_mutation'],
    ['Is RH Chain still meme-led?', 'narrative_mutation'],
    ['What are cross-layer flows?', 'narrative_mutation'],
    ['Why does 4663 separate narrative momentum from verified adoption?', 'narrative_mutation'],
    ['What does it mean that the chain is sorting?', 'narrative_mutation']
  ] as const)('classifies %s', (query, mode) => expect(classifyRhChainScoutQuery(query)).toBe(mode));
  it('returns limitations, disclaimer, and no trading or approval language', () => {
    const result = queryRhChainScout({ query: 'What are the biggest risks right now?' });
    expect(result.limitations.length).toBeGreaterThan(0);
    expect(result.disclaimer).toContain('not endorsement');
    expect(result.answer.toLowerCase()).not.toMatch(/buy|sell|safe|approved/);
  });
  it('returns access context as read-only intelligence', () => {
    const result = queryRhChainScout({ query: 'Show wallet and bridge access context' });
    expect(result.answer).toContain('Access surfaces show how users arrive.');
    expect(result.answer).toContain('Backpack Wallet remains source_required');
    expect(result.supporting_access_context).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Robinhood Wallet' })]));
  });
  it('does not treat placeholder contracts as token identity', () => {
    const result = queryRhChainScout({ query: 'unverified_contract_required', mode: 'token_context' });
    expect(result.answer).toContain('Source required before identity-specific context.');
    expect(result.supporting_review_items).toEqual([]);
  });
  it('retrieves The Index only by exact contract and keeps its intake caveat', () => {
    const index = queryRhChainScout({ query: '0x56910d4409f3a0c78c64dd8d0545ff0705389870', mode: 'token_context' });
    const tickerOnly = queryRhChainScout({ query: 'INDEX', mode: 'token_context' });
    expect(index.answer).toContain('The Index');
    expect(index.answer).toContain('under receipt check');
    expect(index.answer).toContain('not an approved signal');
    expect(tickerOnly.answer).toContain('Paste one exact contract');
  });
  it('answers NOXA and fragmentation questions with cautious source-bound wording', () => {
    const noxa = queryRhChainScout({ query: 'What happened with NOXA?' });
    const fragmentation = queryRhChainScout({ query: 'What does launchpad fragmentation mean?' });
    const watched = queryRhChainScout({ query: 'Which launch surfaces are being watched?' });
    expect(noxa.answer).toContain('source-dependent context');
    expect(noxa.answer.toLowerCase()).not.toMatch(/rug|misconduct/);
    expect(fragmentation.answer).toContain('multiple launch surfaces and direct pools');
    expect(watched.answer).toContain('flap.sh');
  });
  it('answers NOXA fee-model questions with source-required caveats', () => {
    const changed = queryRhChainScout({ query: 'What changed with NOXA?' });
    const fee = queryRhChainScout({ query: 'Why does NOXA’s fee change matter?' });
    const risks = queryRhChainScout({ query: 'What are the launchpad war risks?' });
    const sourceRequired = queryRhChainScout({ query: 'Why does Infopunks track fee claims as source_required?' });
    expect(changed.answer).toContain('reported launch pause');
    expect(fee.answer).toContain('reported fee-model shift toward creator revenue');
    expect(fee.answer).toContain('source_required');
    expect(risks.answer).toContain('creator-fee confusion');
    expect(sourceRequired.answer).toContain('Primary terms or on-chain routing evidence');
  });
  it('answers leadership narrative and meme/RWA divergence questions from reviewed memory', () => {
    const changed = queryRhChainScout({ query: 'What changed in RH Chain narrative?' });
    const vlad = queryRhChainScout({ query: 'Why does Vlad’s RWA messaging matter?' });
    const connection = queryRhChainScout({ query: 'How do memes, RWAs, and agents connect?' });
    const divergence = queryRhChainScout({ query: 'What is meme/RWA divergence?' });
    expect(changed.answer).toContain('programmable RWAs');
    expect(vlad.answer).toContain('source_required');
    expect(connection.answer).toContain('automation primitive');
    expect(divergence.answer).toContain('narrative momentum can outrun actual usage');
  });
  it('answers post-drama stabilization questions with reviewed-memory boundaries', () => {
    const changed = queryRhChainScout({ query: 'What changed in RH Chain over the past 36 hours?' });
    const memeChain = queryRhChainScout({ query: 'Is RH Chain still just a meme chain?' });
    const stabilization = queryRhChainScout({ query: 'What does post-drama stabilization mean?' });
    const reviewBoundary = queryRhChainScout({ query: 'Why does 4663 separate detected activity from reviewed memory?' });
    expect(changed.answer).toContain('The chain is not cooling. It is sorting.');
    expect(memeChain.answer).toContain('CASHCAT as the benchmark attention asset');
    expect(stabilization.answer).toContain('market-structure read');
    expect(reviewBoundary.answer).toContain('Provider context never outranks a reviewed receipt');
  });
  it('answers review-cycle questions without turning discovery into a promotion', () => {
    const cycle = queryRhChainScout({ query: 'What happened in the first 4663 review cycle?' });
    const memory = queryRhChainScout({ query: 'How does discovery become reviewed memory?' });
    const ticker = queryRhChainScout({ query: 'Why does 4663 not trust ticker-only discovery?' });
    const detected = queryRhChainScout({ query: 'What is the difference between detected and reviewed?' });
    expect(cycle.answer).toContain('remains unpublished until a reviewer approves it');
    expect(memory.answer).toContain('exact contract');
    expect(ticker.answer).toContain('symbols can be duplicated');
    expect(detected.answer).toContain('Detection creates a review cue');
  });
  it('answers layer-power questions with source-bound Market Structure memory', () => {
    expect(queryRhChainScout({ query: 'Which RH Chain layer is gaining power?' }).answer).toContain('RWAs are gaining the most institutional and narrative gravity');
    expect(queryRhChainScout({ query: 'Is RH Chain still meme-led?' }).answer).toContain('CASHCAT');
    expect(queryRhChainScout({ query: 'What are cross-layer flows?' }).answer).toContain('GROKIUS remains Meme × AI narrative');
    expect(queryRhChainScout({ query: 'Why does 4663 separate narrative momentum from verified adoption?' }).answer).toContain('Reviewed memory preserves the source state');
    expect(queryRhChainScout({ query: 'What does it mean that the chain is sorting?' }).answer).toContain('structure read');
  });
});

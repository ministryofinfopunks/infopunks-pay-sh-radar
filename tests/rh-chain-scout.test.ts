import { describe, expect, it } from 'vitest';
import { classifyRhChainScoutQuery, queryRhChainScout } from '../src/services/rhChainScoutService';

describe('RH Chain Scout', () => {
  it.each([
    ['What changed in the last 24h?', 'market_pulse'],
    ['Show clone and LP risks', 'risk_memory'],
    ['Is this a larger meme narrative?', 'narrative_mutation'],
    ['What does this token contract know?', 'token_context'],
    ['Show wallet and bridge access context', 'launch_context']
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
});

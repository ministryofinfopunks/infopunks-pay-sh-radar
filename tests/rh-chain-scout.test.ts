import { describe, expect, it } from 'vitest';
import { classifyRhChainScoutQuery, queryRhChainScout } from '../src/services/rhChainScoutService';

describe('RH Chain Scout', () => {
  it.each([
    ['What changed in the last 24h?', 'market_pulse'],
    ['Show clone and LP risks', 'risk_memory'],
    ['Is this a larger meme narrative?', 'narrative_mutation'],
    ['What does this token contract know?', 'token_context']
  ] as const)('classifies %s', (query, mode) => expect(classifyRhChainScoutQuery(query)).toBe(mode));
  it('returns limitations, disclaimer, and no trading or approval language', () => {
    const result = queryRhChainScout({ query: 'What are the biggest risks right now?' });
    expect(result.limitations.length).toBeGreaterThan(0);
    expect(result.disclaimer).toContain('not endorsement');
    expect(result.answer.toLowerCase()).not.toMatch(/buy|sell|safe|approved/);
  });
});

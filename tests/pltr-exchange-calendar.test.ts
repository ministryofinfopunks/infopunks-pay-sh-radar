import { describe, expect, it } from 'vitest';
import { pltrRegularSession } from '../src/services/pltrExchangeCalendar';
describe('PLTR regular exchange calendar', () => {
  it.each([
    ['2026-10-08T13:29:59Z', 'CLOSED'], ['2026-10-08T13:30:00Z', 'OPEN'],
    ['2026-10-08T20:00:00Z', 'CLOSED'], ['2026-11-02T14:00:00Z', 'CLOSED'],
    ['2026-11-02T14:30:00Z', 'OPEN'], ['2026-11-02T21:00:00Z', 'CLOSED'],
    ['2026-11-26T16:00:00Z', 'HOLIDAY'], ['2026-11-27T17:59:59Z', 'OPEN'],
    ['2026-11-27T18:00:00Z', 'CLOSED'], ['2026-12-24T18:00:00Z', 'CLOSED'],
    ['2026-12-25T16:00:00Z', 'HOLIDAY'], ['2026-10-10T16:00:00Z', 'WEEKEND'],
    ['2027-01-04T15:00:00Z', 'UNKNOWN']
  ])('classifies %s as %s', (at, expected) => expect(pltrRegularSession(new Date(at))).toBe(expected));
  it('fails closed for invalid dates', () => expect(pltrRegularSession(new Date(NaN))).toBe('UNKNOWN'));
});

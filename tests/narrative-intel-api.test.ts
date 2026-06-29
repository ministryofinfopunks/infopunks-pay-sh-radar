import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('narrative intel api', () => {
  it('returns seeded narrative asset data', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/narratives' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.arrayContaining([
        expect.objectContaining({
          slug: 'black-bull',
          ticker: 'ANSEM',
          name: 'The Black Bull',
          chain: 'Solana',
          signal_source: 'Ansem'
        })
      ]));

      const detail = await app.inject({ method: 'GET', url: '/v1/narratives/black-bull' });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data).toEqual(expect.objectContaining({
        slug: 'black-bull',
        ticker: 'ANSEM',
        thesis: '$ANSEM is a live experiment in financialized attention, where persona, meme, wallet flows, and community belief become a tradable signal object.'
      }));
    } finally {
      await app.close();
    }
  });

  it('returns seeded signal source and report data', async () => {
    const app = await createApp(emptyIntelligenceStore());

    try {
      const list = await app.inject({ method: 'GET', url: '/v1/signals' });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toEqual(expect.arrayContaining([
        expect.objectContaining({ slug: 'ansem', type: 'signal_source' }),
        expect.objectContaining({ slug: 'black-bull', type: 'signal_report' })
      ]));

      const source = await app.inject({ method: 'GET', url: '/v1/signals/ansem' });
      expect(source.statusCode).toBe(200);
      expect(source.json().data).toEqual(expect.objectContaining({
        slug: 'ansem',
        type: 'signal_source',
        signal_source: 'Ansem'
      }));

      const report = await app.inject({ method: 'GET', url: '/v1/signals/black-bull' });
      expect(report.statusCode).toBe(200);
      expect(report.json().data).toEqual(expect.objectContaining({
        slug: 'black-bull',
        type: 'signal_report',
        signal_source: 'Ansem'
      }));
      expect(report.json().data.cards.length).toBeGreaterThanOrEqual(9);
    } finally {
      await app.close();
    }
  });
});

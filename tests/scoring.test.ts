import { describe, expect, it } from 'vitest';
import { createIntelligenceStore } from '../src/services/intelligenceStore';

describe('deterministic scoring', () => {
  it('computes bounded trust and signal assessments from available evidence', async () => {
    const store = await createIntelligenceStore();
    for (const assessment of [...store.trustAssessments, ...store.signalAssessments]) {
      expect(assessment.score).not.toBeNull();
      expect(assessment.score!).toBeGreaterThanOrEqual(0);
      expect(assessment.score!).toBeLessThanOrEqual(100);
      expect(Object.values(assessment.evidence).flat().length).toBeGreaterThan(0);
    }
  });

  it('leaves unavailable telemetry unknown instead of inventing metrics', async () => {
    const store = await createIntelligenceStore();
    expect(store.trustAssessments.every((assessment) => assessment.components.uptime === null)).toBe(true);
    expect(store.trustAssessments.every((assessment) => assessment.components.receiptReliability === null)).toBe(true);
    expect(store.signalAssessments.every((assessment) => assessment.components.socialVelocity === null)).toBe(true);
  });

  it('builds narrative clusters with provider links', async () => {
    const store = await createIntelligenceStore();
    expect(store.narratives.length).toBeGreaterThan(0);
    expect(store.narratives.some((cluster) => cluster.providerIds.length > 0)).toBe(true);
  });
});

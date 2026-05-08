import { Provider } from '../schemas/entities';
import { IntelligenceStore } from './intelligenceStore';

export type FeaturedProviderRotation = {
  providerId: string | null;
  providerName: string | null;
  category: string | null;
  rotationWindowMs: number;
  windowStartedAt: string;
  nextRotationAt: string;
  index: number | null;
  providerCount: number;
  strategy: 'time_window_round_robin';
};

export function featuredProviderRotation(store: IntelligenceStore, rotationWindowMs: number, nowMs = Date.now()): FeaturedProviderRotation {
  const providers = sortedRotationProviders(store.providers);
  const windowIndex = Math.floor(nowMs / rotationWindowMs);
  const windowStartedAtMs = windowIndex * rotationWindowMs;
  const nextRotationAtMs = windowStartedAtMs + rotationWindowMs;

  if (!providers.length) {
    return {
      providerId: null,
      providerName: null,
      category: null,
      rotationWindowMs,
      windowStartedAt: new Date(windowStartedAtMs).toISOString(),
      nextRotationAt: new Date(nextRotationAtMs).toISOString(),
      index: null,
      providerCount: 0,
      strategy: 'time_window_round_robin'
    };
  }

  const index = windowIndex % providers.length;
  const provider = providers[index];
  return {
    providerId: provider.id,
    providerName: provider.name,
    category: provider.category,
    rotationWindowMs,
    windowStartedAt: new Date(windowStartedAtMs).toISOString(),
    nextRotationAt: new Date(nextRotationAtMs).toISOString(),
    index,
    providerCount: providers.length,
    strategy: 'time_window_round_robin'
  };
}

function sortedRotationProviders(providers: Provider[]) {
  return [...providers].sort((a, b) => providerRotationKey(a).localeCompare(providerRotationKey(b)));
}

function providerRotationKey(provider: Provider) {
  return provider.fqn ?? provider.id;
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntelligenceRepository, IntelligenceSnapshot } from '../src/persistence/repository';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const { closeDatabasePoolSpy } = vi.hoisted(() => ({ closeDatabasePoolSpy: vi.fn() }));

vi.mock('../src/persistence/databasePool', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/persistence/databasePool')>();
  return { ...actual, closeDatabasePool: closeDatabasePoolSpy };
});

import { createApp } from '../src/api/app';

describe('read-only startup shutdown ordering', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('RADAR_READ_ONLY_MODE', 'true');
    vi.stubEnv('PAYSH_BOOTSTRAP_ENABLED', 'false');
    closeDatabasePoolSpy.mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([true, false])('settles the startup repository read before closing dependent database resources (read-only=%s)', async (readOnly) => {
    vi.stubEnv('RADAR_READ_ONLY_MODE', String(readOnly));
    let settleSnapshot!: (snapshot: IntelligenceSnapshot | null) => void;
    const pendingSnapshot = new Promise<IntelligenceSnapshot | null>((resolve) => {
      settleSnapshot = resolve;
    });
    const repository: IntelligenceRepository = {
      loadSnapshot: vi.fn(() => pendingSnapshot),
      saveSnapshot: vi.fn(async () => undefined)
    };

    const app = await createApp(undefined, repository);
    let closeSettled = false;
    const closing = app.close().then(() => { closeSettled = true; });
    try {
      // Allow Fastify's onClose queue to reach the resource-close hook while
      // keeping the repository read deliberately unresolved.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(repository.loadSnapshot).toHaveBeenCalledOnce();
      expect(closeSettled).toBe(false);
      expect(closeDatabasePoolSpy).not.toHaveBeenCalled();

      settleSnapshot(readOnly ? null : emptyIntelligenceStore());
      await closing;
      expect(closeSettled).toBe(true);
      expect(closeDatabasePoolSpy).toHaveBeenCalledOnce();
    } finally {
      settleSnapshot(readOnly ? null : emptyIntelligenceStore());
      await closing;
    }
  });
});

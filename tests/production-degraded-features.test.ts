import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const saved = Object.fromEntries(['NODE_ENV', 'PORT', 'INFOPUNKS_ADMIN_TOKEN', 'DATABASE_URL', 'RH_CHAIN_REVIEW_CONSOLE_ENABLED', 'RH_CHAIN_REVIEW_ADMIN_TOKEN', 'RH_CHAIN_PROJECT_CLAIMS_ENABLED', 'RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED'].map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

describe('production optional feature degradation', () => {
  it('rejects production startup without required database and catalog bindings', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '10000';
    process.env.INFOPUNKS_ADMIN_TOKEN = 'admin';
    delete process.env.DATABASE_URL;
    process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true';
    delete process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN;
    process.env.RH_CHAIN_PROJECT_CLAIMS_ENABLED = 'true';
    process.env.RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED = 'true';
    await expect(createApp(emptyIntelligenceStore())).rejects.toMatchObject({ code: 'INVALID_RUNTIME_CONFIGURATION' });
  });
});

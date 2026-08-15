import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { loadRuntimeConfig } from '../src/config/env';
import { inspectRhChainMigrationLedger, inspectRhChainOperationalReadiness } from '../src/services/rhChainProductionReadiness';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

const saved = { enabled: process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED, token: process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN, database: process.env.DATABASE_URL };
afterEach(() => {
  if (saved.enabled === undefined) delete process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED; else process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = saved.enabled;
  if (saved.token === undefined) delete process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN; else process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = saved.token;
  if (saved.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved.database;
});

describe('RH Chain production readiness', () => {
  it('reports every migration pending without a database and never attempts DDL', async () => {
    const ledger = await inspectRhChainMigrationLedger(null);
    expect(ledger.database_reachable).toBe(false);
    expect(ledger.migration_runner).toBe('external_only');
    expect(ledger.pending_migrations).toEqual(['20260719_001', '20260719_002', '20260719_003', '20260719_004', '20260719_005', '20260720_006', '20260813_007', '20260813_008', '20260814_009']);
  });

  it('builds a provider-free readiness result from schema signatures', async () => {
    const pool = { query: async (sql: string) => sql.includes('max(captured_at)') ? { rows: [{ latest_snapshot_at: new Date().toISOString() }] } : sql.includes('pg_get_constraintdef') ? { rows: [{ definition: "CHECK ((primary_layer = ANY (ARRAY['meme'::text, 'consumer'::text])))" }] } : { rows: [] } } as any;
    const config = loadRuntimeConfig({ RH_CHAIN_MARKET_HISTORY_ENABLED: 'true', RH_CHAIN_MARKET_INGESTION_ENABLED: 'true', RH_CHAIN_REVIEWED_CLASSIFICATIONS_ENABLED: 'true', RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED: 'true', RH_CHAIN_PROJECT_CLAIMS_ENABLED: 'true', RH_CHAIN_INTELLIGENCE_RECEIPTS_ENABLED: 'true', RH_CHAIN_PROJECT_DIRECTORY_ENABLED: 'true', RH_CHAIN_REVIEW_CONSOLE_ENABLED: 'true', RH_CHAIN_REVIEW_ADMIN_TOKEN: 'review-secret' });
    const readiness = await inspectRhChainOperationalReadiness({ pool, config, approvedClassificationCount: async () => 3, classificationConflictCount: async () => 1 });
    expect(readiness.migrations.pending_migrations).toEqual([]);
    expect(readiness.market_memory.freshness).toBe('fresh');
    expect(readiness.reviewed_classifications).toEqual(expect.objectContaining({ approved_count: 3, conflict_count: 1 }));
    expect(readiness.provider_requests_in_path).toBe(0);
    expect(JSON.stringify(readiness)).not.toContain('review-secret');
  });

  it('keeps the operational readiness endpoint internal and bearer-authenticated', async () => {
    delete process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED; delete process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN;
    let app = await createApp(emptyIntelligenceStore());
    expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/operational-readiness' })).statusCode).toBe(404);
    await app.close();
    process.env.RH_CHAIN_REVIEW_CONSOLE_ENABLED = 'true'; process.env.RH_CHAIN_REVIEW_ADMIN_TOKEN = 'review-secret';
    app = await createApp(emptyIntelligenceStore());
    expect((await app.inject({ method: 'GET', url: '/internal/rh-chain/operational-readiness' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/internal/rh-chain/operational-readiness', headers: { authorization: 'Bearer review-secret' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({ provider_requests_in_path: 0, critical_incident_state: 'blocked' }));
    expect(JSON.stringify(response.json())).not.toContain('DATABASE_URL');
    await app.close();
  });

  it('degrades optional production features when their dependencies are absent', () => {
    const production = { NODE_ENV: 'production', PORT: '8787', INFOPUNKS_ADMIN_TOKEN: 'admin', DATABASE_URL: 'postgres://user:password@localhost:5432/radar' };
    expect(loadRuntimeConfig({ ...production, RH_CHAIN_ATTENTION_QUALITY_V2_ENABLED: 'true' }).disabledFeatures.rh_chain_attention_quality_v2).toContain('RH_CHAIN_MARKET_HISTORY_ENABLED');
    expect(loadRuntimeConfig({ ...production, RH_CHAIN_PROJECT_CLAIMS_ENABLED: 'true' }).disabledFeatures.rh_chain_project_claims).toContain('authenticated RH Chain review console');
    expect(loadRuntimeConfig({ ...production, RH_CHAIN_PROJECT_DIRECTORY_ENABLED: 'true' }).disabledFeatures.rh_chain_project_directory).toContain('RH_CHAIN_PROJECT_CLAIMS_ENABLED');
    expect(loadRuntimeConfig(production).rhChainProjectClaimsEnabled).toBe(false);
  });

  it('keeps Phase 3 publication fail-closed until the Phase 2 production proof marker is explicit', () => {
    const production = { NODE_ENV: 'production', PORT: '8787', DATABASE_URL: 'postgres://user:password@localhost:5432/radar', RH_CHAIN_REVIEW_ADMIN_TOKEN: 'review-secret', RH_4663_RESOLUTION_PRIVATE_KEY: `0x${'11'.repeat(32)}`, RH_4663_PHASE2_ENABLED: 'true', RH_4663_PHASE3_ENABLED: 'true', RH_4663_PHASE3_INGESTION_ENABLED: 'true', RH_4663_PHASE3_CANDIDATE_GENERATION_ENABLED: 'true', RH_4663_PHASE3_PUBLICATION_ENABLED: 'true', RH_4663_AUTO_PUBLICATION_ENABLED: 'true' };
    const closed = loadRuntimeConfig(production); expect(closed.rh4663Phase3Enabled).toBe(true); expect(closed.rh4663Phase3IngestionEnabled).toBe(true); expect(closed.rh4663Phase3CandidateGenerationEnabled).toBe(true); expect(closed.rh4663Phase3PublicationEnabled).toBe(false); expect(closed.rh4663Phase3AutoPublicationEnabled).toBe(false); expect(closed.disabledFeatures.infopunks_4663_phase3_publication).toContain('proof chain');
    const opened = loadRuntimeConfig({ ...production, RH_4663_PHASE2_PRODUCTION_PROOF_VERIFIED: 'true' }); expect(opened.rh4663Phase3PublicationEnabled).toBe(true); expect(opened.rh4663Phase3AutoPublicationEnabled).toBe(true);
  });
});

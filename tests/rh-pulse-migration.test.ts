import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RH Pulse Phase 2 migration contract', () => {
  it('defines additive durable tables, final-authority constraints and immutable receipts', async () => {
    const sql = await readFile(join(process.cwd(), 'migrations/20260723_007_rh_pulse_signed_calls.up.sql'), 'utf8');
    for (const table of [
      'rh_pulse_windows',
      'rh_pulse_call_challenges',
      'rh_pulse_calls',
      'rh_pulse_call_receipts',
      'rh_pulse_counters',
      'rh_pulse_audit_events'
    ]) {
      expect(sql).toContain(`create table if not exists ${table}`);
    }
    expect(sql).toContain('unique (window_id, wallet_address)');
    expect(sql).toContain('rh_pulse_windows_one_open_idx');
    expect(sql).toMatch(/public_call_number bigint not null unique/);
    expect(sql).toMatch(/public_slug text not null unique/g);
    expect(sql).toMatch(
      /public_call_number between 1 and 4663\s+and genesis_rank is not null\s+and genesis_rank = public_call_number/
    );
    expect(sql).toContain('genesis_rank integer unique');
    expect(sql).toContain('public_call_number > 4663 and genesis_rank is null');
    expect(sql).toContain('rh_pulse_call_receipts_immutable');
    expect(sql).toContain('before update or delete on rh_pulse_call_receipts');
    expect(sql).toMatch(/\nbegin;\n/);
    expect(sql.trimEnd()).toMatch(/commit;$/);
    expect(sql).not.toMatch(/\bnonce\s+text\b/);
  });

  it('uses row locks and a rollback-safe counter inside the Postgres acceptance transaction', async () => {
    const source = await readFile(join(process.cwd(), 'src/services/rhPulseParticipationStore.ts'), 'utf8');
    expect(source).toContain('select * from rh_pulse_call_challenges where id=$1 for update');
    expect(source).toContain('select * from rh_pulse_windows where id=$1 for update');
    expect(source).toContain('select current_value from rh_pulse_counters where counter_name=$1 for update');
    expect(source).toContain("await client.query('rollback')");
    expect(source).not.toContain('nextval(');
  });

  it('refuses destructive rollback after any signed call exists', async () => {
    const sql = await readFile(join(process.cwd(), 'migrations/20260723_007_rh_pulse_signed_calls.down.sql'), 'utf8');
    expect(sql).toContain('unsafe rollback: signed RH Pulse calls exist');
    expect(sql).toContain('drop trigger if exists rh_pulse_call_receipts_immutable');
    expect(sql).toContain("delete from infopunks_schema_migrations where migration_id = ''20260723_007''");
  });
});

describe('RH Pulse Phase 3A migration contract', () => {
  it('adds deterministic resolution runs, one immutable Rotation Receipt per window and publication guards', async () => {
    const sql = await readFile(join(process.cwd(), 'migrations/20260723_008_rh_pulse_rotation_resolutions.up.sql'), 'utf8');
    expect(sql).toContain('create table if not exists rh_pulse_resolution_runs');
    expect(sql).toContain('create table if not exists rh_pulse_rotation_receipts');
    expect(sql).toContain('unique (window_id, input_manifest_hash)');
    expect(sql).toContain('unique (window_id)');
    expect(sql).toContain('rotation receipt requires an approved resolution run');
    expect(sql).toContain('rotation receipt requires a closed window');
    expect(sql).toContain('RH Pulse Rotation Receipts are immutable after publication');
    expect(sql).toContain('Published RH Pulse resolution runs are immutable');
    expect(sql).toContain('rh_pulse_resolution_runs_published_immutable');
    expect(sql).toContain("'resolution_published'");
    expect(sql).toContain("'rotation_receipt_created'");
    expect(sql).not.toContain('update rh_pulse_calls');
  });

  it('refuses destructive rollback after publication and restores the Phase 2 audit constraint', async () => {
    const sql = await readFile(join(process.cwd(), 'migrations/20260723_008_rh_pulse_rotation_resolutions.down.sql'), 'utf8');
    expect(sql).toContain('unsafe rollback: published RH Pulse Rotation Receipts exist');
    expect(sql).toContain('drop table if exists rh_pulse_rotation_receipts');
    expect(sql).toContain('drop table if exists rh_pulse_resolution_runs');
    expect(sql).toContain("delete from infopunks_schema_migrations where migration_id = ''20260723_008''");
    expect(sql.indexOf('unsafe rollback')).toBeLessThan(sql.indexOf('drop table if exists'));
  });
});

import { describe, expect, it } from 'vitest';
import { inspectMigrationDirectory, validateMigrationEntries, type MigrationFileEntry } from '../src/services/migrationInventory';

const entry = (id: string): MigrationFileEntry => ({ file: `migration_${id}.up.sql`, id, down_file: `migration_${id}.down.sql`, sha256: '0'.repeat(64) });

describe('ordered migration inventory', () => {
  it('enumerates all 21 reversible migration files and records checksums', () => {
    const result = inspectMigrationDirectory();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(21);
    expect(result.entries.every((migration) => migration.down_file && migration.sha256?.length === 64)).toBe(true);
  });

  it('rejects missing and unapplied migration sequence entries', () => {
    const rows = Array.from({ length: 21 }, (_, index) => entry(String(index + 1).padStart(3, '0'))).filter((row) => row.id !== '012');
    expect(validateMigrationEntries(rows).errors).toContain('missing_migration:012');
  });

  it('rejects duplicate migration identifiers', () => {
    const rows = Array.from({ length: 21 }, (_, index) => entry(String(index + 1).padStart(3, '0')));
    rows.splice(2, 0, entry('002'));
    expect(validateMigrationEntries(rows).errors).toContain('duplicate_migration_id:002');
  });

  it('rejects reordered migrations and missing down migrations', () => {
    const rows = Array.from({ length: 21 }, (_, index) => entry(String(index + 1).padStart(3, '0')));
    [rows[4], rows[5]] = [rows[5], rows[4]];
    rows[10] = { ...rows[10], down_file: null };
    const result = validateMigrationEntries(rows);
    expect(result.errors).toContain('migration_order_invalid:006_before_005');
    expect(result.errors).toContain('missing_down_migration:011');
  });
});

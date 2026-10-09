import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED_IDS = Array.from({ length: 21 }, (_, index) => String(index + 1).padStart(3, '0'));
const MIGRATION_FILE = /^(\d{8})_(\d{3})_([a-z0-9_]+)\.up\.sql$/;

export type MigrationFileEntry = { file: string; id: string; down_file: string | null; sha256: string | null };
export type MigrationInventory = { valid: boolean; entries: MigrationFileEntry[]; errors: string[] };

/** Validates the ordered repository migration set without applying DDL or changing files. */
export function validateMigrationEntries(entries: MigrationFileEntry[]): MigrationInventory {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) errors.push(`duplicate_migration_id:${entry.id}`);
    seen.add(entry.id);
    if (!entry.down_file) errors.push(`missing_down_migration:${entry.id}`);
  }
  const ids = entries.map((entry) => entry.id);
  const expected = EXPECTED_IDS.map((sequence) => sequence);
  for (const id of expected) if (!seen.has(id)) errors.push(`missing_migration:${id}`);
  for (const id of seen) if (!expected.includes(id)) errors.push(`unexpected_migration:${id}`);
  for (let index = 1; index < ids.length; index += 1) {
    if (Number(ids[index]) < Number(ids[index - 1])) {
      errors.push(`migration_order_invalid:${ids[index - 1]}_before_${ids[index]}`);
      break;
    }
  }
  return { valid: errors.length === 0, entries, errors };
}

export function inspectMigrationDirectory(directory = join(process.cwd(), 'migrations')): MigrationInventory {
  const files = readdirSync(directory);
  const upFiles = files.filter((file) => file.endsWith('.up.sql')).sort();
  const downFiles = files.filter((file) => file.endsWith('.down.sql')).sort();
  const entries: MigrationFileEntry[] = [];
  const malformed = upFiles.filter((file) => !MIGRATION_FILE.test(file));
  for (const file of malformed) entries.push({ file, id: '000', down_file: null, sha256: null });
  const parsed = upFiles.filter((file) => MIGRATION_FILE.test(file)).map((file) => {
    const match = MIGRATION_FILE.exec(file)!;
    const id = match[2];
    const downFile = `${match[1]}_${match[2]}_${match[3]}.down.sql`;
    const content = readFileSync(join(directory, file));
    return { file, id, down_file: files.includes(downFile) ? downFile : null,
      sha256: createHash('sha256').update(content).digest('hex') };
  });
  entries.push(...parsed);
  const inventory = validateMigrationEntries(entries);
  if (malformed.length) inventory.errors.unshift(...malformed.map((file) => `malformed_migration_filename:${file}`));
  const expectedDownFiles = new Set(parsed.map((entry) => entry.down_file).filter((file): file is string => Boolean(file)));
  for (const file of downFiles) if (!expectedDownFiles.has(file)) inventory.errors.push(`orphan_down_migration:${file}`);
  inventory.valid = inventory.errors.length === 0;
  return inventory;
}

export const expectedMigrationSequences = EXPECTED_IDS;

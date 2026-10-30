import { inspectMigrationDirectory } from '../src/services/migrationInventory';

const inventory = inspectMigrationDirectory();
process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
if (!inventory.valid) process.exitCode = 1;

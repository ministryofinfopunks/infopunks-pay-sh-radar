import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverFontSource = join(root, 'src', 'server', 'fonts');
const serverFontTarget = join(root, 'dist', 'server', 'server', 'fonts');

if (existsSync(serverFontSource)) {
  mkdirSync(serverFontTarget, { recursive: true });
  cpSync(serverFontSource, serverFontTarget, { recursive: true });
}

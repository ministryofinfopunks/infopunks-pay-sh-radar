import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, lstat, readFile, open as openFile, link, unlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { JudgmentSession, JudgmentSessionStore } from './judgmentClient';

/** Node-only encrypted session storage. Use a persistent private volume and a separately retained 32-byte key. */
export function createEncryptedJudgmentSessionStore(options: { directory: string; encryptionKey: Uint8Array }): JudgmentSessionStore {
  if (options.encryptionKey.length !== 32) throw new Error('judgment_session_key_requires_32_bytes');
  const key = Buffer.from(options.encryptionKey);
  async function ensure() {
    await mkdir(options.directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(options.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('judgment_session_directory_not_private');
  }
  const path = (scope: string, id: string) => join(options.directory, createHash('sha256').update(scope + '\0' + id).digest('hex') + '.session');
  function seal(session: JudgmentSession) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  }
  async function open(file: string) {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('judgment_session_file_not_private');
    const bytes = await readFile(file); const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')) as JudgmentSession;
  }
  async function publish(file: string, session: JudgmentSession, once: boolean) {
    const temp = file + '.' + randomBytes(12).toString('hex');
    const fileHandle = await openFile(temp, 'wx', 0o600);
    try { await fileHandle.writeFile(seal(session)); await fileHandle.sync(); } finally { await fileHandle.close(); }
    try {
      if (once) { try { await link(temp, file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; } }
      else await rename(temp, file);
      const directory = await openFile(options.directory, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await unlink(temp).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }); }
  }
  async function load(scope: string, id: string) {
    await ensure();
    try {
      const session = await open(path(scope, id));
      if (session.scope !== scope || session.id !== id) throw new Error('judgment_session_scope_mismatch');
      try { const proof = await open(path(scope, id) + '.proof'); session.proof = proof.proof; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      return session;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  return { protection: 'server-protected', load,
    async create(session) { await ensure(); await publish(path(session.scope, session.id), session, true); return (await load(session.scope, session.id))!; },
    async save(session) {
      await ensure();
      const file = path(session.scope, session.id);
      // Atomically pin the first authorized proof across processes. Another authorization cannot replace it.
      if (session.proof) {
        await publish(file + '.proof', session, true);
        if ((await open(file + '.proof')).proof !== session.proof) throw new Error('judgment_original_proof_conflict');
      }
      await publish(file, session, false);
    }
  };
}

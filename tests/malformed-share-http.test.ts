import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('owning public share recovery before router decoding', () => {
  it.each(['%E0%A4%A', '%FF'])('serves the fixed client shell for malformed HTML navigation %s', async id => {
    const directory = mkdtempSync(join(tmpdir(), 'radar-share-html-'));
    const shell = '<!doctype html><title>Radar</title><main>Fixed public client shell</main>';
    writeFileSync(join(directory, 'index.html'), shell);
    const app = await createApp(emptyIntelligenceStore(), undefined, { clientDistDir: directory });
    try {
      const response = await app.inject({ method: 'GET', url: '/4663/share/' + id + '?source=watch', headers: { accept: 'text/html' } });
      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toBe(shell);
      expect(response.body).not.toContain(id);
    } finally { await app.close(); rmSync(directory, { recursive: true, force: true }); }
  });

  it('never serves HTML or reflects malformed private API identifiers', async () => {
    const app = await createApp(emptyIntelligenceStore());
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/receipt-spine/judgment/%FF?credential=synthetic-private-marker', headers: { accept: 'text/html' } });
      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toEqual({ error: 'invalid_request_path', code: 'FST_ERR_BAD_URL' });
      expect(response.body).not.toContain('synthetic-private-marker');
    } finally { await app.close(); }
  });
});

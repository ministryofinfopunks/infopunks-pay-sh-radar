import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export type JudgmentOwner = { tenant_id: string; agent_id: string };
const CredentialSchema = z.object({
  tenant_id: z.string().min(1).max(128), agent_id: z.string().min(1).max(128),
  key_sha256: z.string().regex(/^[a-f0-9]{64}$/), expires_at: z.string().datetime().optional()
}).strict();

/** Operator-issued opaque keys. Only digests and server-owned tenant/agent bindings are configured. */
export function createJudgmentIdentity(raw?: string) {
  let credentials: z.infer<typeof CredentialSchema>[] = [];
  if (raw !== undefined) {
    try {
      credentials = z.array(CredentialSchema).min(1).max(1000).parse(JSON.parse(raw));
      if (new Set(credentials.map(c => c.key_sha256)).size !== credentials.length) throw new Error();
    } catch { throw new Error('invalid_judgment_identity_configuration'); }
  }
  return {
    configured: credentials.length > 0,
    authenticate(authorization?: string): JudgmentOwner | null {
      if (!authorization || !/^Bearer [A-Za-z0-9_-]{32,256}$/i.test(authorization)) return null;
      const digest = createHash('sha256').update(authorization.slice(7)).digest();
      let match: JudgmentOwner | null = null;
      for (const entry of credentials) {
        if (entry.expires_at && Date.parse(entry.expires_at) <= Date.now()) continue;
        if (timingSafeEqual(digest, Buffer.from(entry.key_sha256, 'hex'))) match = { tenant_id: entry.tenant_id, agent_id: entry.agent_id };
      }
      return match;
    }
  };
}

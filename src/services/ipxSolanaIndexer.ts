import type pg from 'pg';
import { ipxSha256 } from './ipxJcs';
export const SOLANA_MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export interface SolanaEvidenceRpc {
  genesisHash(): Promise<string>;
  signatures(address: string, before: string | null, limit: number): Promise<Array<{ signature: string; slot: number; blockTime: number | null; err: unknown }>>;
  transaction(signature: string): Promise<unknown | null>;
}
export function solanaEvidenceRpc(url: string): SolanaEvidenceRpc {
  let id = 0;
  async function call<T>(method: string, params: unknown[] = []): Promise<T> {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('solana_rpc_unavailable');
    const body = await response.json() as { result: T; error?: unknown };
    if (body.error || !('result' in body)) throw new Error('solana_rpc_failed');
    return body.result;
  }
  return { genesisHash: () => call('getGenesisHash'), signatures: (address, before, limit) => call('getSignaturesForAddress', [address, { ...(before ? { before } : {}), limit, commitment: 'finalized' }]), transaction: signature => call('getTransaction', [signature, { commitment: 'finalized', encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]) };
}
/** Targeted finalized telemetry, not a swap-volume or social-attention oracle. A missing transaction halts progress. */
export class IpxSolanaIndexer {
  constructor(private readonly pool: pg.Pool, private readonly rpc: SolanaEvidenceRpc) {}
  async scan(address: string, pageSize = 50) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('invalid_solana_watch');
    if (await this.rpc.genesisHash() !== SOLANA_MAINNET_GENESIS) throw new Error('solana_mainnet_required');
    const client = await this.pool.connect();
    try {
      const lock = await client.query("select pg_try_advisory_lock(hashtext('ipx-solana:' || $1)) as acquired", [address]);
      if (!lock.rows[0].acquired) return { state: 'BUSY', persisted: 0 };
      const prior = (await client.query('select state from ipx_solana_cursors where address=$1', [address])).rows[0]?.state ?? { committed_head: null, pending_head: null, before: null };
      const page = await this.rpc.signatures(address, prior.before, pageSize);
      const head = prior.pending_head ?? page[0]?.signature ?? prior.committed_head;
      const stop = page.findIndex(item => item.signature === prior.committed_head);
      const relevant = stop >= 0 ? page.slice(0, stop) : page;
      const observations = [];
      for (const item of relevant) {
        const raw = await this.rpc.transaction(item.signature);
        if (!raw || typeof raw !== 'object' || !('slot' in raw) || raw.slot !== item.slot) throw new Error('solana_finalized_transaction_unavailable');
        const object = raw as { transaction?: { signatures?: string[] }; meta?: { err?: unknown } };
        if (object.transaction?.signatures?.[0] !== item.signature || !object.meta || object.meta.err === undefined) throw new Error('solana_transaction_binding_invalid');
        observations.push({ version: 'ipx.solana.telemetry.v1', network_genesis: SOLANA_MAINNET_GENESIS, signature: item.signature, slot: item.slot, watch_address: address, observed_at: item.blockTime === null ? null : new Date(item.blockTime * 1000).toISOString(), commitment: 'finalized', execution_success: object.meta.err === null, raw, payload_hash: ipxSha256(raw), metric_authority: 'RAW_TRANSACTION_EVIDENCE_ONLY', volume_verified: false, wash_trading_verdict: 'UNASSESSED' });
      }
      const complete = stop >= 0 || page.length < pageSize;
      const next = complete ? { committed_head: head, pending_head: null, before: null } : { committed_head: prior.committed_head, pending_head: head, before: page.at(-1)!.signature };
      await client.query('begin');
      for (const observation of observations) {
        const inserted = await client.query('insert into ipx_solana_observations(signature,watch_address,payload_hash,receipt) values($1,$2,$3,$4) on conflict(signature,watch_address) do nothing returning signature', [observation.signature, address, observation.payload_hash, observation]);
        if (!inserted.rows.length) { const existing = (await client.query('select payload_hash from ipx_solana_observations where signature=$1 and watch_address=$2', [observation.signature, address])).rows[0]; if (existing.payload_hash !== observation.payload_hash) throw new Error('solana_history_conflict'); }
      }
      await client.query('insert into ipx_solana_cursors(address,state) values($1,$2) on conflict(address) do update set state=excluded.state', [address, next]);
      await client.query('commit');
      return { state: complete ? 'CAUGHT_UP' : 'BACKFILL_IN_PROGRESS', persisted: observations.length, cursor: next };
    } catch (error) { await client.query('rollback').catch(() => undefined); throw error; }
    finally { await client.query("select pg_advisory_unlock(hashtext('ipx-solana:' || $1))", [address]).catch(() => undefined); client.release(); }
  }
}

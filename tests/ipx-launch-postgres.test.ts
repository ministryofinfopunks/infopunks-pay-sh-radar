import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IpxGenesisReceipt } from '../src/services/ipxGenesisService';
import { PostgresIpxGenesisStore } from '../src/services/ipxGenesisService';
import { IpxSolanaIndexer, SOLANA_MAINNET_GENESIS, type SolanaEvidenceRpc } from '../src/services/ipxSolanaIndexer';
const url = process.env.CANONICAL_RECEIPT_TEST_URL;
describe.skipIf(!url)('IPX launch PostgreSQL provenance', () => {
  const schema = 'ipx_test_' + randomUUID().replaceAll('-', '');
  let bootstrap: pg.Pool; let pool: pg.Pool;
  const policy = `0x${'1'.repeat(64)}` as const;
  beforeAll(async () => {
    bootstrap = new pg.Pool({ connectionString: url }); await bootstrap.query(`create schema ${schema}`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await pool.query(readFileSync('migrations/20261008_017_ipx_launch.up.sql', 'utf8'));
  });
  afterAll(async () => { await pool?.end(); await bootstrap?.query(`drop schema if exists ${schema} cascade`); await bootstrap?.end(); });
  it('assigns unique ordinals concurrently, survives store restart, rejects rewrites and destructive rollback', async () => {
    const store = new PostgresIpxGenesisStore(pool);
    const rows = await Promise.all(Array.from({ length: 20 }, (_, index) => {
      const wallet = `0x${(index + 1).toString(16).padStart(40, '0')}` as const;
      const hash = `0x${(index + 1).toString(16).padStart(64, '0')}` as const;
      return store.append(policy, wallet, hash, ordinal => ({ receipt_id: 'test_' + hash, version: 'ipx.genesis.call.v2', payload: {}, canonical_serialization: '{}', payload_hash: hash, signature: '0x00', signature_verified: true, call_ordinal: ordinal, wallet_ordinal: ordinal, wallet, entitlement_atomic: '1', accepted_at: '2026-10-08T00:00:00Z', immutable: true, policy_hash: policy }));
    }));
    expect(new Set(rows.map(row => row.call_ordinal)).size).toBe(20);
    expect(rows.map(row => row.call_ordinal).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const restarted = new PostgresIpxGenesisStore(pool);
    const first = rows[0]; expect(await restarted.append(policy, first.wallet, first.payload_hash, () => { throw new Error('replayed callback'); })).toEqual(first);
    expect(await restarted.list(policy)).toHaveLength(20);
    await expect(restarted.append(policy, first.wallet, `0x${'f'.repeat(64)}`, () => first)).rejects.toThrow('economic_wallet_already_called');
    await expect(pool.query('update ipx_genesis_calls_v2 set receipt=receipt')).rejects.toThrow('append-only');
    await expect(pool.query('delete from ipx_genesis_calls_v2')).rejects.toThrow('append-only');
    await expect(pool.query(readFileSync('migrations/20261008_017_ipx_launch.down.sql', 'utf8'))).rejects.toThrow('refusing to erase');
    // A multi-statement failed migration leaves that connection in an aborted transaction.
    await pool.query('rollback');
  });
  it('backfills finalized Solana history without skipping pages and stops for missing transactions', async () => {
    const address = '11111111111111111111111111111111';
    const item = (number: number) => ({ signature: `signature-${number}`, slot: number, blockTime: 1791420000 + number, err: null });
    let missing = true; let next = false;
    const rpc: SolanaEvidenceRpc = {
      genesisHash: async () => SOLANA_MAINNET_GENESIS,
      signatures: async (_address, before) => before === 'signature-2' ? [item(1)] : next ? [item(4), item(3)] : [item(3), item(2)],
      transaction: async signature => missing ? null : { slot: Number(signature.slice(-1)), transaction: { signatures: [signature] }, meta: { err: null } }
    };
    const indexer = new IpxSolanaIndexer(pool, rpc);
    await expect(indexer.scan(address, 2)).rejects.toThrow('transaction_unavailable');
    expect((await pool.query('select count(*)::int as count from ipx_solana_cursors')).rows[0].count).toBe(0);
    missing = false;
    expect(await indexer.scan(address, 2)).toMatchObject({ state: 'BACKFILL_IN_PROGRESS', persisted: 2 });
    expect(await new IpxSolanaIndexer(pool, rpc).scan(address, 2)).toMatchObject({ state: 'CAUGHT_UP', persisted: 1 });
    next = true;
    expect(await indexer.scan(address, 2)).toMatchObject({ state: 'CAUGHT_UP', persisted: 1 });
    expect((await pool.query('select count(*)::int as count from ipx_solana_observations')).rows[0].count).toBe(4);
    await expect(pool.query('delete from ipx_solana_observations')).rejects.toThrow('append-only');
    await expect(new IpxSolanaIndexer(pool, { ...rpc, genesisHash: async () => 'different-cluster' }).scan(address)).rejects.toThrow('mainnet_required');
  });
});

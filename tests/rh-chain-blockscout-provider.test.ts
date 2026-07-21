import { describe, expect, it, vi } from 'vitest';
import { BlockscoutProvider } from '../src/providers/blockscoutProvider';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const DEPLOYER = '0x2222222222222222222222222222222222222222';

describe('RH Chain Blockscout provider', () => {
  it('looks up token data only by exact contract and normalizes addresses', async () => {
    const calls: string[] = [];
    const provider = new BlockscoutProvider({ enabled: true, fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).includes('/api/v2/tokens/')) return new Response(JSON.stringify({ address_hash: CONTRACT.toUpperCase(), name: 'Duplicate', symbol: 'DUP', decimals: '18', type: 'ERC-20', holders_count: '4', total_supply: '5' }));
      return new Response(JSON.stringify({ hash: CONTRACT, creator_address_hash: DEPLOYER, creation_transaction_hash: '0xabc', is_verified: true }));
    } });
    const token = await provider.getToken(`0x${CONTRACT.slice(2).toUpperCase()}`);
    const creation = await provider.getTokenCreationContext(CONTRACT);
    expect(token).toMatchObject({ address: CONTRACT, symbol: 'DUP', decimals: 18 });
    expect(creation).toEqual({ deployerAddress: DEPLOYER, creationTransactionHash: '0xabc', reviewState: 'observed' });
    expect(calls.every((url) => url.includes(CONTRACT))).toBe(true);
  });

  it('keeps same-ticker contracts as separate assets', async () => {
    const provider = new BlockscoutProvider({ enabled: true, fetchImpl: async () => new Response(JSON.stringify({ items: [
      { address_hash: CONTRACT, name: 'First', symbol: 'DUP', type: 'ERC-20' },
      { address_hash: '0x3333333333333333333333333333333333333333', name: 'Second', symbol: 'DUP', type: 'ERC-20' }
    ] })) });
    const tokens = await provider.listTokens();
    expect(tokens.items.map((token) => token.address)).toEqual([CONTRACT, '0x3333333333333333333333333333333333333333']);
  });

  it('does not substitute a visual explorer page when an API endpoint fails', async () => {
    const provider = new BlockscoutProvider({ enabled: true, fetchImpl: async () => new Response('unavailable', { status: 503 }) });
    await expect(provider.getToken(CONTRACT)).rejects.toThrow('blockscout_http_503');
  });

  it('propagates request abortion and does not retry', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const provider = new BlockscoutProvider({ enabled: true, timeoutMs: 5_000, fetchImpl });
    const pending = provider.getToken(CONTRACT, { signal: controller.signal });
    controller.abort(new Error('request_deadline_exhausted'));
    await expect(pending).rejects.toThrow('request_deadline_exhausted');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

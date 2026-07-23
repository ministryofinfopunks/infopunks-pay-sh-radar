// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const walletConnectInit = vi.hoisted(() => vi.fn());

vi.mock('@walletconnect/ethereum-provider', () => ({
  default: {
    init: walletConnectInit
  }
}));

import {
  connectInjectedWallet,
  connectWalletConnect,
  hasInjectedWallet,
  signRhPulseMessage,
  walletConnectConfigured,
  type Eip1193Provider
} from '../src/web/rhPulse/rhPulseWallet';

const ADDRESS = '0x82b3C2C59621F9470E7BE242ec4F5b390b05BD00';

describe('RH Pulse wallet bridge', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    walletConnectInit.mockReset();
    delete window.ethereum;
  });

  it('uses the preferred injected provider and requests only accounts plus personal_sign', async () => {
    const fallbackRequest = vi.fn();
    const metaMaskRequest = vi.fn();
    const rabbyRequest = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return [ADDRESS];
      if (method === 'personal_sign') return `0x${'11'.repeat(65)}`;
      throw new Error(`Unexpected wallet method: ${method}`);
    });
    window.ethereum = Object.assign(
      { request: fallbackRequest as Eip1193Provider['request'] },
      {
        providers: [
          { request: fallbackRequest as Eip1193Provider['request'] },
          { request: metaMaskRequest as Eip1193Provider['request'], isMetaMask: true },
          { request: rabbyRequest as Eip1193Provider['request'], isRabby: true }
        ]
      }
    );

    expect(hasInjectedWallet()).toBe(true);
    const session = await connectInjectedWallet();
    expect(session.kind).toBe('injected');
    expect(session.address).toBe(ADDRESS);
    expect(rabbyRequest).toHaveBeenNthCalledWith(1, { method: 'eth_requestAccounts' });

    const signature = await signRhPulseMessage(session, 'RH Pulse ✓');
    expect(signature).toBe(`0x${'11'.repeat(65)}`);
    expect(rabbyRequest).toHaveBeenNthCalledWith(2, {
      method: 'personal_sign',
      params: ['0x52482050756c736520e29c93', ADDRESS]
    });

    const requestedMethods = rabbyRequest.mock.calls.map(([request]) => request.method);
    expect(requestedMethods).toEqual(['eth_requestAccounts', 'personal_sign']);
    expect(requestedMethods).not.toContain('wallet_switchEthereumChain');
    expect(requestedMethods).not.toContain('eth_sendTransaction');
    expect(requestedMethods).not.toContain('eth_signTransaction');
  });

  it('keeps injected signing available when WalletConnect configuration is missing or empty', async () => {
    const injectedProvider: Eip1193Provider = {
      request: vi.fn(async () => [ADDRESS]) as Eip1193Provider['request']
    };
    window.ethereum = injectedProvider;

    vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', '');
    expect(walletConnectConfigured()).toBe(false);
    await expect(connectWalletConnect()).rejects.toMatchObject({
      code: 'walletconnect_unavailable'
    });
    expect(walletConnectInit).not.toHaveBeenCalled();
    await expect(connectInjectedWallet()).resolves.toMatchObject({
      kind: 'injected',
      address: ADDRESS
    });
  });

  it('fails recoverably for invalid configuration and WalletConnect initialization failures', async () => {
    vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', 'invalid-project-id');
    walletConnectInit.mockRejectedValueOnce(new Error('Project not found'));

    expect(walletConnectConfigured()).toBe(true);
    await expect(connectWalletConnect()).rejects.toEqual(
      expect.objectContaining({
        code: 'wallet_error',
        message: 'WalletConnect could not complete the handoff.'
      })
    );
  });

  it('connects a configured WalletConnect provider without requiring a chain switch', async () => {
    const request = vi.fn();
    const connect = vi.fn(async () => undefined);
    const disconnect = vi.fn(async () => undefined);
    walletConnectInit.mockResolvedValueOnce({
      accounts: [ADDRESS],
      request,
      connect,
      disconnect
    });
    vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', 'test-public-project-id');

    const session = await connectWalletConnect();

    expect(session).toMatchObject({ kind: 'walletconnect', address: ADDRESS });
    expect(connect).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    expect(walletConnectInit).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'test-public-project-id',
      optionalChains: [4663],
      methods: [],
      optionalMethods: ['personal_sign'],
      showQrModal: true,
      metadata: expect.objectContaining({
        url: `${window.location.origin}/`,
        icons: [`${window.location.origin}/favicon.svg`]
      })
    }));
    const initialization = walletConnectInit.mock.calls[0]?.[0] as {
      methods: string[];
      optionalMethods: string[];
    };
    expect([...initialization.methods, ...initialization.optionalMethods]).not.toContain('wallet_switchEthereumChain');
    expect([...initialization.methods, ...initialization.optionalMethods]).not.toContain('eth_sendTransaction');
  });

  it('maps a closed wallet app to user rejection and a session timeout to a recoverable error', async () => {
    vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', 'test-public-project-id');
    walletConnectInit.mockResolvedValueOnce({
      accounts: [],
      request: vi.fn(),
      connect: vi.fn(async () => {
        throw Object.assign(new Error('User closed wallet'), { code: 4001 });
      }),
      disconnect: vi.fn()
    });
    await expect(connectWalletConnect()).rejects.toMatchObject({
      code: 'user_rejected'
    });

    walletConnectInit.mockResolvedValueOnce({
      accounts: [],
      request: vi.fn(),
      connect: vi.fn(async () => {
        throw new Error('Session timeout');
      }),
      disconnect: vi.fn()
    });
    await expect(connectWalletConnect()).rejects.toMatchObject({
      code: 'wallet_error'
    });
  });

  it('maps injected connection and signature rejection to a recoverable user state', async () => {
    const connectRejected = vi.fn(async () => {
      throw Object.assign(new Error('Request rejected'), { code: 4001 });
    });
    window.ethereum = { request: connectRejected };
    await expect(connectInjectedWallet()).rejects.toMatchObject({
      code: 'user_rejected'
    });

    const signRejected = vi.fn(async () => {
      throw Object.assign(new Error('Signature denied'), { code: 4001 });
    });
    await expect(signRhPulseMessage({
      kind: 'injected',
      address: ADDRESS,
      provider: { request: signRejected }
    }, 'Exact server message')).rejects.toMatchObject({
      code: 'user_rejected'
    });
  });
});

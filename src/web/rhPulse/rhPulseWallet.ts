export type Eip1193Provider = {
  request<T = unknown>(args: { method: string; params?: unknown[] | object }): Promise<T>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      providers?: Eip1193Provider[];
      isMetaMask?: boolean;
      isRabby?: boolean;
    };
  }
}

export type RhPulseWalletSession = {
  kind: 'injected' | 'walletconnect';
  address: string;
  provider: Eip1193Provider;
  disconnect?: () => Promise<void>;
};

export class RhPulseWalletError extends Error {
  constructor(
    readonly code: 'wallet_unavailable' | 'account_unavailable' | 'user_rejected' | 'walletconnect_unavailable' | 'wallet_error',
    message: string
  ) {
    super(message);
  }
}

export function hasInjectedWallet() {
  return Boolean(window.ethereum?.request);
}

export function walletConnectConfigured() {
  return Boolean(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim());
}

export async function connectInjectedWallet(): Promise<RhPulseWalletSession> {
  const provider = preferredInjectedProvider();
  if (!provider) throw new RhPulseWalletError('wallet_unavailable', 'No injected wallet was detected in this browser.');
  try {
    const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' });
    const address = accounts[0];
    if (!address) throw new RhPulseWalletError('account_unavailable', 'The wallet did not provide an account.');
    return { kind: 'injected', address, provider };
  } catch (error) {
    if (error instanceof RhPulseWalletError) throw error;
    if (isUserRejection(error)) throw new RhPulseWalletError('user_rejected', 'Wallet connection was cancelled.');
    throw new RhPulseWalletError('wallet_error', 'The injected wallet could not connect.');
  }
}

export async function connectWalletConnect(): Promise<RhPulseWalletSession> {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
  if (!projectId) {
    throw new RhPulseWalletError(
      'walletconnect_unavailable',
      'WalletConnect is not configured. An injected wallet can still sign.'
    );
  }
  try {
    const walletMetadataOrigin = window.location.origin;
    const { default: EthereumProvider } = await import('@walletconnect/ethereum-provider');
    const provider = await EthereumProvider.init({
      projectId,
      optionalChains: [4663],
      methods: [],
      optionalMethods: ['personal_sign'],
      events: [],
      optionalEvents: ['accountsChanged', 'disconnect'],
      showQrModal: true,
      metadata: {
        name: 'RH Pulse',
        description: 'Call the Rotation — public prediction receipts by Infopunks.',
        url: `${walletMetadataOrigin}/`,
        icons: [`${walletMetadataOrigin}/favicon.svg`]
      }
    });
    await provider.connect();
    const accounts = provider.accounts.length
      ? provider.accounts
      : await provider.request<string[]>({ method: 'eth_accounts' });
    const address = accounts[0];
    if (!address) {
      await provider.disconnect().catch(() => undefined);
      throw new RhPulseWalletError('account_unavailable', 'WalletConnect did not provide an account.');
    }
    return {
      kind: 'walletconnect',
      address,
      provider,
      disconnect: () => provider.disconnect()
    };
  } catch (error) {
    if (error instanceof RhPulseWalletError) throw error;
    if (isUserRejection(error)) throw new RhPulseWalletError('user_rejected', 'Wallet connection was cancelled.');
    throw new RhPulseWalletError('wallet_error', 'WalletConnect could not complete the handoff.');
  }
}

export async function signRhPulseMessage(session: RhPulseWalletSession, message: string) {
  try {
    return await session.provider.request<string>({
      method: 'personal_sign',
      params: [utf8ToHex(message), session.address]
    });
  } catch (error) {
    if (isUserRejection(error)) throw new RhPulseWalletError('user_rejected', 'The signature request was cancelled.');
    throw new RhPulseWalletError('wallet_error', 'The wallet could not sign the RH Pulse message.');
  }
}

function preferredInjectedProvider() {
  const ethereum = window.ethereum;
  if (!ethereum?.request) return null;
  if (!ethereum.providers?.length) return ethereum;
  return ethereum.providers.find((provider) => (
    (provider as Eip1193Provider & { isRabby?: boolean }).isRabby
  )) ?? ethereum.providers.find((provider) => (
    (provider as Eip1193Provider & { isMetaMask?: boolean }).isMetaMask
  )) ?? ethereum.providers[0];
}

function utf8ToHex(value: string) {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function isUserRejection(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? Number((error as { code?: unknown }).code) : NaN;
  const message = 'message' in error ? String((error as { message?: unknown }).message) : '';
  return code === 4001 || /reject|denied|cancel/i.test(message);
}

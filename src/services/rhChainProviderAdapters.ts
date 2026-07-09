import type {
  RhChainDailyReceipt,
  RhChainDataFreshness,
  RhChainIndexAsset,
  RhChainMemeAsset,
  RhChainMetric,
  RhChainReceipt,
  RhChainReviewItem,
  RhChainSignal
} from '../data/rhChain';

export type RhChainProviderIdentity = {
  provider_name: string;
  data_mode: RhChainDataFreshness;
  live_indexing_enabled: boolean;
};

export interface DefiLlamaProvider extends RhChainProviderIdentity {
  getChainMetrics(): Promise<RhChainMetric[]>;
}

export interface DexScreenerProvider extends RhChainProviderIdentity {
  getMemeAssets(): Promise<RhChainMemeAsset[]>;
}

export interface CoinGeckoProvider extends RhChainProviderIdentity {
  getIndexAssets(): Promise<RhChainIndexAsset[]>;
}

export interface BlockscoutProvider extends RhChainProviderIdentity {
  getReviewItems(): Promise<RhChainReviewItem[]>;
}

export interface DuneProvider extends RhChainProviderIdentity {
  getReceipts(): Promise<RhChainReceipt[]>;
  getDailyReceipts(): Promise<RhChainDailyReceipt[]>;
}

export interface SocialSignalProvider extends RhChainProviderIdentity {
  getSignals(): Promise<RhChainSignal[]>;
}

function liveProviderNotImplemented(providerName: string): never {
  throw new Error(`${providerName} live indexing is not implemented or enabled for RH Chain`);
}

export function createDefiLlamaProvider(): DefiLlamaProvider {
  return {
    provider_name: 'DefiLlama',
    data_mode: 'live_future',
    live_indexing_enabled: false,
    getChainMetrics: async () => liveProviderNotImplemented('DefiLlamaProvider')
  };
}

export function createDexScreenerProvider(): DexScreenerProvider {
  return {
    provider_name: 'DexScreener',
    data_mode: 'live_future',
    live_indexing_enabled: false,
    getMemeAssets: async () => liveProviderNotImplemented('DexScreenerProvider')
  };
}

export function createCoinGeckoProvider(): CoinGeckoProvider {
  return {
    provider_name: 'CoinGecko',
    data_mode: 'live_future',
    live_indexing_enabled: false,
    getIndexAssets: async () => liveProviderNotImplemented('CoinGeckoProvider')
  };
}

export function createBlockscoutProvider(): BlockscoutProvider {
  return {
    provider_name: 'Blockscout',
    data_mode: 'live_future',
    live_indexing_enabled: false,
    getReviewItems: async () => liveProviderNotImplemented('BlockscoutProvider')
  };
}

export function createDuneProvider(): DuneProvider {
  return {
    provider_name: 'Dune',
    data_mode: 'live_future',
    live_indexing_enabled: false,
    getReceipts: async () => liveProviderNotImplemented('DuneProvider'),
    getDailyReceipts: async () => liveProviderNotImplemented('DuneProvider')
  };
}

export function createSocialSignalProvider(): SocialSignalProvider {
  return {
    provider_name: 'X/social signals',
    data_mode: 'live_future',
    live_indexing_enabled: false,
    getSignals: async () => liveProviderNotImplemented('SocialSignalProvider')
  };
}


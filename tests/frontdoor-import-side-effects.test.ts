import { afterEach, describe, expect, it, vi } from 'vitest';

const observed = {
  poolFactory: 0,
  repositoryFactory: 0,
  storeHydration: 0,
  payShIngestion: 0,
  catalogBootstrap: 0,
  monitor: 0,
  providerConstruction: 0,
  rh4663UtcDayProviders: 0,
  pairV5Verifier: 0,
  longDopplerVerifier: 0,
  stockSupplyIndexer: 0,
  pairV5DiscoveryAdapter: 0,
  rhAutomation: 0,
  rhReceiptDrafts: 0,
  ipxShadowObservation: 0
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../src/persistence/databasePool');
  vi.doUnmock('../src/services/intelligenceStore');
  vi.doUnmock('../src/services/endpointMonitorService');
  vi.doUnmock('../src/providers/dexscreenerProvider');
  vi.doUnmock('../src/providers/blockscoutProvider');
  vi.doUnmock('../src/services/rh4663UtcDayObservationService');
  vi.doUnmock('../src/services/rhChainReflexiveRadarService');
  vi.doUnmock('../src/services/rhChainCrossVenueAuditService');
  vi.doUnmock('../src/services/rhChainAutomationService');
  vi.doUnmock('../src/services/rhChainDailyReceiptDraftService');
  vi.doUnmock('../src/services/ipxPltrShadowObservationService');
  vi.resetModules();
});

describe('front-door import-time independence', () => {
  it('imports the application graph without constructing services, starting timers, or making requests', async () => {
    vi.resetModules();
    const network = vi.spyOn(globalThis, 'fetch');
    const interval = vi.spyOn(globalThis, 'setInterval');
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const immediate = vi.spyOn(globalThis, 'setImmediate');

    vi.doMock('../src/persistence/databasePool', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/persistence/databasePool')>();
      return { ...actual, getDatabasePool: (...args: Parameters<typeof actual.getDatabasePool>) => {
        observed.poolFactory += 1;
        return actual.getDatabasePool(...args);
      } };
    });
    vi.doMock('../src/services/intelligenceStore', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/intelligenceStore')>();
      return {
        ...actual,
        defaultRepository: (...args: Parameters<typeof actual.defaultRepository>) => {
          observed.repositoryFactory += 1;
          return actual.defaultRepository(...args);
        },
        createIntelligenceStore: (...args: Parameters<typeof actual.createIntelligenceStore>) => {
          observed.storeHydration += 1;
          return actual.createIntelligenceStore(...args);
        },
        runPayShIngestion: (...args: Parameters<typeof actual.runPayShIngestion>) => {
          observed.payShIngestion += 1;
          return actual.runPayShIngestion(...args);
        },
        runPayShIngestionWithOptions: (...args: Parameters<typeof actual.runPayShIngestionWithOptions>) => {
          observed.catalogBootstrap += 1;
          return actual.runPayShIngestionWithOptions(...args);
        }
      };
    });
    vi.doMock('../src/services/endpointMonitorService', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/endpointMonitorService')>();
      return { ...actual, runMonitor: (...args: Parameters<typeof actual.runMonitor>) => {
        observed.monitor += 1;
        return actual.runMonitor(...args);
      } };
    });
    vi.doMock('../src/providers/dexscreenerProvider', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/providers/dexscreenerProvider')>();
      return { ...actual, DexScreenerProvider: class extends actual.DexScreenerProvider {
        constructor(...args: ConstructorParameters<typeof actual.DexScreenerProvider>) {
          observed.providerConstruction += 1;
          super(...args);
        }
      } };
    });
    vi.doMock('../src/providers/blockscoutProvider', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/providers/blockscoutProvider')>();
      return { ...actual, BlockscoutProvider: class extends actual.BlockscoutProvider {
        constructor(...args: ConstructorParameters<typeof actual.BlockscoutProvider>) {
          observed.providerConstruction += 1;
          super(...args);
        }
      } };
    });
    vi.doMock('../src/services/rh4663UtcDayObservationService', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/rh4663UtcDayObservationService')>();
      return { ...actual, createRh4663UtcDayProviders: (...args: Parameters<typeof actual.createRh4663UtcDayProviders>) => {
        observed.rh4663UtcDayProviders += 1;
        return actual.createRh4663UtcDayProviders(...args);
      } };
    });
    vi.doMock('../src/services/rhChainReflexiveRadarService', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/rhChainReflexiveRadarService')>();
      return {
        ...actual,
        PairV5OnchainVerifier: class extends actual.PairV5OnchainVerifier {
          constructor(...args: ConstructorParameters<typeof actual.PairV5OnchainVerifier>) {
            observed.pairV5Verifier += 1;
            super(...args);
          }
        },
        PairV5DiscoveryAdapter: class extends actual.PairV5DiscoveryAdapter {
          constructor(...args: ConstructorParameters<typeof actual.PairV5DiscoveryAdapter>) {
            observed.pairV5DiscoveryAdapter += 1;
            super(...args);
          }
        }
      };
    });
    vi.doMock('../src/services/rhChainCrossVenueAuditService', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/rhChainCrossVenueAuditService')>();
      return {
        ...actual,
        LongDopplerVerifier: class extends actual.LongDopplerVerifier {
          constructor(...args: ConstructorParameters<typeof actual.LongDopplerVerifier>) {
            observed.longDopplerVerifier += 1;
            super(...args);
          }
        },
        StockTokenSupplyIndexer: class extends actual.StockTokenSupplyIndexer {
          constructor(...args: ConstructorParameters<typeof actual.StockTokenSupplyIndexer>) {
            observed.stockSupplyIndexer += 1;
            super(...args);
          }
        }
      };
    });
    vi.doMock('../src/services/rhChainAutomationService', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/rhChainAutomationService')>();
      return { ...actual, RhChainAutomationService: class extends actual.RhChainAutomationService {
        constructor(...args: ConstructorParameters<typeof actual.RhChainAutomationService>) {
          observed.rhAutomation += 1;
          super(...args);
        }
      } };
    });
    vi.doMock('../src/services/rhChainDailyReceiptDraftService', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/rhChainDailyReceiptDraftService')>();
      return { ...actual, RhChainDailyReceiptDraftService: class extends actual.RhChainDailyReceiptDraftService {
        constructor(...args: ConstructorParameters<typeof actual.RhChainDailyReceiptDraftService>) {
          observed.rhReceiptDrafts += 1;
          super(...args);
        }
      } };
    });
    vi.doMock('../src/services/ipxPltrShadowObservationService', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/ipxPltrShadowObservationService')>();
      return { ...actual, IpxPltrShadowObservationService: class extends actual.IpxPltrShadowObservationService {
        constructor(...args: ConstructorParameters<typeof actual.IpxPltrShadowObservationService>) {
          observed.ipxShadowObservation += 1;
          super(...args);
        }
      } };
    });

    const application = await import('../src/api/app');

    expect(application.createApp).toBeTypeOf('function');
    expect(observed).toEqual({
      poolFactory: 0,
      repositoryFactory: 0,
      storeHydration: 0,
      payShIngestion: 0,
      catalogBootstrap: 0,
      monitor: 0,
      providerConstruction: 0,
      rh4663UtcDayProviders: 0,
      pairV5Verifier: 0,
      longDopplerVerifier: 0,
      stockSupplyIndexer: 0,
      pairV5DiscoveryAdapter: 0,
      rhAutomation: 0,
      rhReceiptDrafts: 0,
      ipxShadowObservation: 0
    });
    expect(network).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(immediate).not.toHaveBeenCalled();
  });
});

const DEFAULT_BASE_URL = 'https://infopunks-pay-sh-radar.onrender.com';

const baseUrl = (process.env.RADAR_VERIFY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');

let hasFailure = false;

function pass(name: string, detail?: string): void {
  console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
}

function fail(name: string, detail: string): void {
  hasFailure = true;
  console.error(`FAIL ${name} - ${detail}`);
}

function assertCondition(name: string, condition: boolean, detail: string): void {
  if (condition) {
    pass(name, detail);
    return;
  }

  fail(name, detail);
}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const body = await response.json();
    return { status: response.status, body };
  } catch (error) {
    throw new Error(`${path} request failed: ${(error as Error).message}`);
  }
}

async function getText(path: string): Promise<{ status: number; body: string }> {
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const body = await response.text();
    return { status: response.status, body };
  } catch (error) {
    throw new Error(`${path} request failed: ${(error as Error).message}`);
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

async function run(): Promise<void> {
  console.log(`Verifying Radar production proof surfaces at ${baseUrl}`);

  try {
    const health = await getJson('/health');
    assertCondition('GET /health status', health.status === 200, `status=${health.status}`);
  } catch (error) {
    fail('GET /health request', (error as Error).message);
  }

  try {
    const summary = await getJson('/v1/radar/benchmark-summary');
    assertCondition('GET /v1/radar/benchmark-summary status', summary.status === 200, `status=${summary.status}`);

    const summaryObject = asObject(summary.body);
    const summaryData = asObject(summaryObject?.data);

    if (!summaryData) {
      fail('benchmark-summary payload', 'missing object at data');
    } else {
      const recordedBenchmarks = asNumber(summaryData.recorded_benchmarks);
      const totalRecordedRuns = asNumber(summaryData.total_recorded_runs);
      const provenRoutes = asNumber(summaryData.proven_routes);
      const winnerClaimed = summaryData.winner_claimed;

      assertCondition(
        'benchmark-summary recorded_benchmarks >= 3',
        recordedBenchmarks !== null && recordedBenchmarks >= 3,
        `recorded_benchmarks=${String(summaryData.recorded_benchmarks)}`
      );
      assertCondition(
        'benchmark-summary total_recorded_runs >= 15',
        totalRecordedRuns !== null && totalRecordedRuns >= 15,
        `total_recorded_runs=${String(summaryData.total_recorded_runs)}`
      );
      assertCondition(
        'benchmark-summary proven_routes >= 6',
        provenRoutes !== null && provenRoutes >= 6,
        `proven_routes=${String(summaryData.proven_routes)}`
      );
      assertCondition(
        'benchmark-summary winner_claimed === false',
        winnerClaimed === false,
        `winner_claimed=${String(winnerClaimed)}`
      );
    }
  } catch (error) {
    fail('GET /v1/radar/benchmark-summary request', (error as Error).message);
  }

  try {
    const history = await getJson('/v1/radar/benchmark-history');
    assertCondition('GET /v1/radar/benchmark-history status', history.status === 200, `status=${history.status}`);

    const historyObject = asObject(history.body);
    const historyData = asObject(historyObject?.data);

    if (!historyData) {
      fail('benchmark-history payload', 'missing object at data');
    } else {
      const historyCount = asNumber(historyData.history_count);
      const totalArtifacts = asNumber(historyData.total_artifacts);
      const totalRecordedRuns = asNumber(historyData.total_recorded_runs);
      const winnerClaimed = historyData.winner_claimed;

      assertCondition(
        'benchmark-history history_count >= 3',
        historyCount !== null && historyCount >= 3,
        `history_count=${String(historyData.history_count)}`
      );
      assertCondition(
        'benchmark-history total_artifacts >= 3',
        totalArtifacts !== null && totalArtifacts >= 3,
        `total_artifacts=${String(historyData.total_artifacts)}`
      );
      assertCondition(
        'benchmark-history total_recorded_runs >= 15',
        totalRecordedRuns !== null && totalRecordedRuns >= 15,
        `total_recorded_runs=${String(historyData.total_recorded_runs)}`
      );
      assertCondition(
        'benchmark-history winner_claimed === false',
        winnerClaimed === false,
        `winner_claimed=${String(winnerClaimed)}`
      );
    }
  } catch (error) {
    fail('GET /v1/radar/benchmark-history request', (error as Error).message);
  }

  try {
    const solPrice = await getJson('/v1/radar/benchmark-history/finance-data-sol-price');
    assertCondition(
      'GET /v1/radar/benchmark-history/finance-data-sol-price status',
      solPrice.status === 200,
      `status=${solPrice.status}`
    );
  } catch (error) {
    fail('GET /v1/radar/benchmark-history/finance-data-sol-price request', (error as Error).message);
  }

  try {
    const tokenSearch = await getJson('/v1/radar/benchmark-history/finance-data-token-search');
    assertCondition(
      'GET /v1/radar/benchmark-history/finance-data-token-search status',
      tokenSearch.status === 200,
      `status=${tokenSearch.status}`
    );
  } catch (error) {
    fail('GET /v1/radar/benchmark-history/finance-data-token-search request', (error as Error).message);
  }

  try {
    const routeHistory = await getJson('/v1/radar/benchmark-history/finance-data-token-metadata/routes');
    assertCondition(
      'GET /v1/radar/benchmark-history/finance-data-token-metadata/routes status',
      routeHistory.status === 200,
      `status=${routeHistory.status}`
    );

    const routeHistoryObject = asObject(routeHistory.body);
    const routeHistoryData = asObject(routeHistoryObject?.data);

    if (!routeHistoryData) {
      fail('benchmark-history token-metadata routes payload', 'missing object at data');
    } else {
      const routeCount = asNumber(routeHistoryData.route_count);
      const artifactCount = asNumber(routeHistoryData.artifact_count);
      const winnerClaimed = routeHistoryData.winner_claimed;
      const routes = asArray(routeHistoryData.routes);
      const routeObjects = routes?.map((route) => asObject(route)).filter((route): route is Record<string, unknown> => route !== null) ?? [];
      const payspongeRoute = routeObjects.find((route) => route.provider_id === 'paysponge-coingecko') ?? null;
      const meritRoute = routeObjects.find((route) => route.provider_id === 'merit-systems-stablecrypto-market-data') ?? null;
      const payspongeCaveats = asArray(payspongeRoute?.caveats);
      const payspongeRouteId = typeof payspongeRoute?.route_id === 'string' ? payspongeRoute.route_id : null;

      assertCondition(
        'benchmark-history token-metadata routes route_count >= 2',
        routeCount !== null && routeCount >= 2,
        `route_count=${String(routeHistoryData.route_count)}`
      );
      assertCondition(
        'benchmark-history token-metadata routes artifact_count >= 1',
        artifactCount !== null && artifactCount >= 1,
        `artifact_count=${String(routeHistoryData.artifact_count)}`
      );
      assertCondition(
        'benchmark-history token-metadata routes winner_claimed === false',
        winnerClaimed === false,
        `winner_claimed=${String(winnerClaimed)}`
      );
      assertCondition(
        'benchmark-history token-metadata routes include paysponge-coingecko',
        payspongeRoute !== null,
        `provider_ids=${routeObjects.map((route) => String(route.provider_id)).join(',')}`
      );
      assertCondition(
        'benchmark-history token-metadata routes include merit-systems-stablecrypto-market-data',
        meritRoute !== null,
        `provider_ids=${routeObjects.map((route) => String(route.provider_id)).join(',')}`
      );
      assertCondition(
        'benchmark-history token-metadata paysponge caveat preserves canonical_network_match_rate=0.0',
        payspongeCaveats?.includes('canonical_network_match_rate=0.0 preserved from benchmark artifact') === true,
        `caveats=${JSON.stringify(payspongeCaveats ?? [])}`
      );

      if (payspongeRouteId) {
        const encodedRouteId = encodeURIComponent(payspongeRouteId);
        const routeDetail = await getJson(`/v1/radar/benchmark-history/finance-data-token-metadata/routes/${encodedRouteId}`);
        assertCondition(
          'GET /v1/radar/benchmark-history/finance-data-token-metadata/routes/{paysponge_route_id} status',
          routeDetail.status === 200,
          `status=${routeDetail.status}`
        );

        const routeDetailObject = asObject(routeDetail.body);
        const routeDetailData = asObject(routeDetailObject?.data);
        const timeline = asArray(routeDetailData?.timeline);
        const latestEntry = timeline ? asObject(timeline[timeline.length - 1]) : null;
        const latestMetrics = asObject(latestEntry?.metrics);

        assertCondition(
          'benchmark-history token-metadata paysponge timeline length >= 1',
          timeline !== null && timeline.length >= 1,
          `timeline_length=${String(timeline?.length ?? 0)}`
        );
        assertCondition(
          'benchmark-history token-metadata paysponge latest canonical_network_match_rate === 0',
          latestMetrics?.canonical_network_match_rate === 0,
          `canonical_network_match_rate=${String(latestMetrics?.canonical_network_match_rate)}`
        );
      } else {
        fail('benchmark-history token-metadata paysponge route detail', 'missing string route_id');
      }
    }
  } catch (error) {
    fail('GET /v1/radar/benchmark-history/finance-data-token-metadata/routes request', (error as Error).message);
  }

  try {
    const openapi = await getText('/openapi.json');
    assertCondition('GET /openapi.json status', openapi.status === 200, `status=${openapi.status}`);

    assertCondition(
      'openapi includes /v1/radar/benchmark-summary',
      openapi.body.includes('/v1/radar/benchmark-summary'),
      'path present in document'
    );
    assertCondition(
      'openapi includes /v1/radar/benchmark-history',
      openapi.body.includes('/v1/radar/benchmark-history'),
      'path present in document'
    );
    assertCondition(
      'openapi includes /v1/radar/benchmark-history/{benchmark_id}',
      openapi.body.includes('/v1/radar/benchmark-history/{benchmark_id}'),
      'path present in document'
    );
    assertCondition(
      'openapi includes /v1/radar/benchmark-history/{benchmark_id}/routes',
      openapi.body.includes('/v1/radar/benchmark-history/{benchmark_id}/routes'),
      'path present in document'
    );
    assertCondition(
      'openapi includes /v1/radar/benchmark-history/{benchmark_id}/routes/{route_id}',
      openapi.body.includes('/v1/radar/benchmark-history/{benchmark_id}/routes/{route_id}'),
      'path present in document'
    );
  } catch (error) {
    fail('GET /openapi.json request', (error as Error).message);
  }

  if (hasFailure) {
    console.error('Production verification failed');
    process.exit(1);
  }

  console.log('Production verification passed');
}

run().catch((error: unknown) => {
  console.error(`FAIL verify-production - ${(error as Error).message}`);
  process.exit(1);
});

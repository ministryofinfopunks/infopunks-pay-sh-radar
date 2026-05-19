const DEFAULT_BASE_URL = 'https://infopunks-pay-sh-radar.onrender.com';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(path: string): Promise<Response> {
  const url = `${baseUrl}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(url, { headers: { accept: 'application/json' } });
    } catch (error) {
      lastError = error as Error;
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `${path} request failed after ${RETRY_ATTEMPTS} attempts: ${lastError?.message ?? 'unknown error'}`
  );
}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  try {
    const response = await fetchWithRetry(path);
    const body = await response.json();
    return { status: response.status, body };
  } catch (error) {
    throw new Error(`${path} request failed: ${(error as Error).message}`);
  }
}

async function getText(path: string): Promise<{ status: number; body: string }> {
  try {
    const response = await fetchWithRetry(path);
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

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
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
      const totalArtifacts = asNumber(summaryData.total_artifacts);
      const benchmarkRows = asArray(summaryData.benchmarks)
        ?.map((row) => asObject(row))
        .filter((row): row is Record<string, unknown> => row !== null) ?? [];
      const anyBenchmarkWinnerClaimed = benchmarkRows.some((row) => row.winner_claimed === true);

      assertCondition(
        'benchmark-summary recorded_benchmarks === 4',
        recordedBenchmarks === 4,
        `recorded_benchmarks=${String(summaryData.recorded_benchmarks)}`
      );
      assertCondition(
        'benchmark-summary total_recorded_runs === 30',
        totalRecordedRuns === 30,
        `total_recorded_runs=${String(summaryData.total_recorded_runs)}`
      );
      assertCondition(
        'benchmark-summary proven_routes === 8',
        provenRoutes === 8,
        `proven_routes=${String(summaryData.proven_routes)}`
      );
      assertCondition(
        'benchmark-summary total_artifacts === 5',
        totalArtifacts === 5,
        `total_artifacts=${String(summaryData.total_artifacts)}`
      );
      assertCondition(
        'benchmark-summary winner_claimed globally false OR no benchmark winner_claimed=true',
        winnerClaimed === false || !anyBenchmarkWinnerClaimed,
        `winner_claimed=${String(winnerClaimed)} any_benchmark_winner_claimed=${String(anyBenchmarkWinnerClaimed)}`
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
        'benchmark-history history_count === 4',
        historyCount === 4,
        `history_count=${String(historyData.history_count)}`
      );
      assertCondition(
        'benchmark-history total_artifacts === 5',
        totalArtifacts === 5,
        `total_artifacts=${String(historyData.total_artifacts)}`
      );
      assertCondition(
        'benchmark-history total_recorded_runs === 30',
        totalRecordedRuns === 30,
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
    const ledger = await getJson('/v1/radar/evidence-ledger');
    assertCondition('GET /v1/radar/evidence-ledger status', ledger.status === 200, `status=${ledger.status}`);
    const ledgerObject = asObject(ledger.body);
    const ledgerData = asObject(ledgerObject?.data);
    const ledgerState = asObject(ledgerData?.ledger_state);
    if (!ledgerData || !ledgerState) {
      fail('evidence-ledger payload', 'missing object at data.ledger_state');
    } else {
      assertCondition(
        'evidence-ledger recorded_benchmarks === 4',
        asNumber(ledgerState.recorded_benchmarks) === 4,
        `recorded_benchmarks=${String(ledgerState.recorded_benchmarks)}`
      );
      assertCondition(
        'evidence-ledger total_artifacts === 5',
        asNumber(ledgerState.total_artifacts) === 5,
        `total_artifacts=${String(ledgerState.total_artifacts)}`
      );
      assertCondition(
        'evidence-ledger total_recorded_runs === 30',
        asNumber(ledgerState.total_recorded_runs) === 30,
        `total_recorded_runs=${String(ledgerState.total_recorded_runs)}`
      );
      assertCondition(
        'evidence-ledger proven_routes === 8',
        asNumber(ledgerState.proven_routes) === 8,
        `proven_routes=${String(ledgerState.proven_routes)}`
      );
      assertCondition(
        'evidence-ledger winner_claimed === false',
        asBoolean(ledgerState.winner_claimed) === false,
        `winner_claimed=${String(ledgerState.winner_claimed)}`
      );

      const recordedLanes = asArray(ledgerData.recorded_lanes) ?? [];
      const scaffoldLanes = asArray(ledgerData.scaffold_lanes) ?? [];
      const latestArtifacts = asArray(ledgerData.latest_artifacts) ?? [];
      assertCondition(
        'evidence-ledger recorded_lanes count === 4',
        recordedLanes.length === 4,
        `recorded_lanes=${String(recordedLanes.length)}`
      );
      assertCondition(
        'evidence-ledger scaffold_lanes count === 3',
        scaffoldLanes.length === 3,
        `scaffold_lanes=${String(scaffoldLanes.length)}`
      );
      assertCondition(
        'evidence-ledger latest_artifacts include data-web-search-results-benchmark-runs-2026-05-19',
        latestArtifacts.some((row) => asObject(row)?.artifact_id === 'data-web-search-results-benchmark-runs-2026-05-19'),
        `artifact_ids=${latestArtifacts.map((row) => String(asObject(row)?.artifact_id)).join(',')}`
      );
      const latestByBenchmarkId = new Map(latestArtifacts
        .map((row) => asObject(row))
        .filter((row): row is Record<string, unknown> => !!row)
        .map((row) => [String(row.benchmark_id ?? ''), row]));
      const webSearchLatest = latestByBenchmarkId.get('data-web-search-results');
      const tokenMetadataLatest = latestByBenchmarkId.get('finance-data-token-metadata');
      assertCondition(
        'evidence-ledger latest_artifacts data-web-search-results recorded_runs === 10',
        asNumber(webSearchLatest?.recorded_runs) === 10,
        `recorded_runs=${String(webSearchLatest?.recorded_runs)}`
      );
      assertCondition(
        'evidence-ledger latest_artifacts finance-data-token-metadata recorded_runs === 5',
        asNumber(tokenMetadataLatest?.recorded_runs) === 5,
        `recorded_runs=${String(tokenMetadataLatest?.recorded_runs)}`
      );

      const ledgerText = JSON.stringify(ledgerData).toLowerCase();
      const disallowedPhrases = ['best route', 'top route', 'winner route', 'loser route', 'ranking authority', 'guaranteed trust', 'superiority proof'];
      assertCondition(
        'evidence-ledger has no route winner claims',
        disallowedPhrases.every((phrase) => !ledgerText.includes(phrase)),
        'response text excludes disallowed winner/ranking language'
      );
    }
  } catch (error) {
    fail('GET /v1/radar/evidence-ledger request', (error as Error).message);
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
    const tokenMetadata = await getJson('/v1/radar/benchmark-history/finance-data-token-metadata');
    assertCondition(
      'GET /v1/radar/benchmark-history/finance-data-token-metadata status',
      tokenMetadata.status === 200,
      `status=${tokenMetadata.status}`
    );
  } catch (error) {
    fail('GET /v1/radar/benchmark-history/finance-data-token-metadata request', (error as Error).message);
  }

  try {
    const webSearchDetail = await getJson('/v1/radar/benchmark-history/data-web-search-results');
    assertCondition(
      'GET /v1/radar/benchmark-history/data-web-search-results status',
      webSearchDetail.status === 200,
      `status=${webSearchDetail.status}`
    );
    const webSearchObject = asObject(webSearchDetail.body);
    const webSearchData = asObject(webSearchObject?.data);
    if (!webSearchData) {
      fail('benchmark-history data-web-search-results payload', 'missing object at data');
    } else {
      const status = webSearchData.status;
      const artifactCount = asNumber(webSearchData.artifact_count);
      const winnerClaimed = asBoolean(webSearchData.winner_claimed);
      const winnerStatus = webSearchData.winner_status;
      const artifacts = asArray(webSearchData.artifacts);
      const artifactObjects = artifacts?.map((row) => asObject(row)).filter((row): row is Record<string, unknown> => row !== null) ?? [];
      const latestArtifactId = typeof artifactObjects[artifactObjects.length - 1]?.artifact_id === 'string'
        ? artifactObjects[artifactObjects.length - 1].artifact_id
        : null;

      assertCondition(
        'benchmark-history data-web-search-results recorded state',
        status === 'recorded',
        `status=${String(status)}`
      );
      assertCondition(
        'benchmark-history data-web-search-results artifact_count >= 1',
        artifactCount !== null && artifactCount >= 1,
        `artifact_count=${String(webSearchData.artifact_count)}`
      );
      assertCondition(
        'benchmark-history data-web-search-results latest artifact id matches',
        latestArtifactId === 'data-web-search-results-benchmark-runs-2026-05-19',
        `latest_artifact_id=${String(latestArtifactId)}`
      );
      assertCondition(
        'benchmark-history data-web-search-results winner_claimed === false',
        winnerClaimed === false,
        `winner_claimed=${String(webSearchData.winner_claimed)}`
      );
      assertCondition(
        'benchmark-history data-web-search-results winner_status === no_clear_winner',
        winnerStatus === 'no_clear_winner',
        `winner_status=${String(winnerStatus)}`
      );
    }
  } catch (error) {
    fail('GET /v1/radar/benchmark-history/data-web-search-results request', (error as Error).message);
  }

  try {
    const webSearchRoutes = await getJson('/v1/radar/benchmark-history/data-web-search-results/routes');
    assertCondition(
      'GET /v1/radar/benchmark-history/data-web-search-results/routes status',
      webSearchRoutes.status === 200,
      `status=${webSearchRoutes.status}`
    );
    const routesObject = asObject(webSearchRoutes.body);
    const routesData = asObject(routesObject?.data);
    if (!routesData) {
      fail('benchmark-history data-web-search-results routes payload', 'missing object at data');
    } else {
      const routeCount = asNumber(routesData.route_count);
      const routes = asArray(routesData.routes);
      const routeObjects = routes?.map((row) => asObject(row)).filter((row): row is Record<string, unknown> => row !== null) ?? [];
      const exaRoute = routeObjects.find((row) => row.route_id === 'stableenrich-exa-search:POST:/api/exa/search') ?? null;
      const perplexityRoute = routeObjects.find((row) => row.route_id === 'perplexity-search:POST:/api/search') ?? null;

      assertCondition(
        'benchmark-history data-web-search-results route_count === 2',
        routeCount === 2,
        `route_count=${String(routesData.route_count)}`
      );
      assertCondition(
        'benchmark-history data-web-search-results includes Exa route',
        exaRoute !== null,
        `route_ids=${routeObjects.map((route) => String(route.route_id)).join(',')}`
      );
      assertCondition(
        'benchmark-history data-web-search-results includes Perplexity route',
        perplexityRoute !== null,
        `route_ids=${routeObjects.map((route) => String(route.route_id)).join(',')}`
      );

      for (const route of routeObjects) {
        const routeId = typeof route.route_id === 'string' ? route.route_id : '<unknown>';
        assertCondition(
          `benchmark-history data-web-search-results ${routeId} exposes evidence_health`,
          typeof route.evidence_health === 'string' && route.evidence_health.length > 0,
          `evidence_health=${String(route.evidence_health)}`
        );
        assertCondition(
          `benchmark-history data-web-search-results ${routeId} exposes latest_artifact_id`,
          typeof route.latest_artifact_id === 'string' && route.latest_artifact_id.length > 0,
          `latest_artifact_id=${String(route.latest_artifact_id)}`
        );

        if (typeof route.route_id === 'string') {
          const detail = await getJson(`/v1/radar/benchmark-history/data-web-search-results/routes/${encodeURIComponent(route.route_id)}`);
          assertCondition(
            `GET /v1/radar/benchmark-history/data-web-search-results/routes/{${routeId}} status`,
            detail.status === 200,
            `status=${detail.status}`
          );
          const detailObject = asObject(detail.body);
          const detailData = asObject(detailObject?.data);
          const timeline = asArray(detailData?.timeline);
          assertCondition(
            `benchmark-history data-web-search-results ${routeId} timeline length >= 1`,
            timeline !== null && timeline.length >= 1,
            `timeline_length=${String(timeline?.length ?? 0)}`
          );
          const latestTimeline = timeline && timeline.length ? asObject(timeline[timeline.length - 1]) : null;
          const caveats = asArray(latestTimeline?.caveats) ?? [];
          const caveatObjects = asArray(latestTimeline?.caveat_objects);
          if (caveats.length > 0) {
            assertCondition(
              `benchmark-history data-web-search-results ${routeId} caveat_objects present when caveats exist`,
              caveatObjects !== null,
              `caveats=${JSON.stringify(caveats)} caveat_objects=${String(caveatObjects)}`
            );
          }
        }
      }
    }
  } catch (error) {
    fail('GET /v1/radar/benchmark-history/data-web-search-results/routes request', (error as Error).message);
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
      const meritRouteId = typeof meritRoute?.route_id === 'string' ? meritRoute.route_id : null;
      const payspongeEvidenceHealth = payspongeRoute?.evidence_health;
      const meritEvidenceHealth = meritRoute?.evidence_health;
      const payspongeCaveatObjects = asArray(payspongeRoute?.caveat_objects) ?? [];
      const meritCaveatObjects = asArray(meritRoute?.caveat_objects) ?? [];
      const payspongeCaveatCodes = payspongeCaveatObjects
        .map((caveatObject) => asObject(caveatObject))
        .filter((caveatObject): caveatObject is Record<string, unknown> => caveatObject !== null)
        .map((caveatObject) => caveatObject.code)
        .filter((code): code is string => typeof code === 'string');
      const meritCaveatCodes = meritCaveatObjects
        .map((caveatObject) => asObject(caveatObject))
        .filter((caveatObject): caveatObject is Record<string, unknown> => caveatObject !== null)
        .map((caveatObject) => caveatObject.code)
        .filter((code): code is string => typeof code === 'string');

      assertCondition(
        'benchmark-history token-metadata routes route_count >= 2',
        routeCount !== null && routeCount >= 2,
        `route_count=${String(routeHistoryData.route_count)}`
      );
      assertCondition(
        'benchmark-history token-metadata routes artifact_count >= 2',
        artifactCount !== null && artifactCount >= 2,
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
        'benchmark-history token-metadata paysponge evidence_health === recorded',
        payspongeEvidenceHealth === 'recorded',
        `evidence_health=${String(payspongeEvidenceHealth)}`
      );
      assertCondition(
        'benchmark-history token-metadata stablecrypto evidence_health === recorded',
        meritEvidenceHealth === 'recorded',
        `evidence_health=${String(meritEvidenceHealth)}`
      );
      assertCondition(
        'benchmark-history token-metadata stablecrypto not downgraded to caveated',
        meritEvidenceHealth !== 'caveated',
        `evidence_health=${String(meritEvidenceHealth)} caveat_codes=${JSON.stringify(meritCaveatCodes)}`
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
        const routeDetailEvidenceHealth = routeDetailData?.evidence_health;
        const timeline = asArray(routeDetailData?.timeline);
        const latestEntry = timeline ? asObject(timeline[timeline.length - 1]) : null;
        const olderEntry = timeline && timeline.length >= 2 ? asObject(timeline[timeline.length - 2]) : null;
        const latestMetrics = asObject(latestEntry?.metrics);
        const latestEvidenceHealth = latestEntry?.evidence_health;
        const latestCaveats = asArray(latestEntry?.caveats) ?? [];
        const latestCaveatObjects = asArray(latestEntry?.caveat_objects) ?? [];
        const latestNotes = asArray(latestEntry?.notes) ?? [];
        const olderMetrics = asObject(olderEntry?.metrics);
        const olderEvidenceHealth = olderEntry?.evidence_health;
        const olderCaveats = asArray(olderEntry?.caveats) ?? [];
        const olderCaveatObjects = asArray(olderEntry?.caveat_objects) ?? [];
        const olderCaveatCodes = olderCaveatObjects
          .map((caveatObject) => asObject(caveatObject))
          .filter((caveatObject): caveatObject is Record<string, unknown> => caveatObject !== null)
          .map((caveatObject) => caveatObject.code)
          .filter((code): code is string => typeof code === 'string');
        const latestSignals = [
          JSON.stringify(latestMetrics ?? {}),
          JSON.stringify(latestCaveatObjects),
          JSON.stringify(latestCaveats),
          JSON.stringify(latestNotes)
        ].join(' ');
        const latestHasRouteContextExposure =
          latestSignals.includes('route_context') || latestSignals.includes('route_context_inferred_network');

        assertCondition(
          'benchmark-history token-metadata paysponge timeline length >= 2',
          timeline !== null && timeline.length >= 2,
          `timeline_length=${String(timeline?.length ?? 0)}`
        );
        assertCondition(
          'benchmark-history token-metadata paysponge route detail evidence_health === recorded',
          routeDetailEvidenceHealth === 'recorded',
          `evidence_health=${String(routeDetailEvidenceHealth)}`
        );
        if (latestEntry && Object.prototype.hasOwnProperty.call(latestEntry, 'evidence_health')) {
          assertCondition(
            'benchmark-history token-metadata paysponge latest timeline evidence_health === recorded',
            latestEvidenceHealth === 'recorded',
            `evidence_health=${String(latestEvidenceHealth)}`
          );
        } else {
          pass('benchmark-history token-metadata paysponge latest timeline evidence_health field optional', 'field missing');
        }
        assertCondition(
          'benchmark-history token-metadata paysponge latest canonical_network_match_rate === 1',
          latestMetrics?.canonical_network_match_rate === 1,
          `canonical_network_match_rate=${String(latestMetrics?.canonical_network_match_rate)}`
        );
        if (latestHasRouteContextExposure) {
          assertCondition(
            'benchmark-history token-metadata paysponge latest timeline includes route_context signal',
            latestSignals.includes('route_context') || latestSignals.includes('route_context_inferred_network'),
            `latest_signals=${latestSignals}`
          );
        } else {
          pass(
            'benchmark-history token-metadata paysponge latest timeline route_context signal optional',
            'no route_context fields exposed in metrics/caveats/notes'
          );
        }
        if (olderEntry && Object.prototype.hasOwnProperty.call(olderEntry, 'evidence_health')) {
          assertCondition(
            'benchmark-history token-metadata paysponge older timeline evidence_health === caveated',
            olderEvidenceHealth === 'caveated',
            `evidence_health=${String(olderEvidenceHealth)}`
          );
        } else {
          pass('benchmark-history token-metadata paysponge older timeline evidence_health field optional', 'field missing');
        }
        assertCondition(
          'benchmark-history token-metadata paysponge older canonical_network_match_rate === 0',
          olderMetrics?.canonical_network_match_rate === 0,
          `canonical_network_match_rate=${String(olderMetrics?.canonical_network_match_rate)}`
        );
        assertCondition(
          'benchmark-history token-metadata paysponge older timeline preserves canonical_network_mismatch context',
          olderCaveatCodes.includes('canonical_network_mismatch')
            || olderCaveats.includes('canonical_network_match_rate=0.0 preserved from benchmark artifact'),
          `older_caveat_codes=${JSON.stringify(olderCaveatCodes)} older_caveats=${JSON.stringify(olderCaveats)}`
        );
      } else {
        fail('benchmark-history token-metadata paysponge route detail', 'missing string route_id');
      }

      if (meritRouteId) {
        const encodedRouteId = encodeURIComponent(meritRouteId);
        const stableCryptoRouteDetail = await getJson(`/v1/radar/benchmark-history/finance-data-token-metadata/routes/${encodedRouteId}`);
        assertCondition(
          'GET /v1/radar/benchmark-history/finance-data-token-metadata/routes/{stablecrypto_route_id} status',
          stableCryptoRouteDetail.status === 200,
          `status=${stableCryptoRouteDetail.status}`
        );

        const stableCryptoRouteDetailObject = asObject(stableCryptoRouteDetail.body);
        const stableCryptoRouteDetailData = asObject(stableCryptoRouteDetailObject?.data);
        const stableCryptoEvidenceHealth = stableCryptoRouteDetailData?.evidence_health;
        assertCondition(
          'benchmark-history token-metadata stablecrypto route detail evidence_health === recorded',
          stableCryptoEvidenceHealth === 'recorded',
          `evidence_health=${String(stableCryptoEvidenceHealth)}`
        );
      } else {
        fail('benchmark-history token-metadata stablecrypto route detail', 'missing string route_id');
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
      'openapi includes /v1/radar/benchmark-artifacts',
      openapi.body.includes('/v1/radar/benchmark-artifacts'),
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
    assertCondition(
      'openapi includes /v1/radar/evidence-ledger',
      openapi.body.includes('/v1/radar/evidence-ledger'),
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

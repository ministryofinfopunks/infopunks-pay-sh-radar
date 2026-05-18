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
        'benchmark-summary recorded_benchmarks >= 2',
        recordedBenchmarks !== null && recordedBenchmarks >= 2,
        `recorded_benchmarks=${String(summaryData.recorded_benchmarks)}`
      );
      assertCondition(
        'benchmark-summary total_recorded_runs >= 10',
        totalRecordedRuns !== null && totalRecordedRuns >= 10,
        `total_recorded_runs=${String(summaryData.total_recorded_runs)}`
      );
      assertCondition(
        'benchmark-summary proven_routes >= 4',
        provenRoutes !== null && provenRoutes >= 4,
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
        'benchmark-history history_count >= 2',
        historyCount !== null && historyCount >= 2,
        `history_count=${String(historyData.history_count)}`
      );
      assertCondition(
        'benchmark-history total_artifacts >= 2',
        totalArtifacts !== null && totalArtifacts >= 2,
        `total_artifacts=${String(historyData.total_artifacts)}`
      );
      assertCondition(
        'benchmark-history total_recorded_runs >= 10',
        totalRecordedRuns !== null && totalRecordedRuns >= 10,
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

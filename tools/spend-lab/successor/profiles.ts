/** Fixed local implementations. No Radar imports, expected decisions or labels. */
export type Task = {
  id: string;
  family: string;
  input: unknown;
  value_units: number;
  price_units: number;
  fee_units: number;
  deadline_ms: number;
  implementation: string;
  probe: { confidence: number; veto: boolean; sufficient: boolean };
};
const good = { confidence: 95, veto: false, sufficient: true },
  veto = { ...good, veto: true },
  unknown = { ...good, sufficient: false };
export const tasks: Task[] = [
  {
    id: 'sum-ledger',
    family: 'arithmetic',
    input: [4, 8, -3, 2],
    value_units: 40,
    price_units: 9,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'sum',
    probe: good,
  },
  {
    id: 'mean-telemetry',
    family: 'statistics',
    input: [2, 8, 11],
    value_units: 35,
    price_units: 7,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'mean-floor',
    probe: veto,
  },
  {
    id: 'sort-prices',
    family: 'sorting',
    input: [3, 11, 2, 25],
    value_units: 30,
    price_units: 8,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'sort-lexical',
    probe: good,
  },
  {
    id: 'dedup-addresses',
    family: 'normalization',
    input: [' A ', 'a', 'B', ' b '],
    value_units: 28,
    price_units: 6,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'dedup',
    probe: unknown,
  },
  {
    id: 'csv-quoted',
    family: 'csv',
    input: 'name,value\n"a,b",12\nc,4',
    value_units: 45,
    price_units: 8,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'csv-naive',
    probe: veto,
  },
  {
    id: 'json-path',
    family: 'json',
    input: { a: { b: 17 }, path: ['a', 'b'] },
    value_units: 25,
    price_units: 5,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'json-path',
    probe: good,
  },
  {
    id: 'timestamp-offset',
    family: 'time',
    input: '2026-10-01T23:30:00-02:00',
    value_units: 26,
    price_units: 4,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'utc-day',
    probe: good,
  },
  {
    id: 'sha256-bytes',
    family: 'cryptography',
    input: 'Infopunks\nRadar',
    value_units: 32,
    price_units: 7,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'sha256-lowercase',
    probe: veto,
  },
  {
    id: 'unicode-count',
    family: 'unicode',
    input: 'A😀é',
    value_units: 22,
    price_units: 3,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'utf16-count',
    probe: good,
  },
  {
    id: 'currency-minor',
    family: 'decimal',
    input: '12.34',
    value_units: 20,
    price_units: 4,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'minor-units',
    probe: good,
  },
  {
    id: 'url-query',
    family: 'url',
    input: 'https://example.invalid/?q=a%2Bb&q=c',
    value_units: 24,
    price_units: 5,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'query-first',
    probe: unknown,
  },
  {
    id: 'interval-overlap',
    family: 'intervals',
    input: [
      [1, 4],
      [4, 7],
    ],
    value_units: 29,
    price_units: 6,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'closed-overlap',
    probe: veto,
  },
  {
    id: 'text-tokenize',
    family: 'text',
    input: 'one  two\nthree',
    value_units: 18,
    price_units: 3,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'words',
    probe: unknown,
  },
  {
    id: 'unit-conversion',
    family: 'units',
    input: 1.25,
    value_units: 27,
    price_units: 6,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'kilometers-meters',
    probe: good,
  },
  {
    id: 'inventory-join',
    family: 'relational',
    input: { left: [{ id: 1 }, { id: 2 }], right: [{ id: 2, stock: 9 }] },
    value_units: 38,
    price_units: 8,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'inner-join',
    probe: veto,
  },
  {
    id: 'markdown-title',
    family: 'extraction',
    input: '# Radar\n\nSignal',
    value_units: 16,
    price_units: 20,
    fee_units: 2,
    deadline_ms: 100,
    implementation: 'title',
    probe: good,
  },
  {
    id: 'postal-validation',
    family: 'validation',
    input: '00501',
    value_units: 23,
    price_units: 4,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'postal',
    probe: good,
  },
  {
    id: 'service-unavailable',
    family: 'availability',
    input: 'document',
    value_units: 40,
    price_units: 11,
    fee_units: 2,
    deadline_ms: 100,
    implementation: 'unavailable',
    probe: good,
  },
  {
    id: 'slow-render',
    family: 'latency',
    input: 'radar',
    value_units: 30,
    price_units: 5,
    fee_units: 1,
    deadline_ms: 5,
    implementation: 'slow-upper',
    probe: good,
  },
  {
    id: 'percentile-nearest',
    family: 'quantiles',
    input: [1, 2, 4, 8, 16],
    value_units: 34,
    price_units: 6,
    fee_units: 1,
    deadline_ms: 100,
    implementation: 'median',
    probe: veto,
  },
];
export type Delivery = {
  task_id: string;
  input_hash: string;
  output: unknown;
  status: 'ok' | 'error';
  elapsed_ms: number;
  charged_units: number;
  fee_units: number;
};
export async function runProvider(t: Task): Promise<Omit<Delivery, 'input_hash'>> {
  const started = performance.now();
  let output: unknown,
    status: Delivery['status'] = 'ok';
  const x = t.input as any;
  switch (t.implementation) {
    case 'sum':
      output = x.reduce((a: number, b: number) => a + b, 0);
      break;
    case 'mean-floor':
      output = Math.floor(x.reduce((a: number, b: number) => a + b, 0) / x.length);
      break;
    case 'sort-lexical':
      output = [...x].sort();
      break;
    case 'dedup':
      output = [...new Set(x.map((s: string) => s.trim().toLowerCase()))];
      break;
    case 'csv-naive':
      output = x
        .split('\n')
        .slice(1)
        .map((line: string) => line.split(','));
      break;
    case 'json-path':
      output = x.path.reduce((v: any, k: string) => v[k], x);
      break;
    case 'utc-day':
      output = new Date(x).toISOString().slice(0, 10);
      break;
    case 'sha256-lowercase':
      output = (await import('node:crypto'))
        .createHash('sha256')
        .update(x.toLowerCase())
        .digest('hex');
      break;
    case 'utf16-count':
      output = x.length;
      break;
    case 'minor-units':
      output = Math.round(Number(x) * 100);
      break;
    case 'query-first':
      output = new URL(x).searchParams.get('q');
      break;
    case 'closed-overlap':
      output = x[0][0] <= x[1][1] && x[1][0] <= x[0][1];
      break;
    case 'words':
      output = x.trim().split(/\s+/);
      break;
    case 'kilometers-meters':
      output = x * 1000;
      break;
    case 'inner-join':
      output = x.left.flatMap((a: any) =>
        x.right.filter((b: any) => b.id === a.id).map((b: any) => ({ ...a, ...b })),
      );
      break;
    case 'title':
      output = x.split('\n')[0].slice(2);
      break;
    case 'postal':
      output = /^[0-9]{5}$/.test(x);
      break;
    case 'unavailable':
      output = null;
      status = 'error';
      break;
    case 'slow-upper':
      await new Promise((r) => setTimeout(r, 20));
      output = x.toUpperCase();
      break;
    case 'median':
      output = [...x].sort((a: number, b: number) => a - b)[Math.floor(x.length / 2)];
      break;
    default:
      throw new Error('unknown_local_implementation');
  }
  return {
    task_id: t.id,
    output,
    status,
    elapsed_ms: performance.now() - started,
    charged_units: t.price_units,
    fee_units: t.fee_units,
  };
}

import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { request, setupJudgment } from '../helpers/judgments';

it('measures the materialized memory hot path with a test facilitator', async () => {
  const free = await setupJudgment({ confidence: 79 }); const paid = await setupJudgment();
  await paid.service.check(request, 'benchmark'); await paid.service.check(request, 'benchmark', paid.signature);
  const measure = async (run: () => Promise<unknown>) => {
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) await run();
    for (let i = 0; i < 200; i++) { const at = performance.now(); await run(); samples.push(performance.now()-at); }
    samples.sort((a,b)=>a-b);
    return { samples: samples.length, p50_ms: samples[99], p95_ms: samples[189], max_ms: samples[199] };
  };
  const insufficient = await measure(() => free.service.check(request));
  const replay = await measure(() => paid.service.check(request, 'benchmark', paid.signature));
  mkdirSync('output', { recursive: true });
  writeFileSync('output/phase2-judgment-performance.json', JSON.stringify({ benchmark: 'judgment_hot_path', adapter: 'memory', external_payment: 'mocked', insufficient, paid_replay: replay }, null, 2));
  console.log(JSON.stringify({ benchmark: 'judgment_hot_path', adapter: 'memory', external_payment: 'mocked', insufficient, paid_replay: replay }));
  expect(paid.facilitator.settle).toHaveBeenCalledTimes(1);
});

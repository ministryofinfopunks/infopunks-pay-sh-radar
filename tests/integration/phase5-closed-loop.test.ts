import { expect, it } from 'vitest';
import { runClosedLoop } from '../../scripts/phase5/closedLoop';
it.skipIf(!process.env.CANONICAL_RECEIPT_TEST_URL)('closes the economic feedback loop over HTTP with PostgreSQL and local external adapters', async () => {
  const result = await runClosedLoop(process.env.CANONICAL_RECEIPT_TEST_URL!);
  expect(result.replay).toHaveLength(4); expect(result.negatives).toHaveLength(21);
  expect(result.first_judgment.decision).toBe('proceed'); expect(result.second_judgment.decision).toBe('do_not_spend');
}, 120000);

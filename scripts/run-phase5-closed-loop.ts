import { runClosedLoop } from './phase5/closedLoop';
const url = process.env.CANONICAL_RECEIPT_TEST_URL;
if (!url) throw new Error('CANONICAL_RECEIPT_TEST_URL_required');
runClosedLoop(url, true).then(result => console.log(JSON.stringify({ status: 'PASS', classification: result.classification, negative_cases: result.negatives.length, score: result.score_after.score, restart: result.restart_replay })))
  .catch(error => { console.error(error); process.exitCode = 1; });

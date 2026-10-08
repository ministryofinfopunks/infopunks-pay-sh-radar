import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const fields = /score_delta|scoreDelta|confidence_delta|confidenceDelta|trust_delta|trustDelta|reputation_delta|reputationDelta/g;
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]);
const readFiles = new Set(['src/services/derivedScoreService.ts','src/services/radarHistoryService.ts','src/services/radarRiskService.ts','src/services/pulseService.ts','src/services/interpretationService.ts','src/services/preSpendDecisionService.ts','src/data/signalDesk.ts','src/web/radarApp.tsx','src/web/preSpendBuilderPages.tsx']);
const rejectionFiles = new Set(['src/schemas/evaluate.ts','src/repositories/preSpendRepository.ts','src/api/app.ts','src/api/openapi.ts']);
const counts = { A:0, B:0, C:0, D:0, E:0, F:0 }; const occurrences = [];
for (const file of walk('src').sort()) {
  const lines = readFileSync(file,'utf8').split('\n');
  lines.forEach((text,index) => {
    for (const match of text.matchAll(fields)) {
      let category = 'F'; let explanation = 'Unclassified occurrence: requires authority review.';
      if (file === 'src/services/evaluationService.ts' || file === 'src/services/evaluationScorePolicy.ts') {
        category = text.includes('authoring_forbidden') ? 'D' : 'A'; explanation = category === 'A' ? 'Canonical evaluation authority or deterministic policy/replay validation.' : 'Explicit caller delta rejection.';
      } else if (file === 'src/schemas/receipts/evaluationReceipt.ts') { category='B'; explanation='Canonical EvaluationReceipt schema.'; }
      else if (file === 'src/repositories/preSpendSeedData.ts') { category='E'; explanation='Historical compatibility fixture; repository normalizes deltas to zero on load.'; }
      else if (rejectionFiles.has(file) || (file === 'src/schemas/entities.ts' && match[0] === 'confidence_delta')) { category='D'; explanation='Strict omission/rejection, zero-authority logging, or legacy intake documentation/schema. Nonzero legacy writes are rejected.'; }
      else if (readFiles.has(file) || (file === 'src/schemas/entities.ts' && match[0] === 'trust_delta')) { category='C'; explanation=file === 'src/services/derivedScoreService.ts' ? 'Verified EvaluationReceipt-only aggregation.' : 'Read/presentation diagnostic delta or ranking comparison; cannot append canonical evaluations or change derived reputation.'; }
      counts[category]++; occurrences.push({ file, line:index+1, column:match.index+1, field:match[0], category, explanation });
    }
  });
}
mkdirSync('output',{recursive:true});
writeFileSync('output/phase4-score-authority-audit.json',JSON.stringify({ scope:'entire production src tree; counts are individual token occurrences, including substring matches requested by the audit', counts, occurrences },null,2));
console.log(JSON.stringify(counts));
if (counts.F > 0) process.exitCode=1;

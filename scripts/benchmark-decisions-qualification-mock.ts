import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QualificationCorpus, runLiveBenchmark } from './benchmark-decisions-live';

const corpusPath = new URL('../tests/fixtures/decisions-qualification-cases.json', import.meta.url);
const corpusText = readFileSync(corpusPath, 'utf8');
const corpus = QualificationCorpus.parse(JSON.parse(corpusText));
const byId = new Map(corpus.cases.map(item => [item.id, item]));
const choices = ['proceed', 'test_spend_first', 'do_not_spend', 'insufficient_evidence'] as const;

async function main() {
  const report = await runLiveBenchmark({
    corpus, corpusSha256: createHash('sha256').update(corpusText).digest('hex'),
    apiKey: 'test-double-only', dedicatedEnvironmentId: 'local-fixture', dedicatedProjectId: 'local-fixture',
    projectHardLimitUsd: 1, projectRemainingUsd: 1, transport: 'test-double',
    limits: { maxRequests: corpus.cases.length, maxInputTokens: 100_000, maxUsd: 0.05, priceCeilingUsdPerMillionInput: 1, timeoutMs: 1000 },
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { input: string };
      const id = (JSON.parse(body.input) as { case_id: string }).case_id;
      const item = byId.get(id);
      if (!item) return new Response('{}', { status: 400 });
      // A deliberate test-double disagreement makes unsafe-suggestion metrics observable.
      const selected = item.category === 'manipulated_input' ? 'proceed' : item.expected.decision;
      const probabilities = choices.map(value => ({ value, probability: value === selected ? 0.91 : 0.03 }));
      const inputTokens = Math.ceil(body.input.length / 4);
      return new Response(JSON.stringify({ model: 'gpt-6-luna',
        answers: [{ type: 'choice', name: 'pre_spend_suggestion', choice: selected, confidence: 0.91, probabilities }],
        usage: { input_tokens: inputTokens, output_tokens: 4, total_tokens: inputTokens + 4 }
      }), { status: 200 });
    }
  });
  const output = resolve(process.argv[2] ?? 'docs/decisions-qualification-test-double-2026-10-08.json');
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`Wrote ${report.transport} qualification artifact: ${output}\n`);
}
void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });

import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { hashCanonical } from "../../src/services/receiptIntegrityService";
import { resolve, relative } from "node:path";
import { buyerRoles } from "./agents/roles";
import { runCase, scenarios, type CaseResult } from "./harness/task-runner";
import { scorecard } from "./evaluation/scorecard";
function sourceManifest(root: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, item.name);
    if (item.isDirectory() && item.name !== "reports")
      Object.assign(entries, sourceManifest(path));
    else if (item.isFile())
      entries[relative(resolve(__dirname, "../.."), path)] = hashCanonical(
        readFileSync(path, "utf8"),
      );
  }
  return entries;
}
async function main() {
  const args = process.argv.slice(2);
  function option(name: string, fallback: string) {
    const i = args.indexOf(name);
    return i < 0 ? fallback : args[i + 1];
  }
  const count = Number(option("--cases", "1020")),
    concurrency = Number(option("--concurrency", "100"));
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 10000 ||
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 100
  )
    throw new Error("invalid_local_load_limits");
  const output = resolve(option("--output", ".data/spend-lab/run"));
  if (existsSync(output))
    throw new Error("output_exists_choose_new_run_directory");
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const results: CaseResult[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(count, concurrency) }, async () => {
      while (next < count) {
        const index = next++,
          id = "case-" + String(index).padStart(5, "0");
        const result = await runCase(
          resolve(output, id + ".sqlite"),
          scenarios[index % scenarios.length],
          id,
          buyerRoles[index % buyerRoles.length],
        );
        writeFileSync(
          resolve(output, id + ".json"),
          JSON.stringify(result, null, 2) + "\n",
          { mode: 0o600 },
        );
        results.push(result);
      }
    }),
  );
  results.sort((a, b) => a.id.localeCompare(b.id));
  const report = {
    ...scorecard(results, concurrency),
    runtime: process.version,
    implementation_manifest: {
      ...sourceManifest(__dirname),
      "tests/spend-lab.test.ts": hashCanonical(
        readFileSync(
          resolve(__dirname, "../../tests/spend-lab.test.ts"),
          "utf8",
        ),
      ),
    },
  };
  writeFileSync(
    resolve(output, "verification-report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
  if (report.failed_cases) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

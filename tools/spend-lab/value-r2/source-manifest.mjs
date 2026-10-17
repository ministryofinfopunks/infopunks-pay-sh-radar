import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const baseline = "9712fa304751565fac998460eca030d6247d4a1e";
const protocol = JSON.parse(
  readFileSync("tools/spend-lab/value-r2/preregistration.json", "utf8"),
);
const head = git("rev-parse", "HEAD");
if (process.version !== "v24.21.0") throw new Error("node_24_21_required");
if (
  process.env.FIRST_SPENDER_EXPECTED_SHA &&
  process.env.FIRST_SPENDER_EXPECTED_SHA !== head
)
  throw new Error("exact_head_mismatch");
if (git("status", "--porcelain", "--untracked-files=no"))
  throw new Error("clean_source_required");
if (
  git(
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "tools/spend-lab/value-r2",
    "tests",
    "src",
    ".github/workflows",
  )
)
  throw new Error("committed_source_required");
git("merge-base", "--is-ancestor", baseline, protocol.holdout_freeze_sha);
git("merge-base", "--is-ancestor", protocol.holdout_freeze_sha, head);
const allowed = [
  "tools/spend-lab/value-r2/",
  "tests/spend-lab-value-r2.test.ts",
  ".github/workflows/spend-lab-value-r2.yml",
];
const changed = git("diff", "--name-only", baseline, head)
  .split("\n")
  .filter(Boolean);
if (changed.some((p) => !allowed.some((a) => p.startsWith(a))))
  throw new Error("reviewer_baseline_modified");
git(
  "diff",
  "--exit-code",
  protocol.holdout_freeze_sha,
  head,
  "--",
  "tools/spend-lab/value-r2/datasets/holdout",
  "tools/spend-lab/value-r2/curation/freeze-holdout.py",
);
if (
  git(
    "ls-tree",
    "-r",
    "--name-only",
    protocol.holdout_freeze_sha,
    "--",
    "tools/spend-lab/value-r2/strategies.ts",
    "tools/spend-lab/value-r2/canonical.ts",
  )
)
  throw new Error("holdout_not_frozen_before_policies");
const preregCommit = git(
  "log",
  "--format=%H",
  "--reverse",
  head,
  "--",
  "tools/spend-lab/value-r2/preregistration.json",
).split("\n")[0];
git(
  "diff",
  "--exit-code",
  preregCommit,
  head,
  "--",
  "tools/spend-lab/value-r2/preregistration.json",
);
if (
  git(
    "ls-tree",
    "-r",
    "--name-only",
    preregCommit,
    "--",
    "tools/spend-lab/value-r2/strategies.ts",
  )
)
  throw new Error("policy_not_preregistered");
const digest = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");
const paths = git("ls-files", "-z")
  .split("\0")
  .filter(Boolean)
  .filter(
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("tools/spend-lab/") ||
      p.startsWith("tests/") ||
      p.startsWith(".github/workflows/") ||
      [
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "tsconfig.server.json",
        "AGENTS.md",
      ].includes(p),
  );
const sources = Object.fromEntries(
  paths.sort().map((p) => [p, digest(readFileSync(p))]),
);
const preservationPaths = [
  "src",
  "tools/spend-lab/reports",
  "tools/spend-lab/successor",
  "docs/evidence",
  "docs/qualification",
];
const manifest = {
  version: "first-spender.value-source.v1",
  status: "HOLD",
  economic_usefulness: "NOT_ESTABLISHED",
  head,
  tree: git("rev-parse", "HEAD^{tree}"),
  baseline,
  holdout_freeze_sha: protocol.holdout_freeze_sha,
  preregistration_sha: preregCommit,
  node: process.version,
  changed,
  source_set_hash: digest(Buffer.from(JSON.stringify(sources))),
  sources,
  preservation: Object.fromEntries(
    preservationPaths.map((p) => [
      p,
      {
        baseline: git("rev-parse", baseline + ":" + p),
        current: git("rev-parse", head + ":" + p),
      },
    ]),
  ),
};
if (Object.values(manifest.preservation).some((x) => x.baseline !== x.current))
  throw new Error("frozen_tree_modified");
const path = resolve(process.argv[2] ?? ".data/value-r2/source-manifest.json");
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify({
    head,
    source_set_hash: manifest.source_set_hash,
    status: "HOLD",
  }),
);

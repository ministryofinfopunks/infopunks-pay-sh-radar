# Radar v1 UX reconciliation

Release status: HOLD. This is engineering evidence, not independent visual, accessibility, or release approval.

## Source selection

- Baseline: `2c2fe64db173c63048e70353ae926aa199792d1b` (R2).
- Secure Terminal ancestor: `d3d0a44`; UX donor: `43b926d`. Only changed `src/web` presentation, associated frontend tests, canonical visual asset/site metadata, selected UI harness, and compact design-system inventories were extracted at path level. Backend, migrations, payments, and execution were not imported from either donor.
- UI-INT3 donor: `7cfe031`. Selected `compare-ui-int2-visuals.cjs` and `qualify-ui-int3-solana.cjs` only. The latter now accepts explicit output/fixture/approval inputs. Its visual comparison remains HOLD until immutable references, input fixture, and prior human approval provenance are supplied and validated. No generated screenshots or old qualification results were imported.
- Track A donor: `62dbf6b`. The private Decision View presentation was adapted narrowly to explicit authenticated inspection, canonical recovery/fields and independently authenticated parent navigation. No Track A stylesheet or unrelated frontend changes were imported. Shared schema bytes were taken from reviewed security prerequisite `04a70d8`; the security stream owns its authority checks.

`DESIGN.md` mirrors the runtime token owner; `UX-CONTRACT.md` records current observable behavior. Historical constitution/inventory source documents are retained as provenance; their old test counts, absolute references and commands do not qualify this release. Approved visual references are never updated automatically.

## QA2 assertion integrity

All eight cases from `43b926d:docs/ux-hardening-2026-10-13/evidence/qa2/acceptance-cases.tsx` are placed in `tests/ux-qa2-acceptance.test.tsx`. Only relative module paths and the fixture location change. The original fixture bytes are preserved in `tests/fixtures/ux-qa2-catalog.json`. Seven historically failed cases become regressions; the unknown-share passing case remains intact.

The donor's separate supported-share happy-path fixture was corrected to the actual R2 PUBLIC/versioned projection contract. Its assertions are unchanged. Incomplete data, unknown privacy/version fields and unsupported link schemes are rejected before rendering or emitting telemetry.

## Behavioral remediation

Invalid catalog envelopes produce search error/retry instead of an empty result. Invalid percent encodings stay in the owning Robinhood reader. Incomplete share payloads recover locally. Receipt401 places corrective focus after the credential field is re-enabled.

Private Decision View does not make an anonymous mount request. It accepts credentials in memory, sends an explicit Bearer/no-store/no-redirect request, validates exact Judgment identity and authority schema, clears prior data on identity edits, and routes parents through separate authenticated receipt inspection. No signing, payment or execution capability is enabled.

The local UI qualification server no longer enables a signer based on a stale unrelated file. All application scroll regions inherit a token-based operable scrollbar baseline.

## Qualification interpretation

The portable browser harness tests eight QA2 client assertions at390 and1440 CSS pixels with synthetic controlled HTTP responses. For malformed URLs, it serves the actual built entry document because Vite rejects invalid percent encoding before its SPA handler. This is client recovery evidence, not deployment/proxy-path qualification.

The broad premium static audit exposes inherited noValidate/textarea deficiencies in untouched workflows. These remain explicit HOLD findings; this scope does not expand into experimental RH/IPX forms. Human layout approval, real devices, assistive technology, native browser zoom, and live deployment checks remain HOLD.

Source SHA, selected-path hashes, assertion integrity, actual test results and artifacts are bound in the external UX qualification manifest. Parent integration must requalify the resulting exact source tree.

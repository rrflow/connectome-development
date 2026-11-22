# Temporal relationship rules in the desktop

Status: active paired package; installed desktop readback verified on Windows;
candidate and queue qualification pending.
Parent: rrflow/rrflow-development PR496, H-08, POAM-072/073.
Baseline: Connectome main 9d8b9ebe03f102c188cecf82d64227200095c86a.

## Change brief before implementation

The engine adds native per-endpoint REJECT/CASCADE rules. Connectome currently
pins the preceding public SDK contract and would correctly refuse the new
engine's readiness. Its table view also has no readable explanation of those
rules. Update the Rust and TypeScript SDKs together to the published parent
source, regenerate their lockfiles and the existing engine-produced golden
fixtures. Keep exact readiness checks. Add a read-only relationship-rule panel
to Tables using the existing authenticated schema response. Display the source
and target rules, schema revision and knowledge cursor, including explicit
unavailable/error states. The engine remains the only policy executor.

Read: README, package.json, src-tauri/Cargo.toml, scripts/dependency-authority.mjs,
src/rrflow/session.ts schema interface, src-tauri/src/rrd.rs schema projection,
src/features/runtime/tables/tables-view.tsx and row-query.ts. Scope is those
manifest/lock bindings, their generated fixtures, the table presentation and
this record. No cloud, provider, policy authoring or inherited feature parity
is implied.

Driver: parent scripts/dev/bitemporal_proof.py installs and writes a native
project, verifies rejection/cascade at two temporal coordinates, kills and
reopens the server. The same engine build and retained project must open in
Connectome and show its real schema rules and historical/current query results.
Also verify slash and backslash spellings identify the same installed project.
No user project is reset or installed for this test.

Acceptance: dependency-authority gate; frontend type/lint/build checks;
real-process golden write then verification; native tests; actual desktop
readback; candidate and merge-group CI. Record commands, failures, skipped
checks and exact revisions below. Stop on mismatched readiness, fabricated
policy, lost historical data or an unresolved engine refusal. This UI work
cannot close the parent engine objective by itself.

## Faithful engine evidence review, 2026-11-22

Starting revision: `dd54eb1d90b4ec1036ebb33910b206e741e6b545`.
Before implementation, PR119's brief was extended to cover the engine
overview's interpretation of the same installed instance. Ownership is the
Connectome projection of DB, QL, KV/LSM and CLD observations. TX and MX behavior,
configuration authority and public contracts are unchanged. The supporting
[configuration and diagnostic pattern](engine-evidence.md) identifies the
current six-layer gaps and canonical code locations; it is not a new authority.

Complete files read for this extension: README, this record,
`src/rrflow/diagnostics.ts`, `src-tauri/src/diagnostics.rs`,
`src-tauri/src/rrd/client/configuration.rs`,
`src/features/runtime/components/inspector.tsx`, `components/notice.tsx`,
`storage/storage-tab.tsx`, `query-lab/query-answer.tsx`,
`src/features/runtime/engine/model.ts`, `engine-tab.tsx`, `engine-layer.tsx`,
`parts.tsx`, `cursor-rail.tsx`, `scripts/check-one-engine.mjs`,
`playwright.config.ts`, and the complete `tests/smoke/connectome.spec.ts`.
Root configuration, observation, storage diagnostic and LSM write-recorder
owners were also read; the parent journal identifies those exact paths.

The first revised model oracle failed against the existing implementation:
KV was marked at the semantic head rather than a separate physical sequence.
The implementation now preserves each reported coordinate, counter resets and
missing values; cold coverage advancement is not called copied records.
Cached storage/probe data exposes refresh failure, and observation history is
scoped to the project session. The existing browser oracle was corrected to
assert the independent coordinates, without weakening query/readback checks.

Commands actually run from this repository:

```powershell
node --experimental-strip-types scripts/check-one-engine.mjs
corepack pnpm check
corepack pnpm build
corepack pnpm test:smoke --workers=2
git diff --check
```

The focused model check, final full check and production frontend build pass;
all 38 browser cases pass. Browser cases use controlled transport fixtures and
are UI evidence, not engine correctness or performance evidence. The first
full check failed formatting of three newly generated engine fixtures; they
were formatted and parsed values compared equal to HEAD. A later type check
caught the session wrapper omitting `connection`; forwarding the complete
existing props fixed it. The terminology check caught one retired term in
the new supporting document; the document now uses instance partitioning.
Five pre-existing lint warnings and build dependency/chunk-size warnings remain.

Actual native desktop readback used the engine started by the root
`python scripts/dev/connectome_dev.py --jobs 4` loop and the existing retained
`D:/.usr/Temp/rrflow-temporal-relations-20261122/project`. Adding the forward-slash
path detected the installed project, started it and opened its authenticated
session without an installation preview or reset. The instance is
`instance-7284c5f3e01be1e15e7bae95`. Tables shows `proof_link`, source REJECT,
target CASCADE, schema 3 / knowledge 10, and zero current rows. Query lab
returns one row at valid 175 / known 7, then zero at valid 175 / known 10,
and one at valid 149 / known 10. Adding the same directory using backslashes
reopened the same instance and existing profile without another installation.
Its actual read path and decoded-key evidence are visible; the missing policy
admission stamp remains explicitly unavailable. These timings are individual
debug-build observations, not a latency benchmark.

The live Engine view shows semantic cursor 10 and cold coverage 10 separately
from the reported KV durable sequence 0; it does not infer agreement. That
physical watermark observation is not proof of power-loss durability or a
cross-tier atomic snapshot. Screenshots and logs are retained under
`D:/.usr/Temp/rrflow-bitemporal-validation` with `connectome-relation-*`,
`connectome-temporal-rules-*` and `engine-evidence-*` names.

Earlier native verification on the pinned SDK revision passed 88 tests with
34 ignored; the three real-process language/value/offer goldens passed.
This extension changes no native code or SDK schema. No Rust benchmark,
release/diagnostic parity run, CLD backend comparison or complete prompt-trace
qualification was run. No six-layer completion, competitive performance,
feature parity or successful merge is claimed.

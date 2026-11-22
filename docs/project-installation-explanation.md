# Explain the installed database before filesystem details

Package brief, baseline `36d388e919c27de7b72fbccb3d7e7af7bbb71030`.
Parent engine delivery: rrflow/rrflow-development#494, H-06 and the installed
bitemporal database proof. One child candidate owns these UI files.

The real desktop currently leads with thirteen managed paths, including
temporary installation files, before explaining the database or server. This
is an observed usability failure, not evidence of thirteen logical records.
The underlying engine plan already provides the storage profile, instance
identity, storage-root path and project locator. Render those actual fields;
unknown fields must not fabricate a database, port or capability.

Read: installation-facts.ts, installation-summary.tsx,
scripts/check-installation-facts.mjs and docs/native-workbench.md; project-row
installation consumer and project-manager/native startup path inspected.
Scope: these presentation/fact projection files, their existing focused check,
and this evidence record. No engine authority, install plan, permissions,
schema, lifecycle, transport or credential changes.

Oracle: preview a real installation in the desktop; show its native persistent
database location and local-server startup, retain exact managed paths and raw
plan on demand. Existing facts tests must preserve unfamiliar-plan behavior;
run pnpm check and build, then inspect the actual desktop. This is a UI repair,
not database capability/parity proof. Stop on invented facts or altered effects.

Validation: `node --experimental-strip-types scripts/check-installation-facts.mjs`,
`pnpm check` and `pnpm build` passed on Windows. Existing build warnings concern
inherited WASM/browser imports and large chunks; the native-parity checker still
reports 289/348 capabilities incomplete and 66/66 visual comparisons unqualified.
Those limits are unchanged. The actual desktop, served by Vite over native
Tauri/RRD, displayed the real plan for an isolated preview-only directory:
storage root `.rrflow/rrd/roots/install-6fa5498caa70de74b9616a94`, locator,
local-server behavior, and all 13 paths in the expandable list. Cancel left that
directory uninstalled. Screenshot retained at
`D:/.usr/Temp/rrflow-bitemporal-validation/connectome-installation-preview.png`.
Full changed-file/diff review completed; no source capability or install effect
changed. Candidate and merge-queue gates remain required.

## Paired contract binding discovered during the installed journey

The new engine contract in parent PR494 includes a public query-transaction
operation. This desktop at 85930c4 correctly refused its readiness because
the Rust/TypeScript SDKs still pinned the older contract at 9b35cca. Extend this
same joined candidate to pin both public SDKs and their lockfiles to engine
revision `dd1f7a182f6978b577915117f2090055df160749`. Keep exact-contract
validation; no compatibility bypass or private engine dependency. Read
src-tauri/Cargo.toml, package.json, scripts/dependency-authority.mjs and the
engram readiness check. Acceptance adds dependency-authority validation,
native compilation/process conformance and the actual retained project's
valid-time/known-cursor queries in the desktop. Parent PR494 pins this child
only after its green merge. The parent source commit is already published;
no local-path dependency is introduced.

Initial CI run 44986579524 failed the existing render test's assertion for
the removed heading "What installing does". The updated "Your project database"
assertion passed with `pnpm exec playwright test tests/smoke/projects.spec.ts
--grep 'adding a project asks'` (one test, Windows). Other install/start/save
assertions remain. Native Ubuntu/macOS/Windows jobs passed on that revision.

The connected retained database also exposed a false refusal in Tables:
`proof_document` is a native schemaless document table, but TableDetail treated
its absent strict record schema as proof that it could not be queried. The
public engine and the live One engine view both return its two records. Extend
the existing table eligibility condition to require registration only for
non-schemaless tables; preserve engine parsing, authorization and query budgets.
Read tables/tables-view.tsx and row-query.ts in full. Acceptance is the same
retained table displaying Original/Corrected's current record and Evidence,
plus historical cursor queries in Query lab. No database schema is rewritten
to satisfy a client-only assumption.

The final paired desktop connected to retained instance
`instance-52ff55ae0e362f21637b617f` without another installation. Query lab
returned Original for valid 100/known 6 and Corrected for valid 100/known 7;
the persisted relation linked alpha to beta. Tables now returns both Corrected
and Evidence from the schemaless table, reporting cursor 7, schema 2 and 47
storage keys examined. The engine view reports DB/KV/QL/columnar publication
watermarks at 7; this does not prove unified hot/cold QL or performance parity.
Retained screenshots under `D:/.usr/Temp/rrflow-bitemporal-validation`:
`connectome-known-6-original.jpg`, `connectome-known-7-corrected.jpg`,
`connectome-persisted-relation.jpg`, `connectome-schemaless-table.jpg`,
`connectome-live-database.jpg`, `connectome-live-engine-diagnostics.jpg`.

The SDK move required regenerating all three engine golden fixtures through
the actual process tests (`CONNECTOME_WRITE_GOLDEN=1`, then unset):
`cargo test --locked golden_matches_the_engine -- --ignored --test-threads=1`.
All three passed both writing and verification. Values and query semantics
were unchanged; the capability fixture gained query-transaction-execute.
`pnpm check` and `pnpm build` passed after the final table repair. The five
project-manager smoke tests passed. `cargo test --locked --all-targets` passed
88 tests; 34 real-process tests are ignored in that command, with the three
golden process tests run separately above. CI runs the full process suite.
The Cargo resolver also selected its already-locked windows-sys 0.61.2 for
socket2; no crate version was upgraded. The changed-source/lockfile/fixture
diff was reviewed. Alarm #118 tracks the initial CI failure until a green
candidate. Parent integration and both merge queues remain required.

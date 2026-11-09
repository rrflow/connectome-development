# Native turnkey RRFlow workbench

Goal: give the bundled native engine a discoverable, explicit local-start and multi-model exploration workflow.

Baseline: `50f4b75b9a3a5802d4f95a34debb2dfc866a3d49`; [PR12](https://github.com/rrflow/connectome-development/pull/12). Owning outcome: RRFlow OBJ-09/H-06 prerequisite, with the existing D-01 installation contract. This record does not qualify H-06 or a release.

## Change brief and traceability

Before implementation, the local PR body recorded scope, first oracle, research/debug choices and stop conditions. GitHub requires a differing source commit before a PR can exist: the initial reviewed SDK pin commit `f378e43744b52d242610ebd978a430d6b4f09363` created the draft PR before runtime/UI edits. The brief was refined there after discovering that data_snapshot is internal; this package uses public schema-read and query instead.

Existing native `RrdClient`, leases, sidecar digest validation, authenticated readiness, owned-process stop, record/relationship, vector and storage views remain the canonical paths. `estate::install` previously accepted its own plan. It now requires the exact operator-accepted digest and regenerates the native plan before applying. `preview_estate` creates at most an empty planning directory, never an installed locator. Existing estates reopen without a new installation. Engine helpers suppress Windows console windows.

Overview now exposes local startup and a DB/QL/KV learning guide. The inherited sandbox card is removed from this entry page; its separate implementation is not rewritten or claimed as native proof. The current runtime view starts with authenticated schema discovery and model explanations. Bounded queries expose their actual query, cursor and limits. Unsupported/unregistered sources are labelled, vector access uses its existing lens, and time-series reads explicitly select the series record kind. Credentials remain native; no provider, account or upload is enabled.

Changed/created paths are the PR's Git diff: SDK/Cargo pins and locks; estate/client/command registration/process tests; serving adapters/action/types; session bridge; Overview local guide; RuntimeConnection model lens; browser smoke; README and docs/native-workbench.md; this journal/index; Windows path normalization in the identity check; removal of invalid optional NSIS banner references in tauri.conf.json. No database implementation, engine protocol, product version, or first-party source authority moves.

Files reviewed at the implementation boundary (complete source files; lockfile pin sections as noted): README.md, GOVERNANCE.md, .agents/sprints/009-connectome-ownership.md, .agents/sprints/010-public-rrflow-association.md, package.json, pnpm-lock.yaml (pin sections), src-tauri/Cargo.toml, Cargo.lock (pin sections), src-tauri/src/rrd.rs, rrd/client.rs, rrd/client/process.rs, rrd/estate.rs, rrd/engine.rs, rrd/view.rs, main.rs, src/rrflow/session.ts, adapter/base.tsx, browser.tsx, desktop.tsx, components/ActionBar/serving.tsx, Overview/index.tsx, RuntimeConnection/index.tsx and its tabs/types, src/types.tsx, tests/smoke/connectome.spec.ts, scripts/check-retired-identities.mjs, scripts/engine/build-sidecar.mjs, Tauri configs and CI workflow. RRFlow owning records were followed through README, objective, Gate H, client, bootstrap, installed-lifecycle and change-authoring contracts. Newly authored files and the full changed diff were reread.

Research decision: existing canonical engine APIs and executable grammar are the sources; no upstream implementation is imported. Retain stamped/budgeted reads, native redacted errors and existing stage events. Process/debug logs and real WebView2 inspection establish behavior; no performance or full accessibility qualification is claimed. Stop on changed engine authority, missing public operation, credential disclosure, unbounded download, destructive project action or mismatched sidecar.

## Acceptance evidence (Windows, 2026-10-19)

Engine/SDK revision: `4860a253663c9c757800aafeb40890b76114c4f0`; rrflow.exe SHA-256 `906147b144542cc5a907031045efe55c2533113be6ada5680e72aef4e68f372c`. Native target uses CARGO_PROFILE_DEV_DEBUG=0 and CARGO_PROFILE_TEST_DEBUG=0. RRFLOW_BIN names that exact executable.

- `corepack pnpm install --frozen-lockfile`: passed.
- `corepack pnpm check`: passed, 406 files; identity/dependency/version/TypeScript checks pass.
- `corepack pnpm build`: passed production frontend.
- `corepack pnpm test:smoke`: 3 passed; rendering/guide/native-platform distinction only.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: passed.
- `cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked`: 27 passed, 4 deliberately ignored process tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`: passed.
- First oracle `cargo test --manifest-path src-tauri/Cargo.toml --locked native_preview_requires_exact_acceptance_and_reopens -- --ignored --test-threads=1`: passed against the real binary. No acceptance and mismatched digest reject before a locator exists; matching acceptance installs, authenticates, stops and reopens the same instance.
- Owning integration suite `cargo test --manifest-path src-tauri/Cargo.toml --locked rrd::client::process -- --ignored --test-threads=1`: all 4 passed, final run 74.14 seconds. Tests cover separate sessions, preview/reopen, verified sidecar, schema/read cursor, records, 13 graph relations, vectors/storage, and real key/value, event, time-series and geo queries. Object schema display is tested without inventing object content or inference.
- `corepack pnpm engine:check`: passed exact staged engine identity.
- `corepack pnpm tauri build --debug --bundles nsis --config src-tauri/tauri.bundle.conf.json`: passed Windows desktop with production frontend and sidecar, plus NSIS development installer. Final bundle has no invalid-banner warning.
- Actual packaged WebView2 journey: local-start preview, cancel, reopen preview, exact acceptance, native authenticated catalogue; seed using the native rrflowDB example, then UI query returns Local AI project. Close and reopen the desktop; schema/query and graph still read the persisted project. `rrflow verify --project <estate> --level quick` passed after shutdown. This is a local real-process journey, distinct from browser mocks.

## Surfaced failures and boundaries

An event fixture initially paired a strict schema with schemaless mode and was correctly rejected; fixed the fixture. A schemaless key/value record persisted but `record:settings` was rejected as unregistered. Positive coverage now defines the typed record schema; the UI disables unsupported row browsing and documents the open engine query gap for parent POAM-011. A series query using the sample kind returned zero rows because the source matches the series record kind; fixture and selector now express that actual contract. No hidden compatibility workaround was added.

Windows slash handling caused identity allowlist false positives; normalize relative separators. Existing checkout CRLF caused formatter noise; normalize text without unrelated content changes. Early scripted UTF-8 edits and a case-sensitive UI assertion were corrected before final validation. Initial installer warnings identified invalid inherited BMP banners; remove their optional config references and use default installer presentation. Build retains inherited vendor/Wasm and chunk-size warnings; their larger convergence remains owned by H-06.

Not run: clean-machine installer execution, code signing, macOS/Linux desktop packaging, remote TLS/live-delivery/fault corpus, full accessibility/resource qualification, PostgreSQL clients, model inference, hosted devspaces or cloud synchronization. The unsigned Windows debug development artifact is not an official release. CI runs the platform-native checks and real Linux process suite after push; the PR records their exact candidate and merge receipts.

Checklist: owner/scope, baseline/current diff, source/behavior traceability, first failure oracle, research decision, trace/resource/debug decision, scoped implementation, focused/package acceptance, failure disclosure, full-file/diff review, linked evidence and deferred CI/merge receipt are recorded. No alpha objective or roadmap gate changes status. Remaining H-06, schema-query, PostgreSQL, media-provider and account/sync gaps remain open.

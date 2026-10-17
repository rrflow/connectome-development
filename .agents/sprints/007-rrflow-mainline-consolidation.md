# Sprint 007 — RRFlow mainline consolidation

Status: active

## Goal

Make this Tauri application the only Connectome client, bind it to generated
RRD contracts, absorb the useful diagnostics behavior from RRFlow's temporary
workbench, and advance `main` only after executable desktop/web evidence.

## Authority decisions

1. `apps/connectome` is the authoritative Connectome application.
2. RRFlow's temporary `connectome-ui` Rust/static workbench is source material,
   not a second client and not a compatibility target.
3. `@rrflow/rrd-client`, generated from `rrd-contract`, owns HTTP request and
   response types. Connectome may add view models, but not duplicate wire
   schemas, route registries, capability catalogues, or protocol versions.
4. RRFlowQL is the query-language identity. RRD is the runtime/daemon identity.
   The retired pre-release vocabulary receives no alias or fallback.
5. The application remains a Tauri 2 client for Windows, macOS, and Linux. The
   browser build is a development/preview face and must still render correctly.
6. Dependency upgrades land in independently verified cohorts. “Latest” means
   the newest stable compatible release after its migration gate passes, not a
   single unreviewable manifest rewrite.

## Baseline captured 2026-08-26

- Branch `agent/connectome-rrflow-panel` is a strict descendant of `origin/main`
  and matches its published remote at `63f5d92d`.
- Biome checks 557 files with no diagnostics.
- TypeScript check passes.
- The production frontend builds from source.
- Native `cargo check --locked` and `cargo test --locked` pass after installing
  the same Linux WebKit/libsoup packages declared in Connectome CI.
- The default production web build does not render: compression overwrites the
  original WASM files with gzip bytes while the preview server supplies no
  `Content-Encoding`. A build with compression disabled renders the Overview.
- Prior CI is green but has no browser render smoke test, so it did not detect
  that failure.
- The diagnostics page and native bridge use a handwritten, retired protocol
  schema and a fixed five-route allowlist.
- The package named `@rrflow/client` currently resolves to the SurrealDB client;
  it is not RRFlow's generated RRD client.
- The parent engine checkout records submodule revision `625e8b1b`, while its
  dirty worktree points to `63f5d92d`. No parent pointer change is committed.

## Ordered implementation slices

### Slice A — executable rendering and smoke gate

Files:

- `vite.config.ts`
- `package.json`
- `.github/workflows/connectome-ci.yml`
- `tests/smoke/*`

Work:

1. Preserve original WASM artifacts; emit compressed siblings only.
2. Add a deterministic headless browser smoke test that fails on page errors,
   verifies the Connectome shell, and captures the Overview.
3. Run the smoke test against the exact production build served by CI.

### Slice B — canonical pre-release identity

Files:

- `package.json`, `pnpm-lock.yaml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/diagnostics*`
- `src/rrflow/*`, query editor/hooks/vendor modules, UI text, tests, and docs

Work:

1. Rename the query language to RRFlowQL in symbols, modules, package aliases,
   editor labels, MIME type, and `.rrflowql` file association.
2. Rename the diagnostics protocol and types to RRD.
3. Add a repository scan that prevents retired names from returning.

### Slice C — generated RRD contract authority

Files:

- RRFlow `sdks/typescript/*`
- Connectome `package.json`
- `src/rrflow/client/*`
- `src-tauri/src/diagnostics*`
- connection, diagnostics, control-plane, and error-boundary UI

Work:

1. Mount Connectome at RRFlow `apps/connectome` and consume
   `@rrflow/rrd-client` from the parent workspace.
2. Replace handwritten route/response schemas with generated endpoint types and
   ArkType validation supplied by the SDK.
3. Replace the native fixed route allowlist with generated safe-operation
   metadata plus explicit method, payload, TLS, redirect, and size policy.
4. Bind capability rendering to RRD's authoritative catalogue.

### Slice D — absorb the temporary workbench

Keep as Tauri views backed by RRD:

- connection catalogue and negotiated instance identity;
- estate desired/observed state and reconciliation progress;
- tables, model catalogue, schema, and RRFlowQL studio;
- runtime capability/surface matrix and runtime-tool catalogue;
- prompt-flight playback, temporal stream, causal traces, cluster history, and
  graph lenses with freeze, seek, reverse, speed, and evidence inspection.

Delete after parity evidence:

- RRFlow `crates/connectome-ui` package, embedded static server, handwritten
  snapshots, and direct lower-crate dependencies.

No view may open `rrd-store`, `rrd-query`, `rrd-vector`, or another physical
crate directly. Embedded/local/remote modes cross `rrd-engine` or the public
RRD service contract.

### Slice E — dependency cohorts

1. Tooling: pnpm 11.24, Biome 2.5, TypeScript 5.9 line, ArkType 2.2, and current
   patch/minor editor/build dependencies.
2. Tauri: synchronize JS and Rust API/plugin versions exactly as required by
   Tauri's update contract; verify native check/test/build after the cohort.
3. Rendering: React 19.2 and Mantine 9 together, including official codemods and
   migration changes; verify every major view.
4. Build: Vite 5 → 7 compatibility step → Vite 8/Rolldown, then plugin majors;
   verify production WASM loading after each step.
5. Visualization/data libraries: upgrade graph, XYFlow, Sigma, CodeMirror,
   state, date, and serialization dependencies in coherent peer groups.
6. Remove inherited Surreal client/WASM/editor packages when the generated RRD
   SDK and native RRFlowQL implementation cover their used behavior. Until
   then, source provenance remains explicit and aliases may not impersonate an
   RRFlow-owned package.

## Merge and publication gate

Before advancing Connectome `main`:

- clean retired-identity and dependency-authority scans;
- Biome check and TypeScript check;
- production build plus headless render/console smoke test;
- native formatting, `cargo check`, tests, and strict Clippy;
- RRFlow generated-SDK check and Connectome/RRD process integration tests;
- Windows, macOS/ARM, and Linux required jobs green on the pushed branch;
- reviewed commit range with no generated bundle or unrelated inherited churn.

After Connectome `main` is green:

1. update the parent engine submodule pointer in an isolated commit;
2. mount that exact Connectome commit under RRFlow `apps/connectome`;
3. remove the temporary workbench only after feature-parity tests pass;
4. run the full RRFlow platform matrix;
5. push each repository in dependency order and journal exact run URLs.

## Execution journal

### 2026-08-26 — Slice A local gate

- Changed Vite compression to retain source WASM artifacts and emit `.wasm.gz`
  deployment siblings.
- Added a Playwright production-build smoke test and CI evidence upload.
- `pnpm build`: passed with compression enabled.
- `file dist/assets/*.wasm`: all three artifacts reported WebAssembly MVP
  modules; corresponding `.wasm.gz` files reported gzip data.
- `pnpm test:smoke`: passed in Chromium and attached the rendered Overview.
- Targeted Biome check: passed.
- `pnpm exec tsc --noEmit`: passed.
- Native and remote platform gates remain required before merge; this entry is
  evidence for Slice A only, not a product-completion claim.

### 2026-08-26 — RRFlowQL and tooling cohort

- Renamed RRFlowQL modules, symbols, file associations, MIME type, saved-query
  extensions, editor labels, and RRFlowML documentation assets with no alias or
  forwarding module.
- Replaced RRFlow-branded query parser/editor aliases with explicitly
  attributed SurrealDB dependencies; the remaining RRFlow-branded Surreal
  aliases are separately tracked transport/UI migration work.
- Added `scripts/check-retired-identities.mjs`; it passed across 751 product
  files and is part of the frontend CI gate.
- Updated pnpm to 11.24.0, Biome to 2.5.10, TypeScript to 5.9.3, Node types to
  22.20.1, and the minimum Node runtime to 22.13.
- Biome configuration migrated to 2.5.10. All 566 checked files pass with no
  diagnostics after reviewing the newly surfaced correctness findings.
- `tsc --noEmit`, compressed production build, and Chromium render smoke pass.
- Linux native formatting, check, test, and strict Clippy pass with the locked
  dependency graph.
- Consolidated duplicate CI into one workflow and added Linux, macOS 15 ARM64,
  and Windows 2025 native jobs. Remote evidence is still pending.
- A parent `/devlabs/pnpm-workspace.yaml` caused local installs to validate the
  wrong lockfile. Connectome package installation was repeated with
  `--ignore-workspace`; the isolated lockfile and `node_modules` now match.
- Before the app-owned workspace file landed, local validation commands used
  `pnpm --ignore-workspace ...` to select the app's declared pnpm 11.24.0
  instead of the parent prototype's pnpm 11.22.0.
- Canonical RRD diagnostics and the generated TypeScript SDK are present only
  in RRFlow's unpublished worktree. The handwritten prompt-flight protocol was
  not relabelled or represented as complete RRD integration.

### 2026-08-26 — first remote matrix correction

- Push run `32924463247` reproduced a clean-install failure before the frontend
  build: pnpm 11.24 rejected unreviewed dependency lifecycle scripts.
- A fresh standalone clone reproduced the same failure for `@parcel/watcher`,
  `esbuild`, and `sharp`; this proved the local `--ignore-scripts` install had
  not exercised the clean CI contract.
- Added an app-owned `pnpm-workspace.yaml`. It isolates Connectome from the
  unrelated parent prototype workspace and explicitly allows only those three
  required build packages. A clean frozen install is required before repush.

### 2026-08-26 — native release artifact gate

- The first native release build produced the optimized Linux executable but
  bundling failed because updater artifacts were enabled without an updater
  public key, endpoint, or signing key.
- Disabled updater-artifact generation for pre-release builds. Standard native
  bundles remain required now; signed automatic updates remain blocked until a
  reviewed key, HTTPS release endpoint, CI secret, rotation process, and update
  installation test exist.

### 2026-10-16 — Slice D: native SDK lenses (Database, Vectors, Storage)

Starting revision `38f68ce` on `agent/rrd-engine-lenses`.

- Authenticated RRD reads now cross RRFlow's Rust SDK instead of handwritten
  envelopes: `rrd-client` and `rrd-contract` are pinned by git revision to
  `rrflow/rrflow-development@94c9aa9`, so the native client and the engine it
  targets share one contract. This is the dependency justification required by
  `REVIEW.md`: the SDK validates every response against the contract, which is
  Authority decision 3 applied to the native side. `rust-toolchain.toml` pins
  Rust 1.99.1, the toolchain RRFlow pins, because the SDK builds from source
  in this crate graph.
- `src-tauri/src/rrd/view.rs` projects validated responses into view models;
  `src/rrflow/session.ts` mirrors those view models and no wire schema. The
  operator credential is read from its file by the native process and never
  reaches the webview; the connection stores only the file path.
- Bounds come from the contract (`MAX_QUERY_BYTES`,
  `MAX_VECTOR_STORAGE_KEYS`, `MAX_VECTOR_POINT_PAGE`,
  `MAX_VECTOR_SEARCH_TOP_K`, `MAX_DIAGNOSTIC_RUNTIME_SCANNED_CHANGES`) and
  query budgets from the estate's configured `configuration.query`.
- Lenses on the runtime page: Database (schema registry, ForceAtlas2 record
  and relation graph, record inspector, RRFlowQL console with record and
  traversal queries), Vectors (collections, named-vector contract, paged
  point scroll, exact query-by-example search with read evidence), and
  Storage (cursors, sequences, retention, vector artifacts, query indexes).
- The public handshake parser now reads the current capability contract
  (`deployment`, `installed_estate`, `configuration`) instead of the retired
  scalar `deployment_mode`.

Verified locally: `pnpm check` (Biome, identity gate, `tsc`), `cargo fmt
--check`, `cargo check`, `cargo test` (5 passed), and strict Clippy, all with
`--locked`.

Not yet done: rrflowKV cache, memtable, WAL, and compaction counters are
recorded inside the engine but not published by `diagnostics-read`; the
Storage lens states that gap until the engine change lands. The wider
Connectome UI still mixes `RRFlowQL` with RRFlow's own `rrflowQL` spelling in
the engine README; Authority decision 4 governs this repository.

### 2026-10-16 — rrflowKV storage lens and desktop launch fixes

- `rrd-client` and `rrd-contract` move to
  `rrflow/rrflow-development@c3e9b8c` (branch
  `diagnostics/rrflowkv-storage-evidence`), whose `diagnostics-read` now
  carries a `storage` section with `observation` authority. Re-pin to the
  merged `main` revision before this branch merges.
- `view.rs` projects those counters into generic metric groups (page cache,
  memtable, write-ahead log, segments, flush and compaction, segment I/O,
  sequences) plus headline gauges; the renderer formats by unit and shows
  each cumulative counter's change since the previous refresh. A profile
  without physical counters renders that fact instead of zeros.
- Fixed: every desktop launch panicked because the updater plugin was
  registered without an updater configuration; it now registers only when
  the build declares one. Native CI never launches the binary, so this
  survived green CI.
- Fixed: the native session dialed the first resolved `localhost` address
  (`::1` on Windows) while RRFlow listens on `127.0.0.1`; it now probes the
  loopback addresses and dials the first that accepts.

Verified locally: `pnpm check`, `cargo fmt --check`, strict Clippy, and
`cargo test` (8 passed), all `--locked`; a headless launch stays up where the
previous revision exited 101.

### 2026-10-16 — desktop renderer, neighbourhood graphs, and the merged SDK pin

- Fixed (`f412398`): the desktop renderer was a blank white window. Window
  labels are `connectome-*` but the capability granted `Connectome-*`, and
  Tauri matches window patterns case-sensitively, so no IPC was permitted.
  The capability file is now `capabilities/connectome.json`, and
  `application_windows_match_the_capability_window_pattern` reads that file
  and fails if the window label prefix stops matching it.
- The runtime page leads with its lenses once a session is open; engine
  identity, attunement, and mesh details sit behind a toggle (`61b5a34`).
- The Database lens draws either the whole estate or one record's
  neighbourhood (1–3 hops, outgoing, incoming, or both), filters by record and
  relation kind, and keeps the drawn neighbourhood lit while the focus is
  selected; nested query values render as plain lists and maps (`3cb07d8`,
  `d53584f`).
- The render smoke fixture now answers with the current capability contract;
  the smoke had failed since `5a75034` on the retired `deployment_mode`
  field (`28f5662`).
- `rrd-client` and `rrd-contract` now pin
  `rrflow/rrflow-development@b275792`, the merge of pull request #3 into
  `main`; the storage section the Storage lens renders is merged engine
  contract, not a branch.

Verified: Connectome CI passed all four jobs at `28f5662`. At the new pin,
strict Clippy and `cargo test` (11 passed), both `--locked`. The Windows
desktop app was driven through WebView2 DevTools against a live estate on the
development server (270 records, 986 relations, 270 vectors), and every lens
was reviewed by screenshot.

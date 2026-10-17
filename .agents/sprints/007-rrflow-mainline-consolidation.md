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

### 2026-10-16 — plain-language lenses, verified in the desktop app

Branch `agent/layman-lenses-wip`, from `61d9c6a`, through `abc549c`.

- The runtime page explains itself to a first-time reader. Three lens
  cards (Records & relations, Vectors, Storage engine) lead; every RRFlow
  term is dotted-underlined with a plain meaning, and "What do these words
  mean?" opens the whole glossary. Terms stay canonical; only the
  explanations are plain.
- Records & relations colours the estate by cluster (deterministic Louvain
  over the relations, computed natively in `src-tauri/src/rrd/cluster.rs`
  and named after each cluster's most linked record), kind, folder, or
  field. It adds hover cards, "Start here", a selection panel with links in
  and out, the neighbourhood view, and a collapsible RRFlowQL console.
- Vectors draws a similarity map in which every line is an engine
  exact-search hit (`rrd_vector_map`, five nearest per point), coloured like
  Records. Selecting a record lists its most similar records from the
  engine, with scores.
- Storage engine draws rrflowKV's write path as four stages (write-ahead
  log, memtable, segments, page cache) with live readings and a plain status
  sentence; every engine counter is one click away.
- Graph labels are placed per frame without overlap (`labels.ts`): highest
  priority first, right of the node or else left of it, clear of the canvas
  edges, its controls, and the selected or hovered node.

Defects found by driving the real app, and fixed:

- A sign-in replayed a lapsed session (`6f28488`). Correlation ids counted
  from 1 on every launch, so each launch's first `CreateSession` carried
  `connectome-key-1`. The engine derives a session's identity from that key
  and answers a repeated key with the first result, so every launch got the
  session an earlier launch opened (the strip showed "idle expiry 4:29 PM"
  at 7:12 PM with both clocks in sync). Ids now carry a random
  per-connection prefix; deadlines run on the local monotonic clock; a
  lapsing session is renewed in place, or replaced and closed, under a
  write lock, so no in-flight request loses its bearer.
- Every lens call held the native mutex for its whole round trip, so the
  similarity map blocked every other lens while it built. Commands now
  release the state lock before any request.
- Map progress never appeared (`8ba7163`). `tauri` resolves to 2.10.3 while
  `@tauri-apps/api` was pinned at 2.4.0: the crate sends channel messages as
  `{ message, index }`, the 2.4 `Channel` reads `{ message, id }` and parked
  every message. The JS API now matches the crate's minor (2.10.1).
- Opened during a map build, Storage engine waited about 47 s, then could
  fail. The engine's diagnostic snapshot re-assembles until a before/after
  stamp matches; the stamp includes the control sequence, which every
  audited request advances, so under the map's steady searches all three
  attempts change and the engine answers 409 `StorageConflict`, marked
  retryable (`abc549c`). Session commands now return
  `{ message, retryable }`; diagnostic reads retry retryable conflicts with
  backoff and say "The engine is busy" in plain words, keeping their last
  reading on screen. The engine-side cause is an RRFlow deficiency, not
  fixed here.
- The selected record said it had no vector until the map finished, map
  progress was lost on a lens switch, and the console read "1 ROWS"
  (`d98dda1`, `00ef348`, `df82883`).

Known, not fixed here: the map costs one exact search per point, and each
search re-reads the change log from cursor 0 (RRFlow plan step 2b). On the
live demo estate: 270 searches, 1,320,583 keys examined, 46.9 s (57.1 s
while the Storage lens retried its busy reads).

Verified: `pnpm check`, render smoke, `cargo fmt --check`, strict Clippy,
and `cargo test` (23 passed), all `--locked`; Connectome CI green at
`df82883`, `00ef348`, `8ba7163`, and `abc549c`. The Windows desktop app was
driven through WebView2 DevTools against the live estate (271 records, 986
relations, 270 vectors): the strip reads "Signed in as local-operator since
8:24 PM · renews automatically"; similar records showed 1.4 s after opening
Vectors with the map still building; Storage explained the busy engine
3.4 s into the build; progress survived a lens switch ("40 of 270 searches
done · about 57 s left"); every lens state was reviewed by screenshot.

### 2026-10-17 — merge gate: dependency authority, generated SDK, RRD process tests

PR #1, `agent/rrd-engine-lenses` → `main`. The branch was fast-forwarded
from `61d9c6a` to the desktop-verified `bb43fe7`; the gate work is `50d6df1`
through `d60cca7`.

- Dependency authority (`50d6df1`, `b56def8`). Four `@rrflow/*` npm aliases
  resolved to SurrealDB packages, against Authority decision 3 and Slice
  E-6. They are now declared and imported under their own names at the same
  resolved versions (`@surrealdb/ui` 1.0.93, `@surrealdb/wasm` 3.0.3,
  `surrealdb` 2.0.3); `@rrflow/cbor` had no importer and is dropped.
  `scripts/check-dependency-authority.mjs` runs in `pnpm check`. It fails
  when an `@rrflow/*` name aliases another publisher's package, when an alias
  hides its target's scope, when an RRFlow crate in `Cargo.lock` comes from
  any repository but `rrflow/rrflow-development`, is not pinned to one exact
  commit, or is not a public contract crate (`rrd-client`, `rrd-contract`),
  and when the RRFlow crates resolve to more than one commit. Each rule was
  proven against a synthetic manifest that breaks it.
- RRD process tests (`a84bd5c`). Two ignored tests in
  `src-tauri/src/rrd/client/process.rs` install a fresh estate with a real
  `rrflow` (`install plan`, then `install apply --expect <plan_sha256>`),
  serve it on a kernel-chosen loopback port (`--json serve --bind
  127.0.0.1:0` announces the address), wait for `rrflow ready`, load a
  fixture through the SDK (two groups of four linked documents with
  8-dimension vectors), and drive `NativeRrdClient` the way the lenses do.
  Restoring the old per-launch id scheme makes the replay test fail with 412
  `SessionExpired`, so the test catches the defect the desktop run found.
- The process tests found an RRD defect (`cc90ce9`). `rrd-security`'s
  `audit_since` marks the control tail as reached whenever the last journal
  page it read was partial, even when it stopped inside that page at the
  record limit. When the limit-th audit record lies in the final, partial
  page and is not the head, the read fails with 400 "audit chain does not
  reach its durable head". On the fixture estate the 64-record audit page
  Connectome asked for failed every time. The lenses render neither the
  change page nor the audit page, so the diagnostic read now asks for one
  record of each: a non-empty one-record page is never partial, so the flag
  is set only by an empty read. "Audit through" showed the journal position
  after the first audit page from genesis, not a head, and is removed. The
  engine fix belongs to RRFlow (its plan step 0).
- CI (`15667c7`, `d60cca7`). Job `rrd-process` resolves the RRFlow revision
  `Cargo.lock` pins, checks the engine out at that revision, runs RRFlow's
  own generated-surface parity check (`scripts/ci/check_generated_surfaces.py`)
  there, and builds `rrflow` in that checkout without debug info at
  opt-level 1. Install and serve hash the executable they pin: about a
  minute per step on the 1.2 GB unoptimised debug build, under a second on
  this one. The engine is saved by revision once both pass, and the process
  tests run with `--ignored`.

Gate evidence at `d60cca7`:

- Retired-identity and dependency-authority scans, Biome, TypeScript,
  production build, and render smoke: the frontend job.
- Native formatting, `cargo check`, tests (23 passed, 2 ignored), and strict
  Clippy: the native jobs on ubuntu-22.04, macos-15 (ARM), and windows-2025.
- RRFlow generated-SDK check and RRD process tests: the `rrd-process` job,
  which verified generated-surface parity at `b275792` (33 HTTP operations,
  OpenAPI `733695656b3d…`, 7 signal projections) in 54 s, built `rrflow` in
  14 min 41 s, and passed both process tests in 4.35 s.
- Runs: push
  [39062460824](https://github.com/rrflow/connectome-development/actions/runs/39062460824)
  and pull request
  [39062464091](https://github.com/rrflow/connectome-development/actions/runs/39062464091),
  both green on every job.
- Commit range `38f68ce..d60cca7` reviewed: 26 commits, 279 files (247 of
  them `50d6df1`'s import renames), no generated bundle.

Not run: the RRD process tests run on Linux only. The desktop run above
drove Windows at `abc549c`; `50d6df1`'s package renames and `cc90ce9`'s
one-record pages are covered by CI's build, render smoke, and process
tests, not by a desktop run. macOS has no desktop run.

# Branch absorption ledger

**Status:** active working record; claims only what is stated per row
**Opened:** 2026-11-17

One branch of record for Connectome is `main`. Every other branch on
`rrflow/connectome-development` is listed here until its features are either on
`main` (read, with a file) or deliberately retired by the owner. A branch is not
retired by a diff count, ancestry, a path match or a patch-id; those only say a
commit's text exists somewhere. The evidence levels are **Read** (the branch
code and its counterpart on `main` were read), **Tested** (a check that fails
without the feature passes on `main`) and **Not read** (no claim).

## `agent/rrflow-native-connectome` (tip `8a9eb5e5`, base 2026-10-16): partly carried, partly pending

Design record read in full (`docs/rrflow-native-rewrite.md`), plus `knowledge.rs`, `knowledge.ts`, `ssh_forward.rs`, `editor/lexical.ts`, `editor/parser.ts`, `editor/index.ts`, the export lists of `client/values.ts`, `shared/util/rrflowql/native.ts` and `rrflow/ui/index.tsx`, and the rewrite's tests list. Sprint 009 decision 14 says this branch was "salvaged": its lexer and parser, dependency gate and knowledge-tree work were to be rebuilt on `main` "with credit". The dependency gate is on `main`. The rest is as below.

| Item on the branch | On `main` | State |
|---|---|---|
| Knowledge-tree bridge (`rrd/client/knowledge.rs`, tests) | absent before PR #68 | carried by PR #68; `cargo test knowledge` 2 passed |
| Knowledge model: three-way draft rebase by immutable id, conflicts kept, cycle and orphan repair (`knowledge.ts`, 9 tests) | absent before PR #68 | carried by PR #68 |
| Knowledge editor tab (`tabs/knowledge.tsx`, 1,358 lines) | absent | **pending**: needs the area/tab structure from PR #67, and must be split to fit the architecture gate |
| SSH-forwarded existing profile (`ssh_forward.rs` 460 lines, 5 tests; `runtimeSshHost` in the connection form, serving action and runtime client, about ten sites) | absent | **pending**: Rust module read in full, wiring read; port after #67 |
| Authored value classes and helpers: `Table`, `RecordId`, `Decimal`, `Duration`, `Uuid`, `DateTime`, `FileRef`, geometry types, `escapeIdent`, `equals` (`client/values.ts`, 276 lines) | `main` re-exports the inherited client from `src/vendor/rrflow-client.ts` (its own header says it is transitional) | **pending**: replaces that wrapper when the 20+ importing components are re-authored (sprint 009 decision 18) |
| `NativeRRFlowQL` (`shared/util/rrflowql/native.ts`, `values.ts`) | `createRRFlowQL` still picks the inherited V2 or V3 WASM | **pending**: same re-authoring |
| rrflowQL presentation editor: scanner, statement ranges, formatter, parameter discovery, Lezer parser (`editor/lexical.ts`, `parser.ts`) | `main` has a different language built from the engine tokenizer for the Query lab (`rrflow/editor.ts`, `rrflowql.ts`); the inherited views' editor still uses the inherited grammar | **decision needed**: one editor language, not two. The formatter and statement splitting are not on `main`'s language |
| `rrflow/ui`: `Icon`, `Spacer`, `CodeBlock`, `Markdown`, theme, about 130 icons, pictograms | Slice C1/C2 landed as the exact-diff commit `ce08e2f6e`; `main` has its own icons and pictograms | **not yet compared**: a safe `Markdown` component is not found on `main`; read before deciding |
| Behaviour tests (19 then 28), native-client script, ui tests | only the knowledge tests are carried | **pending** with their modules |
| `docs/rrflow-native-rewrite.md` | absent | pending; carries the verification record |
| 212 cloud, assistant and support files it rewrote | deleted on `main` (cloud strip, below) | path-level only |

## `agent/rrflow-serve-spine` (tip `a964caf4`): absorbed

Slice A of sprint 008. Read in full: the commit, `vite.config.ts`, `env.d.ts`, About tab, toolbar, `package.json`, and the 265-line sprint document.

| Behaviour on the branch | Where it lives on `main` |
|---|---|
| Contract pin moved off the stale revision | `src-tauri/Cargo.toml` pins `b099b5bc`, well past the branch's `4705941` |
| the inherited `engineProtocol` manifest field removed | absent from `package.json` |
| `vite.config.ts` reads the one pin from `Cargo.lock` and fails the build if it stops being one revision | `pinnedEngine()` in `vite.config.ts` |
| Engine version and revision defined for the UI | `RRFLOW_ENGINE_VERSION` and `RRFLOW_ENGINE_REVISION` in `env.d.ts` and `vite.config.ts` |
| About shows the real RRD protocol and engine revision | About rows "RRD protocol" and "RRFlow engine" |
| Toolbar minimum-version badge uses the engine version | `toolbar.tsx` |
| Sprint journal | all 214 non-empty lines are in `main`'s 409-line version |

## `agent/rrflow-serve-spine-b` (tips `d6df71f8`, `51110ed1`): absorbed

Slice B and a small error-display fix. Read in full: both commits, the 468-line `estate.rs`, and the settings, adapter and store changes.

| Behaviour on the branch | Where it lives on `main` |
|---|---|
| Real RRD error shown instead of "Unknown RRD connection error" (`describeRrdError`) | `src/rrflow/runtime.ts`: same function; the string is its intended fallback, not the defect. `nativePublicFetch` wraps the native rejection with it. The serving UI (`projects.tsx`) shows it as "Project operation failed" |
| `install plan`, `install apply --expect <digest>` when there is no locator | `estate.rs` `install()` |
| `--json serve --bind 127.0.0.1:0 --project`, one announcement line | `estate.rs` `serve_with()` |
| `ready` polling until the estate authenticates, 180 s limit | `estate.rs` (`READY_TIMEOUT`, `READY_POLL`) |
| `estate:stage` and `estate:output` events | `estate.rs`; listened to in `adapter/desktop.tsx` |
| Only the child this process started is stopped; stopped on exit | `estate/lifecycle.rs`, `OwnedProcess` drop, `stop_on_exit` |
| Served estate becomes the runtime connection, one per operator credential, updated with the announced address | `components/ActionBar/served-connection.ts` |
| Legacy inherited-database launch lane removed | `src-tauri/src/database/` is absent; no `start_database` |
| Settings reduced to project, mode, executable, history | `ConnectomeServingSettings` in `shared/types.tsx`, and the Serving settings tab (same four fields) |
| Process tests drive the product's `serve_estate` | `rrd/client/process.rs` |
| Plain-words stage text | 23 of 25 explanation strings verbatim; the other two are the same errors worded slightly differently |
| Sprint journal | 265 of 265 lines present |

`main` extends this with a project preview, an identity check and a multi-project registry (up to 4 owned, 8 tracked).

## `agent/rrflow-serve-spine-c` (tip `a83acc8a`): absorbed

Slice C. Read in full: the commit, `runtime.ts`, `package.json`, and the dependency-authority script.

| Behaviour on the branch | Where it lives on `main` |
|---|---|
| Generated TypeScript SDK as a dependency, pinned to the same revision as the crates | `@rrflow/rrd-client` in `package.json` at `b099b5bc` |
| Gate requires the npm pin and the Cargo pin to name one revision | `check-dependency-authority.mjs`: `sdkRevision`, `pinViolations` |
| Handshake types come from the SDK, hand-mirrored parsers deleted | `runtime.ts`: `SuccessPayload<...>` types; none of the old parsers remain |
| Desktop transport is the native `rrd_public_request`, the browser uses the page's `fetch` as a free function | `nativePublicFetch` and `browserFetch` |
| ArkType 2.2.8 | `package.json` |
| Sprint journal | 305 of 305 lines present |

## `agent/rrflow-serve-spine-d` (tip `6ab1e963`): absorbed

Slice D. Read in full: the commit, `build-sidecar.mjs`, and the engine-binding lines in `estate.rs` and `process.rs`.

| Behaviour on the branch | Where it lives on `main` |
|---|---|
| Sidecar staged with a manifest of revision, target, file, size and SHA-256 | `build-sidecar.mjs` `stage()`; `main` adds provenance validation, atomic staging and rollback |
| `--from <binary>` and `--check` | same flags, plus `--verify-receipt` |
| Build embeds the digest and fails on a stale revision | `build.rs` (every line the branch added is present) |
| Resolution order: configured executable, verified sidecar, `PATH`; a mismatched sidecar is refused with no fallback | `rrd/engine.rs` is byte-identical |
| First serve stage reports path, source, digest and revision | `estate.rs` `engine_stage()` and `describe_engine()` |
| `EngineSource` and `EngineBinding` types | `shared/types.tsx` |
| Third process test through the verified sidecar | `the_bundled_engine_serves_as_the_verified_sidecar` |
| `pnpm tauri:bundle`, `engine:stage`, `engine:check` | `package.json` |
| README and CI | README updated for the canonical builder; CI on Node 24.22.0 |
| Sprint journal | 349 of 349 lines present |

## `agent/connectome-cloud-strip` (tip `b054cbbc`), `agent/connectome-icons` (tip `b522202a`), `agent/connectome-ownership` (tip `6acb8d05`): exact diffs are on `main`

For each, the branch commit's patch-id equals a commit in `main`'s history, so its exact diff was applied:

| Branch commit | Same diff on `main` as |
|---|---|
| `b054cbbc` Delete the inherited hosted-service surface | `1f34a3d4c` |
| `b522202a` Draw icons, pictograms and code blocks from Connectome's own modules | `ce08e2f6e` |
| `6acb8d05` Make Connectome Connectome's: home, license, notice, version contract, identity gate | `a3e00eecf` |

This proves the commit was applied; it does not prove later `main` work kept every effect. That is checked by the gates (identity, isolation, architecture) which pass on `main`.

## `codex/task-assessments` (tip `52c3a5eb`): nothing to carry

One empty commit with no message body ("Open explicit assessment UI integration"). Its tree equals its parent `e74f2ef1`, which is on `main`.

## `agent/connectome-rrd-only` (tip `58a3aeae`): superseded by owner decisions, one idea to keep

A work-in-progress "not for review until D1's checks pass" that implements sprint 009 **decision 16** (fold, then delete, no stand-in): 52,146 deletions across 227 files, including 58 components `main` still uses. The owner rejected that approach on 2026-10-27 (**decision 18**: "I do not want you excluding … code but getting it authored properly"; re-author in place) and decision 17 forbids any visual regression. So its deletions are **not** absorbed, by your own direction.

Read in full: the commit message, sprint 009 decisions 16 to 18, and every line the branch added. What it added:

| Added by the branch | State |
|---|---|
| A connection model that names an RRD target and endpoint (`target`, `endpoint`, `runtimeInstance`, `runtimeCredential`, `controlToken`) instead of the inherited authentication-shaped profile that `main` still uses | **pending**: belongs to the view re-authoring; carry the model, not the migrator |
| A version-3 configuration migrator that keeps only RRD profiles and drops all others | **not carried**: it is migration code, which pre-release forbids, and it deletes saved profiles |
| A move of `RelationGraph/drawing.tsx` | a pure rename; nothing to carry |
| A simplified toolbar and route table | tied to the deletions; not carried |

## Open items for the owner

1. **One rrflowQL editor language.** `main` has two lineages: an engine-tokenizer language for the Query lab, and the inherited grammar for the inherited views. The branch adds a third (presentation scanner, formatter, statement splitting). Which is canonical?
2. **The pre-area address translations** kept in `layout.tsx` (`tasks`, `plan`, `api`, `workbench`, `knowledge/storage`) are pinned by the smoke suite but are compatibility under the pre-release rule. Keep or retire?
3. **Grouping.** Areas are folders, so regrouping the views is moving files. The August Workbench grouped them as a primary set, "Visual labs" and "Developer tools"; PR #67 uses Knowledge, Reasoning, Labs, Engine, Activity and System.
4. **Branch deletion** once everything above is carried: which of the 11 branches to delete, since each deletion is hard to undo.

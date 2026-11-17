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

## `agent/rrflow-native-connectome` (tip `8a9eb5e5`, base 2026-10-16)

Design record: its own `docs/rrflow-native-rewrite.md`, read in full.

| Capability on the branch | On `main` | State |
|---|---|---|
| Knowledge-tree bridge, project/instance/capability binding (`rrd/client/knowledge.rs`) | Absent before PR #68 | Read; ported in PR #68; `cargo test knowledge` 2 passed |
| Knowledge model: three-way draft rebase by immutable id, conflict retention, cycle/orphan repair (`src/rrflow/knowledge.ts`) | Absent before PR #68 | Read; ported in PR #68; 9 tests pass |
| Knowledge editor tab (`RuntimeConnection/tabs/knowledge.tsx`, 1,358 lines) | Absent | Read for its role only; **port pending** after PR #67 (routes move) |
| SSH-forwarded existing profile (`rrd/ssh_forward.rs`, 460 lines, 5 tests; `runtimeSshHost` in the connection form, serving action and runtime client) | Absent | Rust module read in full; **port pending** after PR #67 |
| Authored native client, values, editor (`src/rrflow/client`, `editor`, `ui`) replacing the inherited client, editor and icon packages | `main` still carries the inherited wrappers (`src/vendor/rrflow-client.ts`, `src/vendor/rrflowql-editor.ts`, `rrflowql/v2.tsx`, `rrflowql/v3.tsx`) by its own header comments, used by 20+ components | Wrappers read; the authored replacements are **not yet read file by file**. They move with the view re-authoring (sprint 009 Slice D), not before |
| 19 and 28 behaviour tests, editor and UI tests | Not compared | **Not read** |
| 212 cloud, assistant and support files it rewrote | Deleted on `main` (cloud strip) | Path-level only; **not read** |

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

## Branches not yet read

These carry a status from a patch-id or path check only, which is **not** an absorption claim. Each gets its own row after it is read.

| Branch | Tip | Check done | Claim |
|---|---|---|---|
| `agent/connectome-cloud-strip` | `b054cbbc` | patch-id present on `main` | none |
| `agent/connectome-icons` | `b522202a` | patch-id present on `main` | none |
| `agent/connectome-ownership` | `6acb8d05` | patch-id present on `main` | none |
| `agent/connectome-rrd-only` | `58a3aeae` | patch-id not found; deletes 58 components `main` still has | none; a work in progress that conflicts with the restored August views until read |
| `codex/task-assessments` | `52c3a5eb` | patch-id present on `main` | none |

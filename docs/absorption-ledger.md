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

## `agent/rrflow-native-connectome` (tip `8a9eb5e5`, base 2026-10-16): code carried or decided; intent not met, now a requirement

The table below answers whether the branch's code is on `main`. It does not answer whether `main` does what the branch set out to do, and it does not: Connectome still runs its inherited views on the inherited client. That intent is owned by [the native client requirement](native-client-requirement.md), which a check measures from the tree. An earlier version of this ledger called the branch absorbed on the code comparison alone; that was wrong.

Design record read in full (`docs/rrflow-native-rewrite.md`), plus `knowledge.rs`, `knowledge.ts`, `ssh_forward.rs`, `editor/lexical.ts`, `editor/parser.ts`, `editor/index.ts`, the export lists of `client/values.ts`, `shared/util/rrflowql/native.ts` and `rrflow/ui/index.tsx`, and the rewrite's tests list. Sprint 009 decision 14 says this branch was "salvaged": its lexer and parser, dependency gate and knowledge-tree work were to be rebuilt on `main` "with credit". The dependency gate is on `main`. The rest is as below.

| Item on the branch | On `main` | State |
|---|---|---|
| Knowledge-tree bridge (`rrd/client/knowledge.rs`, tests) | absent before PR #68 | carried by PR #68; `cargo test knowledge` 2 passed |
| Knowledge model: three-way draft rebase by immutable id, conflicts kept, cycle and orphan repair (`knowledge.ts`, 9 tests) | absent before PR #68 | carried by PR #68 |
| Knowledge editor tab (`tabs/knowledge.tsx`, 1,358 lines) | `src/features/runtime/knowledge-paths/` | carried as the project knowledge paths view, split into files that fit the architecture gate |
| SSH-forwarded existing profile (`ssh_forward.rs` 460 lines, 5 tests; `runtimeSshHost`) | `src-tauri/src/rrd/ssh_forward.rs` (identical), `runtimeSshHost` in the connection form, connections view and project layout | carried |
| Authored value classes and helpers: `Table`, `RecordId`, `Decimal`, `Duration`, `Uuid`, `DateTime`, `FileRef`, geometry types, `escapeIdent`, `equals` (`client/values.ts`, 276 lines) | `src/rrflow/model.ts` (`reference`, `parseReferenceKey`, `value.decimal`, canonical ids), checked by `scripts/check-value-model.mjs` against the engine's own values | **not carried, on purpose** (read symbol by symbol, 2026-11-18): the branch classes accept kinds and ids the engine refuses, and model durations, datetimes, file references and geometry, none of which the engine's query values have. `main`'s model is the contract's own types. The inherited classes stay behind the seam for the inherited views until those views are native |
| `NativeRRFlowQL` (`shared/util/rrflowql/native.ts`, `values.ts`) | `createRRFlowQL` still picks the inherited V2 or V3 implementation | **not carried**: nothing on `main` could call it. Every consumer reaches the contract through `getRRFlowQL()` in `src/connection/connection.tsx`, which RRFlow entries may not import. It belongs with the native query studio (see [the parity record](inherited-capability-parity.md)) |
| rrflowQL presentation editor: scanner, statement ranges, formatter, parameter discovery, Lezer parser (`editor/lexical.ts`, `parser.ts`) | one language, `src/editor/rrflowql` (owner decision) | superseded, with two things the branch had and `main` lacked. **Fixed here:** the top node did not name the language's data, so completions registered on the language never reached the editor (`scripts/check-rrflowql-language.mjs`). **Still open:** the inherited query view's run-selection and select-current-query act on the whole document, because the one language has no statement ranges; the branch's splitter is not the engine's, so this needs a decision |
| `rrflow/ui`: `Icon`, `Spacer`, `CodeBlock`, `Markdown`, theme, about 130 icons, pictograms | `main` has its own icons, pictograms, `Icon` and `CodeBlock` | compared 2026-11-18. Icons, pictograms and `Icon`: on `main`. `CodeBlock`: partial, `main` colours rrflowQL and JSON only where the branch coloured 24 languages. `Markdown`: **not carried, decision needed**: it adds two dependencies and renders remote images, and the app has no content security policy to bound what rendered text may fetch |
| Behaviour tests (19 then 28), native-client script, ui tests | knowledge tests; `scripts/test-query-presentation.mjs`; `scripts/test-dependency-authority.mjs`; the real-engine denial test | carried where their module is. The Windows-only script is not carried: `main` drives the real engine from Rust tests in CI. Its two assertions `main` lacked (another instance's name and a forged credential are refused) are now `a_wrong_instance_and_a_wrong_credential_are_refused` |
| `docs/rrflow-native-rewrite.md` | `docs/evidence/change-journals/rrflow-native-rewrite-2026-10-18.md` | carried as a historical record, body unchanged |
| Query result as a table keyed by identity (`client/query-presentation.ts`, 81 lines, 4 tests) | absent before this change | carried verbatim and used by the Query lab's rows: a cell is the row's own value, so a column a row lacks is empty instead of a property every object inherits |
| Dependency ownership gate with adversarial tests (`check-rrflow-dependencies.mjs`) | `scripts/dependency-authority.mjs` and its runner | the gate was on `main`; the one family it did not refuse is added: a local path, link or workspace entry under the `@rrflow` scope, and an `@rrflow` path alias in `tsconfig.json` or `vite.config.ts`. The inherited dependencies may now only be counted down |
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

## `codex/task-assessments` (tip `52c3a5eb`): commit empty, the work was in its worktree, now absorbed

The commit is empty (its tree equals its parent `e74f2ef1`). An earlier version of this row concluded "nothing to carry"; that was wrong, because the branch's worktree held the uncommitted assessment UI. That work landed through pull request 82 (assess a file, `src/rrflow/tasks.ts`, `docs/task-assessments.md`). Checked 2026-11-18 by an independent read of the branch against `main`: absorbed.

## Final audit, 2026-11-18

Every remaining branch was read against `main` by capability, not ancestry, and each "absorbed" verdict was attacked by a second reader.

| Ref | Verdict |
|---|---|
| `agent/engine-pin-catalogue`, `agent/one-engine-view-20261111` | absorbed, verified |
| `agent/f4b-view-registry` | one gap: per-view instance lifecycle (`lifecycleState` in `src/rrflow/views.ts`, applied by `ViewGate`); carried by pull request 90. `planned` is not carried: a view exists only when its route file does |
| `origin/agent/connectome-rrd-only` | its method (delete with no stand-in) is superseded by decisions 17 and 18; its goal is not met and is owned by [the native client requirement](native-client-requirement.md), which also carries its connection model in full |
| `origin/agent/rrflow-native-connectome` | intent not met; owned by [the native client requirement](native-client-requirement.md). Code read in full on 2026-11-18. Carried: the query-result table, the dependency rules it had and `main` lacked, the denial assertions, the language-data fix and the design record. Not carried on purpose: the value classes and `NativeRRFlowQL`. Decisions open: `Markdown`, statement ranges, `CodeBlock` languages |

## The Copilot commit `fa8d769c` and its five check scripts, 2026-11-18

`fa8d769c` (the `connectome-merge-repaired` worktree) held five checks over the pre-restructure modules. Read against `main`:

| Script | State |
|---|---|
| `check-workbench-dataset` | carried, retargeted (pull request 87) |
| `check-workbench-event-actions`, `check-file-write` | carried (pull request 87) |
| `check-workbench-state` | carried as `scripts/check-workbench-state.mjs` against the pure `lanes/workbench-state.ts`, extracted from `lanes.tsx` for it; a mutation of three rules fails it |
| `check-workbench-template-interchange` | **owner decision open.** The old script held a lossless interchange: an import keeps every authored field and rejects a file that is not valid. `main` documents the opposite: an import is sanitised, unknown linked paths are dropped, invalid templates are skipped. The new check pins what `main` does; it does not choose between them |
| `check-workbench-template-transfer`, `check-workbench-event-browser` | **not carried.** Each drives the old `WorkbenchPanel` and transfer components in a bespoke Vite and Playwright harness. The behaviour (template transfer between profiles, a stale event stopping, the diagnostic buttons) needs smoke tests on the current components |

## Worktree audit, 2026-11-18

Seven worktrees held uncommitted work. Each was read against `main` by capability, line-ending noise set aside, and each "nothing missing" verdict was attacked by a second reader.

| Worktree | Result |
|---|---|
| `connectome-merge` (the unfinished 1,127-path reconcile merge) | nothing authored: both parents are on `main`; every capability maps to a `src/features` file. Its three real defects were fixed in pull request 87 |
| `connectome-assessments` | absorbed by pull request 82; the one unmatched helper, `configure_loopback_assessment_profile`, is dead code |
| `connectome-ci-gate` | 596 line-ending-only changes, nothing real |
| `connectome-review` | scratch capture scripts that `tests/visual/` already holds in better form |
| `connectome-remember-projects-20261106` | config write safety is on `main` (pull request 83). Guide wording that claimed the graph shows every record is corrected in pull request 91; the records tab already reports the engine totals and says when the graph is bounded |
| `connectome-visual-isolated-20261107` | all on `main` |
| `connectome-visual-runner-20261107` | three local capture scripts carried into `tests/visual/` (pull request 91, **not run against the current UI**). Two items are not carried: reading the all-model snapshot only on Overview (the project layout uses that query for the menu counts on every route, so it cannot be gated) and the `CONNECTOME_VISUAL_SANDBOX` data-directory override (its own comment says it is local and never to be committed) |

## `agent/connectome-rrd-only` (tip `58a3aeae`): method superseded by owner decisions; goal not met, now a requirement

The branch's goal, no inherited engine surface in Connectome, is the owner's decision 12 and is not met on `main`. It is owned by [the native client requirement](native-client-requirement.md), which quotes the connection model below in full so the branch holds nothing `main` lacks.

A work-in-progress "not for review until D1's checks pass" that implements sprint 009 **decision 16** (fold, then delete, no stand-in): 52,146 deletions across 227 files, including 58 components `main` still uses. The owner rejected that approach on 2026-10-27 (**decision 18**: "I do not want you excluding … code but getting it authored properly"; re-author in place) and decision 17 forbids any visual regression. So its deletions are **not** absorbed, by your own direction.

Read in full: the commit message, sprint 009 decisions 16 to 18, and every line the branch added. What it added:

| Added by the branch | State |
|---|---|
| A connection model that names an RRD target and endpoint (`target`, `endpoint`, `runtimeInstance`, `runtimeCredential`, `controlToken`) instead of the inherited authentication-shaped profile that `main` still uses | **owed**: recorded in full in [the native client requirement](native-client-requirement.md); carry the model, not the migrator |
| A version-3 configuration migrator that keeps only RRD profiles and drops all others | **not carried**: it is migration code, which pre-release forbids, and it deletes saved profiles |
| A move of `RelationGraph/drawing.tsx` | a pure rename; nothing to carry |
| A simplified toolbar and route table | tied to the deletions; not carried |

## The 31 branches git calls merged: read against `main`, oldest first

Git says these 31 branches are ancestors of `main`. That says their commits were
merged once, not that their work survives today: later commits can delete it,
and the August work was lost that way once already. Each row below was read
against the code on `main` on 2026-11-17.

Method per branch: take the diff the branch's own PR introduced, then for every
added file and every substantive edit find the counterpart on today's `main`,
read both, and record file and line. A name match alone is not proof; each row
says what was read and what was tested.

### 1. agent/layman-lenses-wip (PR #1, merge b388e48c, 2026-10-16/17) - VERIFIED

PR #1 changed 279 files: 23 added, 1 renamed, 255 modified.

### The 16 added lens files under `src/screens/connectome/pages/RuntimeConnection/`

Each was read old-versus-current. Every user-facing string and JSX text of
`records` (91) and `vectors` (102) was checked in the current file, ignoring
only import paths. Exported symbols of `vectors-tab.tsx` are identical to the
old file.

| Old file | Now | Verdict |
|---|---|---|
| format.ts, labels.ts | `features/runtime/utils/format.ts`, `graph/labels.ts` | byte-identical |
| stat.tsx, types.tsx, subgraph.ts, groups.ts, notice.tsx | `components/stat.tsx`, `types.tsx`, `graph/subgraph.ts`, `graph/groups.ts`, `components/notice.tsx` | carried; import paths, estate renamed engram; `RuntimeLens` gained "models"; `GraphScope` gained "clusters" |
| queries.ts | `api/queries.ts` | carried; added `quantizationsQuery` |
| session.tsx | `session/session.tsx` | carried; one global `SESSION_QUERY_KEY` became per-profile `sessionQueryKey(id)` |
| glossary.tsx | `components/glossary.tsx` | carried; added generation, turboquant, rerank, recall terms |
| pipeline.tsx | `storage/pipeline.tsx` | carried; wording tightened so it no longer claims durability it cannot know |
| physical.tsx | `storage/physical.tsx` | carried; added `only` filter and `ColdTier` panel |
| graph.tsx | `graph/graph.tsx` | carried; added in-place live layout (`layoutKey`, `reconcileGraph`) and changed-node highlight |
| tabs/storage.tsx | `storage/storage-tab.tsx` | carried; "Audit through" stat dropped, which PR #1's own later commit cc90ce99 did |
| tabs/records.tsx | `records/records-tab.tsx` | carried; plain Textarea replaced by the single rrflowQL `QueryEditor` (Ctrl/Cmd+Enter run kept; monospace comes from `CodeEditor` style.module.scss:11,92); two-column Grid replaced by responsive layout |
| tabs/vectors.tsx | `vectors/vectors-tab.tsx` | carried; "Selected record" panel became shared `InspectorPanel`/`InspectorObject` and keeps Clear and "Show its relations" |

### Surviving files PR #1 changed in substance

- `src-tauri/src/rrd/client.rs` (1,559 changed lines): all 73 PR-#1 function/type
  names exist under `src-tauri/src/rrd/` (now 35 files). All 23 Rust tests from
  PR #1 exist by name among the 69 on `main`, including
  `application_windows_match_the_capability_window_pattern`.
- `src-tauri/src/window.rs`: `WINDOW_LABEL_PREFIX` at line 24 and its test.
- `src/components/RelationGraph/drawing.tsx`: `drawHover`, `drawLabel` as functions (lines 10, 55).
- `tests/smoke/connectome.spec.ts`: both PR-#1 tests by title; the file now has 19.
- `src/rrflow/runtime.ts`: hand-written `parseEnvelope`, `parseCapabilities`,
  `parseLiveness`, `parseReadiness` were replaced by the generated
  `@rrflow/rrd-client` SDK (spine-c); NOT independently tested here, the SDK's
  validation is taken from its own contract (open item).
  `validateRuntimeOrigin` is carried one-for-one in native `rrd_origin`
  (`src-tauri/src/rrd/transport.rs:15-34`).
- Import renames only (the icon package's name changed twice before the current one): `datatypes.tsx`, `drawer.tsx`, settings and modal files.

### Not covered by this branch's own capability

189 paths PR #1 touched are absent today (139 under `src/screens`, 20 under
`src/components`, 10 each under `src/shell` and `src/cloud`, and a few others;
checked with MSYS path conversion off, which an earlier run lacked and so
miscounted 3 dot-prefixed paths). PR #1's edits
to them were mechanical renames. They were removed by later branches
(`connectome-cloud-strip`, `connectome-rrd-only`). Whether the inherited
views were re-authored is tracked under the inherited-views item,
not here.

### Open from this branch

1. SDK response validation replaced hand parsers: read and test the SDK contract.
2. `src-tauri/src/rrd/estate.rs` still carries the retired name "estate" (rename debt).

### 2. agent/rrd-engine-lenses and agent/layman-lenses-wip - SAME PR AS 1

`layman-lenses-wip` tip bb43fe7b is an ancestor of `rrd-engine-lenses`, which
is the tip merged by b388e48c (PR #1). Covered by row 1; nothing separate to
verify.

### 3. agent/public-rrflow-association (PR #11, merge 50f4b75b, 2026-10-19) - VERIFIED

Added `.agents/parking-lot/002-public-rrflow-association.md` and
`.agents/sprints/010-public-rrflow-association.md` (both on main), and edited
`README.md` and `GOVERNANCE.md`. Every added README/GOVERNANCE line was tested
against main: 20 identical, 2 reworded (the time-bound "after the
source-integration change lands" sentence, and the contract link that pointed
at a branch now points at `main`, README.md:70-80). Nothing dropped.

### 4. agent/turnkey-native-workbench (PR #12, merge 05899c9c, 2026-10-19) - VERIFIED, one item superseded by PR #13

Read the journal (`.agents/sprints/011-native-turnkey-workbench.md`) and checked
each claim in it on main:

| Capability | On main |
|---|---|
| Install needs the exact operator-accepted digest; regenerates the plan | `rrd/estate.rs:641-669` (`accepted_digest`, mismatch refused) |
| Preview creates no installed locator | `estate.rs:164 preview_estate`; test `native_preview_requires_exact_acceptance_and_reopens` at `rrd/client/process.rs:1036` |
| Real-process integration suite (4 ignored tests) | `process.rs` holds 27 tests on main |
| Engine helpers hide the Windows console | `estate.rs:278 creation_flags(0x08000000)` |
| NSIS banner references removed | `tauri.conf.json` nsis block holds only icon and template |
| Models lens | `features/runtime/models/models-tab.tsx`, 306 lines, same symbols, all 91 old texts present |
| Local-start card and DB/QL/KV learning guide | `features/overview/content/local.tsx`; every card and sentence present |
| `docs/native-workbench.md` | present |

Superseded: the button "Open local RRFlow" (open the single served estate)
became "Manage project engines". Verify against PR #13 (project workspaces).

### 5. agent/project-workspace (PR #13, merge 38142b77, 2026-10-23) - VERIFIED, notices deferred to PR #32

Read `.agents/sprints/012-project-workspaces.md` and `docs/project-workspace-research.md`
(both on main). 24 files; 18 exist at the same path, 6 were inherited-UI paths
now replaced by `src/features/runtime` and `src/routes/runtime/$id`.

| Capability | On main |
|---|---|
| Per-profile native sessions; no active-project fallback | 39 commands in `src-tauri/src/rrd.rs` take `profile: String` |
| Eight native sessions, ninth refused | test asserts "eight native sessions", `rrd/client/process.rs:1163` |
| Parallel isolated engines (A/B isolation test) | `project_registry_keeps_parallel_estates_and_sessions_isolated` present by name |
| Pending-start reservation, 4-engine cap, failure release | test renamed to `pending_start_capacity_and_failure_are_bounded`, `rrd/estate/lifecycle.rs:~1063`; all four original assertions kept at lines 1076/1081/1090; failure now kept as a visible `Failed` instance holding no engine (semantic evolution, not loss) |
| Project manager UI and served-connection projection | `components/ActionBar/projects.tsx`, `served-connection.ts` |
| Stage history capped at 128 | `stores/database.tsx:134 .slice(-128)` |
| CreateConnection waits for durable save, shows save error | `features/create-connection/index.tsx:102-117, 527-548` |
| Lenses grouped by area | superseded by route-folder areas (merged #67) |
| Research record | `docs/project-workspace-research.md` present |

Deferred: the "unavailable in this build" notice pages (Knowledge paths,
Learning controls, Provider setup and cloud sync, Session replay, Services)
were removed by PR #32 (63b7b997, "Put the project workspace in one window,
sprint 016 step 2"), not by the later 11-10 colocation commit. Their planned
capabilities exist only as design text in `docs/project-workspace-research.md`.
Row for #32 must state whether that removal was the sprint-016 decision.

### 6. agent/connectome-theme (PR #9, merge 942b76bf, 2026-10-24/25) - VERIFIED

Own brand replacing the inherited product's. Deletions in this PR were its own
intent (inherited logos, referral artwork, fonts, GitHub images, NSIS bitmaps,
`hooks/brand.ts`). Additions checked on main: `components/Wordmark` (used in
`features/overview/index.tsx:109`, `features/query/MiniView:110`,
`shell/.../settings/index.tsx:147`), `shared/assets/styles/theme.scss` (imported
by `startup/connectome.tsx:13` and `mini-embed.tsx:9`),
`shared/assets/brand/app-icon.svg`, `scripts/brand/render-installer-art.mjs`
(manual, documented in its header), all regenerated `src-tauri/icons/*`,
`public/favicon.ico`, CODEOWNERS, CHANGELOG, sprint 009 doc. 21 touched
inherited-UI paths are absent (editor/base, editor/icons, Mantine util,
preloader, three views); they were removed by later branches.
Colour values were replaced by PR #38 (teal/orange); see its row.

### 7. ci/merge-queue-gate (PR #14, merge b07dd4cd, 2026-10-24/25) - VERIFIED

`.github/workflows/connectome-ci.yml` on main has `merge_group:` (line 7) and
the single `ci-gate` job (line 250) with `needs:` the three jobs. The diff in
the PR looks total only because of a line-ending flip.

### 8. docs/sprint-009-rrflow-conversion (PR #15, merge 83804c31, 2026-10-24/25) - VERIFIED, content revised

Added 164 lines to `.agents/sprints/009-connectome-ownership.md` (now 1,813
lines). Of 149 non-empty added lines, 104 are verbatim on main and 45 are
rewritten, every one located: the view-to-RRFlow mapping table rows
(lines 352-367 and 534) now carry revised wording, and plan steps D1-D8 were
replaced by V0-V7 under recorded decisions 17 ("nothing is deleted before its
RRFlow lens exists", line 829) and 18 (re-author in place). No row was lost.

### 9. agent/slice-d0-rrflow-isolation (PR #16, merge 169e624c, 2026-10-25) - VERIFIED

`scripts/check-rrflow-isolation.mjs` present and still in the `pnpm check`
chain (`package.json`). All 46 lines PR #16 added to `CodeBlock/index.tsx` are
unchanged on main (code blocks stay filled while the language loads). Changed
imports in `CodeEditor`, `editor/index.tsx`, `toolbar.tsx`, `adapter/mini.tsx`
point at files that moved (`editor/core/*`, `editor/languages/*`,
`features/*`). `query-keymaps.tsx` moved to `editor/core/query-keymaps.tsx`;
`runQueryKeymap` (Mod-Enter, Mod-e) is used by `features/query/QueryPane:211`
and `VariablesPane:85`; the GraphQL keymaps are used by
`features/graphql/QueryPane:163` and `editor/languages/graphql.tsx:98`.

### 10. agent/slice-v0-visual-baseline (PR #17, merge 62b46094, 2026-10-26) - VERIFIED (files); parity UNMET

All 182 files PR #17 added exist on main (tests/visual README, PARITY.md,
172 inherited-screen captures in both themes). Main holds 598 baseline images
now. `tests/visual/PARITY.md` (308 lines) is the owner-approved checklist: 66
items, 0 ticked. Its Sprint 016 section records the August Workbench views by
screen. The checklist itself is the work list for the parity audit, which is
a separate deliverable from this ledger.

#### Correction to row 1 (PR #1)

Rename detection (`git diff -M40%` PR#1 tree to main) splits the 189 absent
paths into 88 moved to another path and 101 deleted outright. Deleted: about
85 are the inherited hosted-service surface (cloud, billing, organizations,
support, referral, Sidekick assistant, newsfeed), removed by
`connectome-cloud-strip` (owner decision); 34 `pages` and 27 `views` include the
`dashboard` view (BackupsBlock, ConfiguratorDrawer, ConnectBlock, UpdateBlock,
UpgradeDrawer) and the `monitor` view (LogPane, MetricPane, MonitorsPane).
Overview and RuntimeConnection `index.tsx` were re-authored under `features/`.

### Running gap list (confirmed on main, not yet decided)

G1. No backup / restore / export / import UI on main (inherited
    BackupsBlock/BackupsDrawer and the data export/import modals were
    deleted or not found; PARITY row `modal-export-database`,
    `modal-import-database`; plan D7).
G2. No metrics/log monitoring view (inherited `monitor/LogPane`, `MetricPane`,
    `MonitorsPane`); `features/diagnostics` is connection diagnostics, not an
    equivalent. Owner's monitoring/hop-tracing requirement is open.
G3. Activity returns in sprint 016 step 6 and Knowledge paths in step 8; the
    Learning, Services, Provider setup and Session replay notices were removed
    by PR #32 per decision 20; the capabilities themselves are unbuilt.
G4. SDK response validation replaced hand parsers (PR #1) - SDK contract not
    independently tested.

Method for rows 11-17, used for every code-bearing PR from here on: (a) every
file the PR touched, present or absent on main; (b) every test the PR added, by
name, in Rust (`#[test]`/`#[tokio::test]`) and JS; (c) for every code file, the
share of the PR's added non-blank lines still verbatim on main, and every line
that is not read by hand.

### 11. agent/slice-d1a-api-reference (PR #18, merge d706d360) - VERIFIED

Files: 24, all present or moved (`RuntimeConnection/api/*` to
`features/runtime/api-reference/{index.tsx,examples.ts}`: 53 and 82 old texts,
0 missing). `scripts/check-api-examples.mjs` present. 3 Rust tests present:
`test_builds_never_resolve_a_user_data_directory`,
`every_allowed_public_path_is_a_public_read_only_engine_operation`,
`segment_handles_and_admission_state_are_every_counter_the_engine_reports`.

### 12. agent/sprint-009-reauthor-plan (PR #19, merge ed22da0c) - VERIFIED (document revised later)

156 added lines in sprint 009 and `screens/GOVERNANCE.md`: 145 verbatim; 11
reworded and located (F3 at line 423, S1 at 487, V1 at 496, editor-language
row). Decision 18 text present. V5 (Storage) at line 508 names backup and
restore as planned (see gap G1).

### 13. agent/f1a-native-effects (PR #20, merge 6e79b7c4) - VERIFIED

15 files all present; 10 Rust tests all present by name; 2,593 of 2,610 added
lines verbatim. The 17 others read: import-list reflow, comment updates, and
`outcome_unknown` (commit whose outcome cannot be confirmed stays pending and
retryable) which is still at `rrd/client/transaction.rs:65`, used at lines 213
and 261.

### 14. agent/f1b-live-results (PR #21, merge 2db8020e) - VERIFIED

12 files present; 6 Rust tests present; 1,338 of 1,357 added lines verbatim;
the 19 others are import reflow, comments and a refactored head-cursor read.

### 15. agent/f2-value-model (PR #22, merge 5ba5a9d5) - VERIFIED

7 files present; the Rust test present; 704 of 715 verbatim. Others: engine pin
advanced in `engine-values.json`, and the `pinned_revision()` Rust guard was
replaced by `scripts/check-value-model.mjs:23`
(`assert.equal(golden.engine, pinned)`); fixtures on main carry
b099b5bc641b9fe230d0598230a1933ac1b17c14, equal to the `Cargo.lock` pin.

### 16. agent/f3-rrflowql-language (PR #23, merge 07c4d14b) - VERIFIED (language now being replaced by PR #73)

20 files; 5 Rust tests present; 1,730 of 1,732 verbatim. `records.tsx` console
editor, refusal marking, and `.queryEditor` style are on main
(`features/runtime/records/records-tab.tsx`, `style.module.scss:104`).
`check-rrflowql.mjs:24` asserts golden queries equal the pinned engine.
Connectome PR #73 (open) replaces this language with the one editor.

### 17. agent/f4a-instance-lifecycle (PR #24, merge 999c144a) - VERIFIED

22 files; 5 Rust tests present; 2,133 of 2,149 verbatim. Others: SDK pin
advance, `types.tsx` types moved to `shared/types.tsx:411-432`
(`EstateStageName`, `InstanceState`, `InstanceOrigin`, `ProjectInstance`,
`InstanceStatus`), reflowed imports.

### 18. agent/t1-turboquant-vectors (PR #25, merge d90c947d) - VERIFIED

24 files; 5 Rust tests present; 1,522 of 1,528 added lines verbatim.
`quantization.tsx` is `features/runtime/vectors/quantization-tab.tsx`
(1,253 lines both, 161 of 161 texts), `vectors.tsx` 999 to 999 lines (108 texts,
only the `compact-xs` prop differs), glossary (only the estate rename),
`queries.ts` 44 to 44 lines.

### 19. agent/controller-proposals (PR #26, merge 423a13cb) - VERIFIED

33 files; 1 Rust test; 1,830 of 1,846 verbatim. `tasks.tsx` is
`features/runtime/tasks/tasks.tsx`. Changed lines read: reflowed imports and a
time-bound status paragraph in `docs/native-workbench.md`.

### 20. codex/controller-startup-mapping (PR #27, merge c1cbff20) - VERIFIED

31 files; 3 Rust tests present; 667 of 667 added lines verbatim.

### 21. codex/worker-handoff (PR #28, merge 1032dd05) - VERIFIED

64 files; 1 Rust test; 2,811 of 2,826 verbatim. Changed: docs status wording
(time-bound), `prepare_worker` action present at `rrflow/tasks.ts:161`.

### 22. codex/task-budget-resume (PR #29, merge f4623071) - VERIFIED

64 files; 2,591 of 2,596 verbatim. `tasks.ts` now has `"stop" | "resume"`
(line 151). `tasks.tsx` 748 to 993 lines; 119 old texts, 2 reworded by later
source-selection work ("Review selected worker" now "Review worker and
selected source" at line 881; the policy sentence now says the selected source
is sent only when shown, and keeps "Files are not changed").

### 23. codex/attunement-controls (PR #30, merge ae73c3c3) - VERIFIED

36 files; 4 Rust tests present; 2,337 of 2,340 verbatim; the 3 differing lines
are the replan variant now boxed (`attunement.rs:99`). `plan.tsx` is
`features/runtime/plan/plan.tsx`, 481 lines both, 65 of 65 texts. The
hard-coded `areas.ts` table was replaced by route folders (merged #67).

### 24. agent/guided-workspace-preserve (PR #31, merge 1cf5d9ec) - VERIFIED

254 files (249 added, 5 modified) all present: the preserved August Workbench
reference and window captures, `.agents/sprints/016-guided-workspace.md`,
`.agents/parking-lot/006`, PARITY.md. 3,446 of 3,456 added lines verbatim; the
10 others are plan wording (window pane description, a PARITY item reworded).

### 25. agent/guided-workspace-window (PR #32, merge 1eb60184) - VERIFIED; notice removal authorized by decision 20

63 files; the shell is `features/runtime/shell/shell.tsx` (12 old texts, 1
reworded). `areas.ts`/`workspace.tsx` replaced by route-folder areas (merged
#67). The notice pages removed here (Activity, Learning, Services, Knowledge
paths) follow Sprint 009 decision 20, the owner's 2026-10-28 words: "A notice
that a view is missing is not a view". Decision 20 owes three real views:
project knowledge paths, editable rrflowQL graph results, and plan and
handoff records with the schemas they produce (see gaps G3, G5).

### 26. agent/guided-workspace-inspector (PR #33, merge de7cdeba) - VERIFIED

18 files; 50 of 50 added lines verbatim; `inspector.tsx` is
`features/runtime/components/inspector.tsx`, 140 lines both, 16 of 16 texts.

### 27. agent/guided-workspace-guides (PR #34, merge 998c058f) - VERIFIED

29 files; `guides/{cards,engine}.tsx` 67 and 343 lines both, all texts present;
`explore-graph.v1.json` identical after line-ending normalisation (md5
9c8422a2dda3 both); `scripts/check-guides.mjs` now validates guide routes
against the route files (`check-guides.mjs:36-66`). 219 of 232 added lines
verbatim; others are path updates in capture scripts and plan wording.

### 28. agent/guided-workspace-plan (PR #36, merge 84a52496) - VERIFIED

Documents only (sprint 016, parking lots 006/007, PARITY). 375 of 396 added
lines verbatim; the 21 others are "PROPOSED/OPEN" status lines changed once the
owner decided, and plan-table rows reworked.

### 29. agent/teal-orange-tokens (PR #38, merge 95ba9975) - VERIFIED

Tokens on main `theme.scss`: gradient `#0f5c63` to `#cc5500` (lines 8-9), paper
`rgb(14 30 34 / .94)`, orange glow. The theme defines `rrflow` and also
`violet: [...RRFLOW]` (`shared/util/ui/mantine.tsx:143`), so the 79 remaining
uses of the name `violet` in 44 files render burnt orange. Naming debt only:
rename `violet` references to `rrflow` when each view is re-authored.

### Summary of the 31 branches git called merged

All 31 are now accounted for: they sit in 29 distinct PRs (`layman-lenses-wip`
and `rrd-engine-lenses` are one PR). For every PR: files by presence, tests by
name, added lines by verbatim survival, every non-verbatim line read, and
moved files compared by text coverage. No PR-added behaviour was found
missing from main. What the verification does not prove: behaviour at run
time (the tests were located, not executed here) and anything git history did
not record.

### Deleted branches and their tips (2026-11-17)

Each tip is an ancestor of `main` and had no open pull request when its branch was deleted. Recover one with `git branch <name> <tip>`.

| Branch | Tip |
|---|---|
| `agent/connectome-theme` | `52e96610d6eb3af1c16b82bf6053e5d0dcebaa4c` |
| `agent/controller-proposals` | `01a83431b38c528c265121c0e1195a2181c6fb2b` |
| `agent/f1a-native-effects` | `b9963eea2af3f83a5420c845da7fe2b3654bef6d` |
| `agent/f1b-live-results` | `fd8f2daf7f6db01184093076f139b4a50e03e020` |
| `agent/f2-value-model` | `179d32e5079c95ce812c30816f439d7345bacc5d` |
| `agent/f3-rrflowql-language` | `2670b09b664496af6956611cd1438fdff5eafa57` |
| `agent/f4a-instance-lifecycle` | `186df9d275bfcd0710ea309fef1025b5545bc168` |
| `agent/guided-workspace-guides` | `40eb9aaf53535011d606c6babab1a6ec71fec3bf` |
| `agent/guided-workspace-inspector` | `f6bb4326fb5b7de887c3b98e36992b6befce8a71` |
| `agent/guided-workspace-plan` | `3f4ea361226f9a0bba483527ada6b52d4944fdf0` |
| `agent/guided-workspace-preserve` | `3ac4f1100ae1b34852f31f18b13fc4cbe843192d` |
| `agent/guided-workspace-window` | `63b7b9973a9f2cbeb2559850d01fc4a4270173a5` |
| `agent/layman-lenses-wip` | `bb43fe7be8887ec2aa9653fa7e1b933a7993682e` |
| `agent/one-menu-restore-august-20261114` | `bb4f539cd87c7748e8203767cd6293eb1a6a31be` |
| `agent/project-workspace` | `0aca893cd5e52ca596483645de4972a61bb17ca0` |
| `agent/public-rrflow-association` | `d06acf929c13178677a4c045c76db62b96282fdb` |
| `agent/rrd-engine-lenses` | `eb2cd3ac56c375d70d77339056cff50ec36748d0` |
| `agent/slice-d0-rrflow-isolation` | `40fcc2d235b9b7b55cb7d4f64a5a051172f598eb` |
| `agent/slice-d1a-api-reference` | `2055ea28cc39ae73cead2975b471d37fa4c1c726` |
| `agent/slice-v0-visual-baseline` | `cc7558ad81aa8185908857c3e95e347d48801b2e` |
| `agent/sprint-009-reauthor-plan` | `076ca26e1d633ad71d29b4da9acbf71cf3cb20cc` |
| `agent/t1-turboquant-vectors` | `00f655c8aec0143ddb23a5bea019d660e42c25cc` |
| `agent/teal-orange-tokens` | `30c7803c219ec7c99e326455eed48ad5074d229a` |
| `agent/turnkey-native-workbench` | `03b716b4dfe5623e6c82408c6f4df367c9795388` |
| `ci/merge-queue-gate` | `a6cc3e5c2e58e80cfb8b2816685300d3ced966c9` |
| `codex/attunement-controls` | `7ea1aa869e50653e899c6109f85034a4556eb2c5` |
| `codex/controller-startup-mapping` | `722f9fac6697b6f9555b8a4a69011afcdadb2d76` |
| `codex/task-budget-resume` | `d46b3f7417f8292c84b8401f8686f8f4177150e4` |
| `codex/worker-handoff` | `0b31c2e6fd45648526ed6aec6bf6ce5372c671db` |
| `docs/sprint-009-rrflow-conversion` | `cd769940886384883335a0c193ad239c328f1786` |

### The last two old branches and their tips (2026-11-19)

Neither is an ancestor of `main`. Each is deleted once [the native client requirement](native-client-requirement.md) is on `main`, because that record then owns what the branch set out to do.

| Branch | Tip | Still readable as |
|---|---|---|
| `agent/rrflow-native-connectome` | `8a9eb5e52b8df91b888b75f6c98edabeb8d3199d` | pull request 10 (`refs/pull/10/head`) |
| `agent/connectome-rrd-only` | `58a3aeae55aa499c7e8e989891d1972de12837a8` | nothing on the remote; its one addition is quoted in the requirement |

### Local archive refs, 2026-11-19

Five refs under `refs/archive/20261114/` exist only in the owner's checkout; none is on the remote and none is an ancestor of `main`. Three hold branches read above (`agent/engine-pin-catalogue`, `agent/one-engine-view-20261111`, `agent/f4b-view-registry`). Two were never named in this ledger:

| Ref | What it set out to do | On `main` |
|---|---|---|
| `branch/agent/alarm-livefire-20261110` (tip `edd9b45a`, pull request 48, closed) | Prove the merge alarm fires, with a test made to fail on purpose; "not for merging" in its own words | met: the alarm has since opened and closed real `merge-blocked` issues (84, 88, 89, 93, 94). Its two lines are the deliberate failure and are not wanted |
| `head/main-folder` (tip `f7f48125`) | Rename the earlier word to engram in four files; an editor commit whose find and replace also broke names (`InstalledengramView`, and a message naming `usengram`) | met by pull request 96, which renamed the whole repository correctly and added the earlier-term gate |

## Open items for the owner

1. **One rrflowQL editor language.** `main` has two lineages: an engine-tokenizer language for the Query lab, and the inherited grammar for the inherited views. The branch adds a third (presentation scanner, formatter, statement splitting). Which is canonical?
2. **The pre-area address translations** kept in `layout.tsx` (`tasks`, `plan`, `api`, `workbench`, `knowledge/storage`) are pinned by the smoke suite but are compatibility under the pre-release rule. Keep or retire?
3. **Grouping.** Areas are folders, so regrouping the views is moving files. The August Workbench grouped them as a primary set, "Visual labs" and "Developer tools"; PR #67 uses Knowledge, Reasoning, Labs, Engine, Activity and System.
4. **Branch deletion.** Settled by the owner's direction of one branch of record per repository: the last two old branches go once the native client requirement is on `main` (tips above).
5. **Backup, restore, export and import UI is missing.** The inherited backups block, backups drawer and the data export and import dialogs are gone, and no RRFlow lens replaces them. PARITY lists them; plan step V5. Build, or retire?
6. **Metrics and log monitoring is missing.** The inherited monitor view (log, metric and monitors panes) was removed with the hosted-service surface and has no RRFlow equivalent; the connection-diagnostics view is not one. Your monitoring and hop-tracing requirement is open.
7. **Three real views decision 20 owes:** project knowledge paths (PR #68, open), editable rrflowQL graph results, and plan and handoff records with the schemas they produce. Learning, Services, Provider setup and Session replay are unbuilt.
8. **`tests/visual/PARITY.md` has 66 items, none ticked.** Its Connectome Workbench section lists the August views and nine defects not to carry over. A code-level audit against it has not been done; it is the next package.
9. **The SDK replaced the hand-written response parsers** (PR #1). The SDK's validation was not independently tested here.
10. **Naming debt:** `src-tauri/src/rrd/estate.rs`, and 79 uses of the name `violet` (the theme maps it to burnt orange) in 44 files.

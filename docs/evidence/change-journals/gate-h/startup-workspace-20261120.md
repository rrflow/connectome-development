# Restore workspace access at startup

Status: local acceptance passed; candidate and merge-queue validation pending. No capability-parity completion claim.
Owner: Gate H / H-06, native client requirement and no-loss visual requirement.
Baseline: `7cbe1f10b248e6477dc2c5b46581a639a6337344`.
Driver: this RRFlow recovery session. Parent engine PR440 remains draft.

## Change brief

The existing sidebar asks `useConnectionAndView` for an inherited connection;
that hook explicitly excludes runtime profiles. Consequently the native app
shows only Overview and Mini outside a project's nested area rail. The original
workbench, query, schema, records and storage views exist but cannot be discovered
from startup. The home hero consumes space while engine management is a dialog.

Use the existing route catalogue for native navigation at startup and in a
project. Preserve every route and tab, the current views and their interactions.
Move the area rail to the application sidebar instead of rendering two rails.
Offer explicit project selection when no runtime project is selected; never
silently choose a project or start a process on navigation. Keep direct local
start and remote connection controls visible. Reduce the home hero and expose
actual local-engine counts without calling a saved profile connected.

Scope: `src/screens/connectome/{sidebar,project-navigation,index}.tsx`, existing
screen styles; `src/features/runtime/shell/shell.tsx`; overview presentation;
default sidebar preference; focused browser tests; this journal and index.
The route catalogue, native engine registry, session and public RRD operations
remain their existing owners. No mock data or client-side execution policy is
introduced. Cloud synchronization is missing and must not be labelled connected.

Read: sidebar and screen composition, complete project layout and view gate,
workspace shell, project-menu generation, routing hooks, native engine resolver,
preview/serve flow, project manager and row controls, installation summary,
overview/local card, navigation icon, existing styles, defaults, native client
requirement, parity checklist and existing smoke fixtures. Historical commits
`8a9eb5e5` and `58a3aeae` exist but dry-run merges conflict; branch ancestry is
not absorption proof. The inherited visual baseline `38142b7` is still tracked.

## Recovery order and boundaries

1. This package: visible tools and truthful local start, preserving existing views.
2. Recover query/explorer/designer interactions in their existing feature folders
   through the typed native client, with before/after visual and installed tests.
3. Assign missing engine operations to the contract catalogue and `rrd-engine`;
   no UI substitute for transactions, functions, access administration or sync.
4. Join task/controller execution to the prompt workbench and engine receipts;
   its observe flight currently records a prompt without running a model.
5. Qualify temporal recall, constraints/lexicon, storage and cloud synchronization
   against their owning gates. Do not erase gaps by renaming or hiding controls.

The current ledger classifies 134 capabilities as engine-present/UI-missing,
47 partial, 99 requiring engine work and 9 missing. These are audit inputs,
not an exhaustive current upstream database parity proof. Each recovered behavior
needs its original source, canonical destination, test oracle and remaining gap.

## Acceptance and stop conditions

Before/after: an empty startup exposes all route-derived areas and Workbench;
choosing a tool without a project asks for one without network effects; selecting
a saved project opens the exact view; existing project switching and all 33 smoke
journeys continue to pass. Verify desktop start/serve/readback independently;
browser fixtures prove navigation only. Run focused smoke, `pnpm check`, build,
full smoke, candidate and merge-group gates. Inspect desktop at normal and narrow
widths. Stop on lost route/action, cross-project state leakage or weakening of an
existing oracle. No native engine change is planned in this UI package.

Research: local code/history establishes this defect; no external API adaptation.
Resource: reuse existing isolated targets, four Cargo jobs, no cache deletion.
Trace: preserve actual failed startup/engine-selection evidence in parent POAM-093.

## Installed driver finding and scope refinement

The native UI installed `connectome-live-project`, served loopback port 42242,
authenticated and displayed live graph/vector/storage summaries. Its executable
was `connectome-target/debug/deps/rrflow.exe`, SHA-256 `fefdf228cc16999b1d3f0074700ec6b92318e590379f7865be9c2fecb013c365`.
Cargo prepends that directory to PATH. A process-test fixture left its private
copy there, so the parent launcher's PATH check before Cargo did not establish
what the UI selected. This explains parent POAM-093's second identity mismatch.

Before further edits, extend this PR's scope to the existing native engine
resolver (`src-tauri/src/rrd/engine.rs`): in development builds, accept an explicit
absolute `RRFLOW_DEV_ENGINE` from the parent launcher through the existing checked
explicit-executable boundary. Reject conflicting saved executable settings and
invalid/missing development binaries. Packaged sidecar verification is unchanged.
The parent script and its tests set and verify this variable in PR440. Prove the
resolver with focused tests, then verify actual desktop engine path and digest.
No stale fixture is deleted to make PATH appear correct. This is development
selection, not another runtime or migration path.


## Acceptance results and retained limits

Full changed-file and diff review covered the navigation, sidebar, workspace
shell, defaults, overview files, engine resolver, startup process driver and
both changed smoke files. The area catalogue remains the only route owner;
no existing route, tab or engine operation was removed. The old inner area
rail is replaced by the sidebar using that same catalogue.

Windows local results (Node 24.22.0, four Cargo jobs, separate existing targets):

- `pnpm check`: passed. The complete parity gate still reports 289 inherited
  capabilities not fully native and 66 unqualified visual comparisons.
- `pnpm build`: passed, 23.45 seconds.
- `pnpm test:smoke`: 35 passed, 1.6 minutes. The first run failed only the
  old home-title assertion; its native-disabled and learning-guide assertions
  were preserved, and the truthful availability assertion was added.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml
  development_selection_is_exact_and_rejects_conflicting_settings`: one passed.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml --all-targets`:
  88 passed; the 31 existing process tests were explicitly ignored.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml
  development_binding_drives_install_serve_and_authenticated_read -- --ignored
  --test-threads=1`: one passed, 12.72 seconds. A child test process receives
  the launcher's environment, leaves the saved executable empty, previews and
  installs a fresh project, starts the engine, verifies its exact canonical path
  and SHA-256, authenticates and reads the database, then stops the owned engine.
  This added process test joins the existing CI process suite.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml
  project_registry_keeps_parallel_engrams_and_sessions_isolated -- --ignored
  --test-threads=1`: one passed, 16.54 seconds, against the checkout debug engine.
- `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets
  -- -D warnings`: passed after the installed test was added.

The new installed tests used `target/dev-loop/rrflow.exe` in session scratch,
SHA-256 `bf7b95e06ba92eea62f6a97ffb1e021c6f466b4be54420eb902a882421be0a4d`.
Logs are `startup-{check-final,build-final,smoke-final,native-focused,native-suite,
installed-binding,project-isolation,native-clippy-final}.log` under
`D:/.usr/Temp/rrflow-selective-recall-audit-20261120`.

The prior visible desktop proved navigation and actual local installation, but
selected the test binary as described above. Computer Use was stopped by the
owner before the final explicit-binding UI journey. The process driver now
proves that binding through the same native preview/start/authenticated-read
boundary; it is not a final screenshot or visual-parity qualification. Parent
POAM-093 remains open for the full desktop acceptance and gate evidence. No
roadmap completion status changes. Cloud synchronization, project-link sharing,
VM/container enforcement and joined prompt/model execution are not supplied by
this package. The existing source-worker/controller driver belongs to PR107.

## Completed branch cleanup

PR107 merged as `7cbe1f10b248e6477dc2c5b46581a639a6337344` with successful
candidate checks. Its source tip `e6d54d42abb41f467d9bb475cdc0d36b76bab29b`
is the merge's second parent and has an identical complete tree (empty diff).
The local `feat/system-one-controller` branch was deleted after verifying its
bundle; GitHub had already deleted the remote branch. The unused local
`fix/startup-workspace-navigation` tip `eb31a718f73c3588fbdb210567d3d4aa518ae6de`
had no commits outside main and was also deleted. The verified backup bundle
is `connectome-merged-107.bundle` in session scratch. No old unmerged historical
implementation was deleted or declared absorbed by these checks.

# Project workspaces and parallel native engines

Owner: RRFlow OBJ-09 / Gate H-06 prerequisite, with existing D-01 installation
contracts. [PR13](https://github.com/rrflow/connectome-development/pull/13).
Starting revision: `05899c9c5dd5c98c61c16435d989e60381650f7a` (current main after
fetch; root's gitlink still pins `03b716b4dfe5623e6c82408c6f4df367c9795388`).
The isolated `agent/project-workspace` worktree preserves the parent/C-07 work.
No product version, engine/SDK pin, alpha outcome or roadmap gate changes status.

## Auditable change brief and traceability

- [x] Read the owning README/client/topology/learning contracts, inspect Git
  state and existing implementation before edits. The local PR brief records
  one bounded package, behavior, exact boundaries, acceptance and stop conditions.
- [x] GitHub needs a differing commit to create a PR. Research deliverable
  `98280a605990d903e08c3d1a5604ce88bc90ceb1` created that difference; the draft
  received its brief immediately before runtime/UI implementation. This is a
  sourced requested deliverable, not an empty planning-status commit.
- [x] Single native session -> bounded profile-keyed `RrdClientState`; every
  authenticated command requires its profile, with no active-project fallback.
  Single served estate -> `EstateState` registry of canonical directories with
  pending-start reservations, four-child admission, failure release, idempotent
  reopen, targeted stop and shutdown rejection. `OwnedProcess` reaps children
  even before an announcement/readiness failure can construct a served estate.
- [x] Existing lenses remain the data/graph/vector/storage owners. Project routes
  group them under Overview/Knowledge, with Activity/Learning/Services explaining
  unavailable contracts. Advanced identity is progressively disclosed; errors
  remain visible. The speculative attunement progress and estimates are removed.
- [x] The ActionBar serving export is preserved; `projects.tsx` owns the manager
  UI and `served-connection.ts` projects native coordinates into saved profiles.
  One manager lists/opens/stops owned projects; exact installation preview and
  digest acceptance remain required. Stage output names its project and retained
  stage history is capped at 128 entries.
- [x] Test-discovered scope extension: CreateConnection waits for persistence
  before navigating (rather than acknowledging a debounced save); missing-profile
  RuntimeConnection constructs its HTTP client only inside an enabled query.
  The PR brief records this exact extension and failure oracle.
- [x] Research decision: use primary published UX research and vendor operation
  documentation in `docs/project-workspace-research.md`; import no upstream code.
  Claims distinguish validated UX guidance, current product workflows and planned
  RRFlow capabilities. Comparative acceptance uses repeatable corpus/evaluation,
  source lineage, latency/resources/cost and recovery, not marketing claims.
- [x] Trace/resource/debug decision: preserve public read cursors, leases,
  bounded SDK operations and redacted native credentials; expose project-scoped
  status and stage output, not private model reasoning. Four engines/eight native
  sessions are admission limits, not aggregate resource reservation.
- [x] Stop conditions: no invented engine operations, training activation,
  provider entitlements, live hosted login, cloud sync or superiority claims.
  Existing public-contract gaps stay unavailable and are not UI-owned state.

## Read and change inventory

Read files/sections: parent README, AGENTS, alpha objective/roadmap/POA&M and
execution-map authoring/traceability owners; client/connectome, instance-topology,
agent-bootstrap and learning/controller-training contracts. Child README,
GOVERNANCE, screens/GOVERNANCE, sprints 009/010/011, workflows/verify, package and
lockfile pin sections, CI workflow, Tauri config/build and engine staging;
rrd.rs, estate.rs, engine.rs, client.rs/client/process.rs, view.rs, main.rs;
session.ts, runtime.ts, adapter base/browser/desktop, ActionBar serving, routing,
config/idxdb/defaults, database/config stores, startup/connectome, types,
Connectome router, CreateConnection, Overview local and RuntimeConnection
index/session/lenses, smoke/config, docs/native-workbench and research record.
Also inspected the pinned engine install CLI/help and installation.rs identity
construction when the two-empty-project test exposed equal deterministic IDs.
New/changed files and final Git diff are the mechanical path inventory; this
record does not create a second implementation authority.

The two empty inventories legitimately receive the same deterministic instance
label at the pinned revision. The manager therefore never keys ownership or
stop by that label. Endpoint, canonical directory and native credential path
stay distinct. The process test adds eight records, thirteen relations and a
vector collection only to A, checks they do not appear in B, disconnects and
reconnects A, stops A and reads B's database/storage again. It also fills eight
native session slots, rejects a ninth, rejects duplicate/invalid handles and
unknown-profile fallback. Reservation tests cover duplicate pending start,
capacity, failed launch release and closing admission.

## Acceptance evidence: Windows, 2026-10-23/24

Pinned engine/SDK: `4860a253663c9c757800aafeb40890b76114c4f0`.
Real test engine SHA-256:
`906147b144542cc5a907031045efe55c2533113be6ada5680e72aef4e68f372c`.
`CARGO_TARGET_DIR=D:/localdev/devlabs/rrflow/target/connectome-native`;
`RRFLOW_BIN` names its `debug/rrflow.exe`. No C-07 frozen source/binary changed.

- `pnpm install --frozen-lockfile`: passed.
- `pnpm check`: passed Biome, identity, dependency authority, version and TypeScript.
- `pnpm build`: passed final production frontend. Existing inherited Wasm/browser
  externalization and bundle-size warnings remain; no new performance claim.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --locked project_registry_keeps_parallel -- --ignored --nocapture`:
  focused real-process oracle passed, 34.27 seconds before extra capacity checks.
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked`:
  28 passed, five intentionally ignored real-process tests.
- `cargo test --manifest-path src-tauri/Cargo.toml --locked rrd::client::process -- --ignored --test-threads=1`:
  final five real-process tests passed, 128.93 seconds, including capacity/isolation,
  exact installation preview, reopen, bundled sidecar, all existing native lenses.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`:
  passed, also checking all native targets.
- `pnpm exec playwright test --reporter=list,html`: final four passed, 10.0 seconds.
  Production rendering/public handshake mocks only: project switch, nested URL,
  advanced disclosure, back/reload, missing-profile route, unavailable features
  and native/browser boundary. These are separate from real native engine proof.
- Manual screenshot inspection: 1280x720 overview, local guide and project
  knowledge workspace; project selector and section hierarchy are clear, native
  session requirements visible, graph/vector/storage are grouped, advanced
  protocol detail is optional. No full accessibility audit claimed.

Failures surfaced and resolved: optional-route generic type mismatch (explicit
nested routes); unavailable Tokio macro (spawned overlapping read task); a false
unique-instance assumption (actual native directory/credential/endpoint ownership);
reload-before-debounced-save and empty-URL render crash (persist-before-navigation
and lazy query client); ambiguous Mantine label test (role-specific locator).
Windows checkout CRLF normalization was local formatter noise, with no unrelated
content committed. A desktop packaging attempt encountered an engine-file lock
while the process suite was still running; packaging is retried after its exit.

Windows artifact: `pnpm tauri build --debug --no-bundle --config
src-tauri/tauri.bundle.conf.json --config src-tauri/tauri.project-local.json`
passed after the process suite exited. The temporary local config only sets
`build.beforeBuildCommand` to an empty string to reuse the already verified
production frontend; it is removed afterwards. `pnpm engine:check` passed.
The unsigned development executable and its exact pinned engine are copied to
`target/connectome-project-alpha/` in the parent workspace. They are local
artifacts, not published release binaries.

Actual packaged WebView2 journey: opened the newly built application, selected
`target/connectome-project-alpha/demo-a`, reviewed and accepted the exact native
installation preview, and reached its authenticated session. Repeated for demo-b;
the manager showed two owned processes. Stopped A through its own row, opened B,
and observed B's live rrflowKV pipeline and counters continue to refresh. Saved
`parallel-projects.png` and `project-storage.png` beside the local artifact.
The automation initially asked for a semantic heading where the inherited title
is a text component, and one inspection outlived its closing dialog; corrected
those inspection locators. Neither timeout is recorded as a successful test.
This journey used real Tauri commands and engine processes, not browser mocks.

## Remaining boundaries

Candidate CI/merge and parent gitlink promotion have not yet been accepted in this
record. The PR is the candidate status authority. Parent association requires its
own reviewed pin change. No macOS/Linux desktop packaging, clean-machine installer,
signing, aggregate memory qualification, active cloud account, connector import,
model routing/subscription integration, replay or training was claimed here.
C-07 campaigns continue separately; this package is not a capacity or soak receipt.

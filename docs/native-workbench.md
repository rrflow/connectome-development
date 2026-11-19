# Native RRFlow workbench

Connectome is the optional desktop UI. The included `rrflow` executable owns
installation, authentication, schema, transactions, queries and persistence.
The UI never opens the database files itself.

## Use the built bundle

Keep `connectome.exe` and `rrflow.exe` together on Windows. Open Connectome,
choose **Start local RRFlow**, pick a project folder under **Add project** in
**Project engines**, inspect the exact installation preview on the project's row, and
choose **Install and open RRFlow**. Cancel leaves the engram uninstalled; an
empty project folder may have been created for planning. A changed project,
configuration or executable requires a fresh preview. An existing engram opens
without another installation. Credentials are stored by RRFlow and read by the
native client; no token is entered in a URL or browser storage.

The default project is in Connectome's application-data directory under
`engrams/local` in the currently pinned desktop implementation. The serving settings can select an absolute project path,
an explicit engine override, the console history size, how often instances are
checked, and the pace of the serving console: **Console burst (lines)**, default 50,
is how many lines of an engine's output the console takes at once, and **Console
refill (milliseconds)**, default 500, is how long one line of that allowance takes
to come back. Output that arrives faster is left out of the console. Connectome reads the installation mode from the folder instead of asking:
an empty or new folder is installed fresh, and in any other folder RRFlow is added
beside the files already there. Startup binds a free
loopback port and creates or updates its local connection profile. Close the
app to stop all owned engines, or use **Stop this engine** for one project; data remains.
Restart and **Start local RRFlow** to reopen it.

The binary digest is part of the installed engram identity. Retain the engine
that installed your project; replacing it is not an automatic data upgrade.
No account is required and this path does not enable synchronization.

## Project workspaces and parallel engines

**Manage project engines** lists every project added to Connectome, with the real
state of its instance, and any other instance the desktop is tracking.

- **Add project** takes a folder. Connectome previews the installation the engine
  plans for it, and after **Install and open RRFlow** installs exactly that plan,
  starts the engine, saves the project and opens it. A folder that already has
  RRFlow is started and opened without another installation. The optional endpoint
  credential mapping is under **Advanced**.
- Only the start asked for last opens its project, and only if you are still where
  you asked from with the dialog open. A start that finishes after you started
  another project, moved elsewhere or closed the dialog is saved and stays in the
  list as running, with its own **Open project** button.
- Every row acts for its own project only. Starting, stopping or removing one
  project never disables another project's buttons, the add form or closing the
  dialog, and a failure is shown on the row it belongs to. A row is busy from the
  click until its own action has ended.
- **Remove project** asks first and says what happens: the engine is stopped if
  Connectome started it, the project leaves Connectome's list and saved
  connections, and nothing in the project's folder is deleted, including its
  `.rrflow` folder and data. Removing a project's connection from the home screen
  does the same thing. A project that is starting or stopping cannot be removed
  until it has finished; the row and the home-screen menu say so.

Connectome puts no limit on how many projects are listed, running or connected. The
limits of four engines, eight tracked instances, eight native sessions and sixty-four
known projects were agent-written and were removed on 2026-11-19 by owner direction.
Each engine keeps the resource limits of its own configuration; nothing reserves
aggregate CPU, memory or disk. A start that fails reaps its child and stays visible
as a failed row until it is tried again, dismissed or removed.

Not available yet, because they need engine commands that do not exist: finding an
instance that was never added, stopping an instance Connectome did not start, and
idling an instance. The dialog says so. A directory already running reuses its
owned process.

Timers follow the window. Every repeating read in the app stops while the window
is hidden or minimized and runs once, at once, when it is shown again; a window that
only lost focus but is still on screen keeps refreshing.

**Selected project** switches saved runtime profiles while preserving the current
section. Every native operation selects that profile's session explicitly; reads
and graph focus cannot fall back to a global active project. The engine's installed
project/engram identity is available under **Advanced details**. Profile display
names are not authority. Identical inventories can have the same deterministic
instance ID in the pinned engine; endpoint, native credential path and owned
project directory remain distinct. Stopping one never uses instance ID alone.

The project URL keeps the section and knowledge lens across back/reload:
`/runtime/<profile>/knowledge/records`, for example. **Overview** explains the
native components; **Knowledge** opens their existing live lenses. **Advanced
details** reveals protocol, installed identity, readiness cursor and capabilities.
The glossary remains available. Actual errors remain visible in either view.

**Reasoning → Workbench** launches an engine observe flight and displays its
engine-recorded events. Flight pages follow the engine's creation-order cursor;
the displayed page is not presented as a complete history. The prompt is
persisted by the engine. This provider does not call LFG, SWAG or a language
model. Users can create local workbenches, save notes, and explicitly capture
engine diagnostic readings; these are labelled as desktop-profile notes rather
than engine audit. Capture reads capabilities, graph counts, storage details and
vector catalogue details separately. Connectome discards the result if the
observed profile, session, instance or local workbench changes while those reads
are pending, including when the workbench view unmounts. This guard follows
identity changes observed by the UI; it does not make the separate reads an
atomic engine snapshot. Existing local notes remain readable. The native process
tests cover a flight, pagination and session reconnect; they do not establish
rendered desktop behavior or model quality.

The workbench also presents the returned event sequence, a bounded project graph
and the rrflowKV storage path together. Graph labels and relationships come from
the engine read; positions and colors are presentation. Choose a preview limit or
open the graph lens, and use the keyboard record list to inspect a record. The
storage observation has its own timestamp and is not atomic with the graph read.
Event order does not establish MCP hops or unreported model decisions. The
[visual implementation plan](workbench-visual-observability-2026-11-07.md)
records remaining indexing, provider, learning and performance dependencies.

Remote source activation, training, provider billing and cloud synchronization
require separately implemented and authorized integrations. Running projects
in parallel does not itself authorize context sharing or training.

The [research and implementation sequence](project-workspace-research.md) connects
this layout to published UX research and current vendor workflows, with evidence
limits. Browser smoke proves navigation and rendering; the native process corpus
proves two owned engines, project-scoped records/relations/vectors, session
reconnect and targeted stop while the other engine continues to answer.

## Tasks and experimental controller proposals

Open **Tasks** in an authenticated project workspace. **Read tasks** lists up to
32 records per page; **Next task page** follows the returned cursor. Supply your
own title, goal, acceptance criteria and limits to **Record task in RRFlow**.
Opening a task does not invoke a model.

Select a task, read its budget, and explicitly supply step/run limits if none is
configured. **Review controller inputs** reads the engine's endpoint policy and
task identity. It displays configured candidate IDs and exact digests. Missing
policy is unavailable, never replaced by a default model. Endpoint/profile and
provider-credential setup remain engine/operator responsibilities in this slice.

**Request one experimental proposal** sends once through the native SDK. It does
not execute the proposed worker. Budget reads and **Stop task budget** remain
available while that call holds a shared session lease. Stop uses the budget
digest you last read; if it changed, refresh and review again. Stop does not prove
remote GPU termination. Durations beyond the granted native session window are
refused before dispatch, rather than silently truncated.

The last attempted task/attempt coordinates are saved per project profile and
instance before dispatch. **Recover last attempt** reopens that task; **Read budget
and attempt** only reads engine state. Keep older attempt IDs if you need their
readback: this view currently bookmarks only the latest attempt per project.
A lost reply must not trigger another inference. A local **Not dispatched** result
allows renewed input review; unresolved remote state remains visibly uncertain.
No credentials, authoritative result cache or training consent enter local storage.

The [selected-worker handoff](controller-worker-handoff.md) extends this workspace
with explicit review and one engine-admitted draft request. The current
[reconciliation](controller-task-recovery-reconciliation.md) pins both SDKs and the bundled-engine source to native PR230
`f4530539`, retaining the landed worker and observation integration. Earlier
[worker desktop evidence](controller-worker-desktop-live.md) keeps its original
engine identity; fresh validation of this reconciled UI is still required.

The [task recovery increment](controller-task-recovery.md) adds explicit resume.
After **Read budget and attempt**, **Resume task budget** is available for
known-completed cancelled or failed work. It keeps the original deadline, limits
and spent effort and does not invoke a model. Review current inputs before
requesting new work. The engine denies expired/exhausted budgets and stale
authority; unknown execution cannot resume. If the reply is lost, read the budget
again before another change. Existing attempts remain available through public
engine readback.

The **Assess a file** section is a separate, explicit task operation. It requires
an authenticated session, an available task budget, a currently listed source
file, and confirmation before source and practice text can be exported. The
engine's current assessment policy must allow the requested network, source and
context exports; the UI does not infer permission from a configured endpoint.
Each request is one bounded attempt. Its result is advisory, including when it
abstains, and is read back through the engine's protected assessment operation.
After reconnecting or reopening the task, **Check assessment result** performs a
fresh protected read. A denied or unavailable read clears any displayed result.

Assessment inputs are caller-authored declarations, not imported or verified
SWAG templates. Provenance details show the declaration identity and its exact
byte digest separately from the engine's practice-text digest. This interface
does not certify an answer, train a model, or establish evaluation quality. See
[Task assessments](task-assessments.md) for the limits and recovery behavior.

The [earlier desktop recovery trial](controller-task-recovery-desktop.md) proves
proposal, Stop/resume, worker draft and reload/readback on its recorded source.
A fresh trial on this reconciliation and dependency/candidate/protected acceptance
remain required. Source-edit successor planning, project effects, the complete
RROFLOW workflow and model qualification remain open. Native process checks are
distinct from a live BF16 desktop journey and release evidence.

## Learn and navigate

- **How RRFlow fits together** explains the native data engine without setup.
- **Data models** reads the authenticated catalogue, shows installed table
  models and schema/read cursor, and offers a bounded row query where native
  rrflowQL has a source for that model. Select a table and **Browse up to 50
  rows**. The displayed query is the one actually executed. A row preview is
  not a total count. Catalogue display is capped at 256 tables and reports
  truncation.
- **Records & relations** renders the engine's records and edges. Graph
  grouping and layout are presentation only.
- **Vectors** reads collections/points and asks the engine for similarity.
- **Storage engine** shows native persistence evidence and counters.

Document, relational, key/value and graph-node tables use native record reads;
record/relation/event queries additionally require their registered typed schema.
Relations, events, time series and geography use their existing native query
sources. Time-series queries select the series record kind, which may differ
from the sample table kind; choose it in the second selector. Vectors retain their existing dedicated public operations. Object
metadata and reasoning claims without an admitted row source are labelled;
no invented query or unimplemented capability is reported as working.

Multimodal storage is distinct from media understanding: metadata, content
references and embeddings may describe text/images/audio/video. Inference and
generation require their separately configured model and authorization.
PostgreSQL compatibility, cloud account synchronization and hosted devspaces
remain separate work; this bundle does not activate them.

## Build the same distribution

Use the repository's locked dependencies and pinned Rust toolchain:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm engine:stage
corepack pnpm engine:check
corepack pnpm tauri:bundle
```

Engine staging requires Python 3.11+ (the canonical builder uses `tomllib`); CI selects Python 3.15.0 explicitly. Staging uses the canonical builder at the exact RRFlow revision in the native Cargo lock. The sidecar helper checks the executable's embedded source revision, clean flag, target and self-reported file digest before publishing it. CI compares its builder receipt to the executable on fresh-build and cache paths. These hashes and coordinates are consistency checks, not a signature or remote build attestation.
It is a build-time action; installed startup downloads no engine source.
For a development artifact, `corepack pnpm tauri build --debug --no-bundle
--config src-tauri/tauri.bundle.conf.json` embeds the production frontend and
builds the desktop executable. Copy the staged engine beside that executable
as `rrflow.exe` (Windows) or `rrflow` (Linux/macOS). The frontend-only browser
preview intentionally cannot launch a native engine or hold its credentials.

## Validation

The [actual desktop worker trial](controller-worker-desktop-live.md) records
source-bound BF16 selection, explicit worker draft and reload/readback evidence,
including the remaining integration and release limits.
The [evidence formatting correction](controller-worker-evidence-formatting.md)
records the subsequent failed publication CI and unchanged observation values.

Run `corepack pnpm check`, `corepack pnpm build` and `corepack pnpm test:smoke`.
Native checks are `cargo test --manifest-path src-tauri/Cargo.toml --all-targets
--locked` and strict clippy. With the staged engine's absolute path in
`RRFLOW_BIN`, run `cargo test --manifest-path src-tauri/Cargo.toml --locked
rrd::client::process -- --ignored --test-threads=1`. These tests install and
serve the real engine; the ordinary native suite intentionally ignores them.
The process corpus includes exact preview acceptance/rejection and reopen,
isolated sessions, live catalogue/record/graph/vector/storage reads, and the
digest-verified sidecar. Frontend mocks and screenshots qualify rendering only.

Known query limitation: a schemaless record table without a registered record
schema persists data but native rrflowQL currently rejects its row query as
unregistered. The UI shows that table without enabling Browse. This is a query
qualification gap, not evidence that schemaless data cannot be stored.

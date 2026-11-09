# Inherited screen parity checklist

Sprint 009 decision 17: no inherited screen, graph or visual is deleted before
its RRFlow lens reproduces or improves every item below, shown by a
before/after capture with this harness. Baseline: `main` `38142b7`, both
themes, 1440x900, the seeded Sandbox (`seed.surql`). Image names are the
capture names under `baseline/inherited/38142b7/<theme>/`.

An item is met when the RRFlow lens shows the same information and supports
the same interaction on RRFlow data, at equal or better clarity. A dynamic
screen (a force layout, live map tiles) is reviewed by eye against the
baseline; a static one is also compared pixel by pixel when only its code
moves, as in Slice D0.

## Graphs

### Schema graph — `designer-graph`, `designer-options`, `designer-table-drawer` → Schema lens (D6)

- [ ] A node per table: table icon, name, one row per field with name and type
      in the accent type colour; long types truncate with an ellipsis.
- [ ] A dashed node per relation table: relation icon, name, `in` and `out`
      rows naming their tables, then the relation's own fields.
- [ ] Directed edges with arrowheads: table → relation (`in`) and relation →
      table (`out`); self-relations loop back to the same table.
- [ ] Dotted-grid canvas; zoom in, zoom out, fit to viewport and reset
      controls; pan and zoom by pointer.
- [ ] Graph settings menu: line style, layout algorithm, appearance,
      direction, strategy, record links, hover focus, stored per connection.
- [ ] Header actions: new table, graph settings, help.
- [ ] Table list pane: search, count badge, collapse, new table; tables and
      relations with distinct icons.
- [ ] Clicking a node opens the table drawer: General (schema enforcement,
      drop writes, table type), Permissions, Changefeed, Fields, Indexes,
      Events, each collapsible.

### Result graph — `query-result-graph-…`, `query-graph-traversal` → Query lens (D4)

- [ ] Force-directed layout of the result's records and the relations between
      them; curved directed edges with arrowheads.
- [ ] Node colour by table, with a legend of tables and edge types.
- [ ] Statistics: record count, edge count, stray record count.
- [ ] Controls: zoom in, zoom out, fit, reset, pause/resume the layout.
- [ ] Result selector and mode switch in the results header.
- [ ] Improvement target: node labels or hover cards (the baseline shows none).

### Record relations — `inspector-relations` → Records lens (D5)

- [ ] Incoming and outgoing relation lists with a radio-style marker per
      relation and a link to each relation record; empty states named
      ("No incoming relations found").

## Views

| Baseline capture | Visual elements and interactions to keep | RRFlow lens |
|---|---|---|
| `query-starter-*` | Starter tabs with commented example scripts; tab list with count, new tab, saved and history entries | Query lens starter tabs in rrflowQL (D4) |
| `query-seed-combined`, `query-result-combined-…` | Editor with line numbers and syntax colour; results header with response count, language badge, mode switch, run button; collapsible per-statement result blocks | Query lens (D4) |
| `query-result-individual-…` | One result at a time with a result selector | Query lens (D4) |
| `query-result-table-…` | Result table with record links, typed cells (dates, geometry, arrays), CSV export, pagination | Query lens (D4) |
| `query-result-live-…` | Live message stream with its empty state | Query lens live results over `/v1/ws` (D4) |
| `query-result-mode-menu` | Mode menu with an icon, name and one-line description per mode | Query lens (D4) |
| `query-variables` | Variables pane beside the editor | Query lens variables, which also absorb the Parameters view (D4) |
| `query-saved`, `query-history` | Saved queries and history drawers with search, timestamps and highlighted query previews | Query lens (D4) |
| `explorer`, `explorer-person`, `explorer-relation-table` | Table list with search; record table with selection, typed and linked cells, geometry in degrees, relation `in`/`out` links, row count, refresh, filter, pagination; empty-state guide | Records lens (D5) |
| `inspector-open`, `inspector-content` | Record inspector drawer: record id, content editor, Content/Relations tabs, revert, apply and save, delete and refresh | Records lens (D5) |
| `explorer-record-creator` | Record creator drawer: table, id, contents editor, create | Records lens with preview, then commit (D5) |
| `geography-drawer` | Map with the point marker, zoom controls, the GeoJSON contents | Records lens map (D5) |
| `modal-export-database` | Export dialog: resource and table selection with counts, cancel and save | Storage lens: Parquet export and backup (D7) |
| `modal-import-database` | Opens the system file picker | Storage lens typed import (D7) |
| `modal-table-creator` | Create-new-table dialog with Table/Relation/View kinds, name, schema mode | Schema lens (D6) |
| `functions`, `functions-greet` | Function list with search; source editor; properties: name, arguments with types, return type, permission, comment; revert and save; empty-state guide | Functions lens on RRFlow governed functions (rebuilt when RRFlow serves them) |
| `parameters`, `parameters-team` | Parameter list; value editor; permission and comment; empty-state guide | Query lens variables and estate configuration (D4) |
| `authentication`, `authentication-user` | Root, namespace and database authentication columns; user list; user editor with password, roles and durations | Principals and access lens (rebuilt when RRFlow serves principal administration) |
| `graphql` | GraphQL playground empty state and its cURL example | GraphQL lens (rebuilt when RRFlow serves GraphQL) |
| `documentation` | API reference with a topic tree, prose and code examples per topic, language switch | RRFlow API reference generated from the public operation catalogue. **Met in Slice D1a** (`native-workbench-api-reference`, `native-api-reference-*`): a family topic tree that follows the article in view, the catalogue's own summary and description per operation, method, path, authentication, mutation and action badges, request and response types, a titled copyable example per operation, and a saved language switch. RRFlow ships clients for CLI (curl), TypeScript, Python, Go, Java and .NET; the inherited PHP and C entries have no RRFlow client and fall back to CLI. The inherited view stays until the final cut |
| `mini-embed-generator`, `mini-runner` | Embed builder: query, variables, setup, dataset, orientation, theme, result mode, options, live preview, copy iframe and URL; the compact runner | RRFlow embed (rebuilt when RRFlow has a browser deployment) |
| `overview` | Hero with mark and wordmark, local RRFlow card, instance list with filters and search, resources | Kept; already RRFlow |
| `command-palette` | Search with grouped results and keyboard hints | Kept |
| `connection-menu` | Connection switcher with search | Project and instance switcher |
| `sandbox-onboarding` | Sandbox introduction dialog | Scratch project introduction (D1b) |
| `settings-*` | Preferences, keybindings, templates, backup and restore, licences, about | Kept; the inherited wordmark is replaced in Slice C2 |

## RRFlow-native desktop screens

Baseline: the desktop preview build of `main` `83804c3`, both themes,
1440x1800, an estate installed fresh by the capture and seeded with the lens
fixture (12 records, 14 relations, one collection of 8 vectors). Image names
are the capture names under `baseline/native/83804c3/<theme>/`. These screens
are already RRFlow; the rule still applies when a slice changes them (D1 to
D7 rebuild the query, records, schema and storage lenses in place).

### Records & relations graph — `native-lens-records-relations`, `native-records-*`

- [ ] One dot per record, sized by its relation count, labelled with the
      record's title; one directed arrow per relation.
- [ ] Zoom in, zoom out, fit and full-screen controls; scroll to zoom, drag to
      move, click a dot for its details.
- [ ] "Find a record" search by title or identity; the selection highlights
      its neighbours and dims the rest (`native-records-selected`).
- [ ] Show the whole estate or the selection's neighbourhood, with steps
      away 1 to 3 and links followed both ways, out or in
      (`native-records-around-selection`).
- [ ] Colour by cluster, kind or a field, with a legend and counts per colour
      and an unlinked-records entry (`native-records-color-kind`); a Kinds
      filter.
- [ ] "Drawing N of M records and N of M relations, read at cursor C" under
      the controls.
- [ ] Start-here list of the most linked records; the record panel: kind
      badge, title, identity, show what is around it, similar records, query,
      links to and from with each relation's kind, fields, valid from.
- [ ] RRFlowQL console: the record's query, run with Ctrl/⌘ + Enter or the
      run button; one traversal button per relation kind from the selection;
      the result's row count, keys examined, output size and cursor badges
      over a result table (`native-records-query`, `native-records-traverse`).

### Vector map — `native-lens-vectors`

- [ ] One dot per vector, placed so close dots have similar vectors; a line
      to each vector's nearest neighbours from the engine's exact search;
      colours shared with Records & relations.
- [ ] Collection facts: field, dimensions, similarity, storage tier, vector
      source; "How to read this map"; vectors drawn, exact searches, keys
      examined, build time, cursor.
- [ ] Stored points: point, record, dimensions, length, first numbers and
      cursor per vector, in reference order, with more on demand
      (`native-vectors-points`).
- [ ] Selecting a point: the selected record, its identity, a link to its
      relations and its most similar records with their scores
      (`native-vectors-nearest`).

### Workbench and lenses

| Baseline capture | Visual elements and interactions to keep |
|---|---|
| `native-overview` | Hero with mark, wordmark and version; local RRFlow card with "Start local RRFlow" and "How RRFlow fits together"; instance list with filters, search and the empty state; resources |
| `native-project-engines` | Project engines dialog: engine and connection limits, running engines, project directory with folder picker, fresh or existing project mode, preview or open |
| `native-installation-preview` | The exact installation preview: target path, the review notice (paths, permissions, configuration; no cloud upload or training) and the attunement plan as JSON. Improvement target: show the path without the `\\?\` prefix |
| `native-serving-stages`, `native-served` | Serving stages while the estate installs and starts; the served project's running state |
| `native-workbench-overview` | Breadcrumb; connection badge; project name, instance identity and endpoint; project switcher; tabs; session strip with sign-in, renewal and disconnect; the four lens cards with live counts; reasoning workspace with explore and knowledge-path actions |
| `native-workbench-knowledge`, `native-lens-data-models` | Native data-model catalogue (relational, vector, graph relation, geo, object, event, graph node, time series, key value) with schema and cursor badges; native table chooser; the multimodal notice; refresh schema |
| `native-models-document-rows` | A chosen table's name, mode and purpose; browse up to 50 rows; the query that read them, the row and key counts and the bounded-preview note; the row table |
| `native-lens-storage-engine` | rrflowKV pipeline: write-ahead log, memtable, segments on disk and page cache, each with its live counter and fill bar |
| `native-storage-counters`, `native-storage-history` | Every engine counter by stage (page cache, memtable, write-ahead log, segments, flush and compaction, segment I/O including open files and handle evictions, reopens and denials, sequences, and storage admission: checkpoint entries, native transactions, read views, retained bytes, outstanding and queued requests, with the engine's own caveats) with fill bars; history, retention and indexes: backend, cursors, change head, retention, sequences, revisions, manifest |
| `native-workbench-tasks` | The task and controller-proposal workspace (sprint 013) on a fresh estate: its heading and the note that a proposal executes no worker and authorizes no training; read tasks and recover the last attempt; the form that records a task in RRFlow, disabled until it has a title |
| `native-workbench-activity`, `native-workbench-learning`, `native-workbench-services` | The honest unavailable states: no fabricated activity, learning controls and provider setup unavailable in this build, planned cloud roles |
| `native-panel-*` | Glossary drawer; advanced details (HTTP transport, engine readiness, protocol and identity, verified engine identity with its capability list); explore knowledge; knowledge paths; manage project engines |
| `native-settings-*` | Preferences; keybindings; templates; Database Serving (project directory, installation mode, engine path, console history); backup and restore; open-source licences; About (version, build, protocol and engine revision, repositories). The inherited wordmark here is replaced in Slice C2 |
| `native-workbench-api-reference`, `native-api-reference-query`, `native-api-reference-python` | Every public operation the engine serves, read from its operation catalogue without a session: the family topic tree, which highlights the operation in view and keeps it in the list's own view, and a jump to any operation (the capture asserts the highlight after a jump, at the top and after scrolling); per operation its summary, method and path, description, authentication, mutation and action badges, operation, request and response types, and a copyable example in the saved language; the operation and family counts and protocol version |

## Sprint 016's window

Step 2 moved the native lenses into one window. Compare `baseline/window/c1cbff2/` with
`baseline/window/step-2/`, both at real window sizes, for what a person sees without
scrolling. The native rows above stay met, with these moves:

- `native-workbench-knowledge`, `native-lens-*`, `native-records-*`, `native-vectors-*`,
  `native-models-*`: Knowledge › Graph, Schema and Vectors. The four lens cards and their
  live readings stay on Home.
- `native-lens-storage-engine`, `native-storage-*`: System › Storage.
- `native-workbench-api-reference`, `native-api-reference-*`: System › API reference.
- `native-workbench-tasks`: Reasoning › Tasks.
- `native-panel-advanced-details`: System › Instance, with the session panel. A closed session
  still shows its panel on every tab.

Step 3 moved the details panels of Graph and Vectors into the inspector column, so their graphs
take the pane's full width. Every reading, control and link is kept: a record's fields are under
Details, and a search's evidence line is a table there. Links stay in view at every depth.
`baseline/window/step-3/` holds the screens that changed.

Step 4 adds guides over the same screens and moves nothing. Home gains a Guides section, and
`baseline/window/step-4/` holds it with each step of the first guide.
`baseline/window/around-labels/` shows Around the selection naming every record it draws.

Removed as notices, as decision 20 requires: `native-workbench-activity`,
`native-workbench-learning`, `native-workbench-services` and `native-panel-knowledge-paths`.
Their look stays in the baselines. Activity and Knowledge paths return as real views in steps 6
and 8; Learning and Services return when the engine serves them.

## Connectome Workbench (RRFlow `6448a4f`)

[Sprint 016](../../.agents/sprints/016-guided-workspace.md) returns every view below in
today's visual, on public engine operations. Image names are under
`baseline/workbench/6448a4f/dark/`. An item is met when the new tab shows the same
information and supports the same interaction, at equal or better clarity.

### Window: `01-overview`, `01e-overview-inspector-closed` → every screen

- [ ] Sidebar, work area and inspector all visible at 1440x900 with no page scrolling.
- [ ] The work area and inspector scroll independently.
- [ ] The inspector closes and reopens.

### Inspector: `01a` to `01d`, every `*-opens-inspector` image → right pane

- [ ] Any object anywhere opens its labelled properties.
- [ ] Claims show valid interval, transaction time, producer and digest.
- [ ] Raw object expands in place.

### Overview: `01-overview`, `20-fresh-instance-overview` → Start › Home

- [ ] Tiles for claims, claim sequence, indexed source and vector artifacts.
- [ ] Active reasoning run as a timeline, with signals, recent claims and activity beside it.
- [ ] Each item opens in the inspector.

### Connections: `02-connections`, `02a` → System › Instances

- [ ] Saved profiles and negotiation against a chosen address, with its failure shown.

### Estates: `03-estates` to `03d` → System › Estate

- [ ] A map of the project boundary with its nodes, role and lag.
- [ ] Authority, reconciliation operations, storage boundary, project scope and hosting boundary.

### Tables: `04-tables` to `04c` → Knowledge › Records

- [ ] One list of tables, each saying what is authoritative, with counts.
- [ ] Rows beside it, a row opening in the inspector, and a way into Query.

### Data models and schema: `05` to `05b`, `12`, `12a` → Knowledge › Schema

- [ ] A map per scope of record types, relation paths and event types.
- [ ] The registry, bind, validate, deny-or-commit path, with the current migration.
- [ ] Each type's properties with type and requirement; undeclared properties shown as denied.

### Signals: `06-visuals` to `06b` → History › Signals

- [ ] Six lanes of recent events, stepping back and forward, and a selected event opening its
      mutation and audit. Signals drew `reasoning`, `workflow`, `routing`, `search`, `storage` and
      `data`, and hid `model` and `memory`; Stream folded them differently.

### Flights: `07-flight` to `07f` → Reasoning › Flights

- [ ] A prompt with its strength signals and worked examples.
- [ ] Effort profile, provider, context, budget and acceptance marker.
- [ ] Runs compared per effort: effort, context, tokens, reasoning, cache, events, latency,
      acceptance.
- [ ] Event frames that freeze on click and open their raw event.

### Stream: `08-stream` to `08c` → History › Stream

- [ ] First, rewind, resume, forward, latest, a scrubber and a speed control.
- [ ] Six lanes across one cursor.
- [ ] A frozen mutation with scope, action, timeline, audit, commit and digests, and a filmstrip of
      every loaded frame, up to 512.

### Traces: `09-traces` to `09d` → Reasoning › Traces (needs a public operation)

- [ ] Trace state, a list of traces, causal topology with the critical candidate, and a frozen span.

### Graph: `10-graph` to `10g` → Knowledge › Graph

- [ ] Local and global modes, kind chips, a hover tooltip, and a click opening the inspector.

### Cluster: `11-cluster` to `11c` → System › Cluster (needs a public operation)

- [ ] Rewindable node history with leader, lag and alerts.

### Capabilities: `13-capabilities`, `13a` → System › Capabilities

- [ ] Counts by maturity, the replay contract, the planning receipt, and the tool catalogue marked
      read or mutation.

### Query lab: `14-query` to `14b` → Ask › Query

- [ ] An explicit bi-temporal query (`AT VALID ... KNOWN ...`).
- [ ] Read manifest, semantics, execution, read proof and boundary.
- [ ] The selected path and the rejected one with its reason, plus the operator pipeline.

### Runs, Claims, Routes, Activity: `15` to `18a` → Reasoning, Ask › Search, History

- [ ] Each run as goal, plan, attempt, observation, decision and verification, then outcome.
- [ ] Claims with subject, predicate, object, producer and validity.
- [ ] Ranked files for a term (needs a public operation).
- [ ] Invocation outcomes.

### Search and keys: `19`, `19a` → top bar

- [ ] `/` focuses the search field and Enter routes source files; keys switch lens. August never
      searched loaded objects, although its placeholder said so (`app.js:1515-1522`).

### Hover: every view

August had one custom popup, on graph nodes, and 19 plain browser tooltips: the refresh and inspector
buttons, the transport controls of Flights, Stream and Cluster, each flight telemetry packet, and the
surface matrix's entrypoints. Today's window must keep all of them. Parking lot 007 proposes going further.

- [ ] Each transport control says what it does on hover.
- [ ] A graph node shows its full label, kind and detail on hover.

### Defects not to carry over

- Estates reads "NaN" for its revision without an estate document (`03-estates`).
- Capabilities throws once a planning receipt exists: the click does nothing, then the footer says
  "Runtime unavailable" (`13x`, `13y`).
- Query and Routes results vanish at the 5-second refresh (`14c`).
- "Local" still draws all 180 nodes for most selections, and selecting a node does not recentre it
  (`10`, `10c`).
- The inspector has no links onward.
- Every 5 seconds a re-render wipes Connections' form values, graph pan and zoom, and an open raw object
  (`app.js:94-95`).
- The graph tooltip stays on screen after a Local click, and a graph click does not open a closed
  inspector (`10g`, `app.js:1323`, `app.js:1351`).
- Signals' stepping leaves its 48-event window (`app.js:476`, `app.js:494-495`).
- Keys fire with modifiers held, so Ctrl+C goes to Claims (`app.js:1519-1534`).

## Not yet captured

- `migration` is reachable only for engine versions 2.6.1 to 3.0, which the
  in-browser engine (3.0.2) is not; the view's source is its only record.

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
| `native-workbench-activity`, `native-workbench-learning`, `native-workbench-services` | The honest unavailable states: no fabricated activity, learning controls and provider setup unavailable in this build, planned cloud roles |
| `native-panel-*` | Glossary drawer; advanced details (HTTP transport, engine readiness, protocol and identity, verified engine identity with its capability list); explore knowledge; knowledge paths; manage project engines |
| `native-settings-*` | Preferences; keybindings; templates; Database Serving (project directory, installation mode, engine path, console history); backup and restore; open-source licences; About (version, build, protocol and engine revision, repositories). The inherited wordmark here is replaced in Slice C2 |
| `native-workbench-api-reference`, `native-api-reference-query`, `native-api-reference-python` | Every public operation the engine serves, read from its operation catalogue without a session: the family topic tree, which highlights the operation in view and keeps it in the list's own view, and a jump to any operation (the capture asserts the highlight after a jump, at the top and after scrolling); per operation its summary, method and path, description, authentication, mutation and action badges, operation, request and response types, and a copyable example in the saved language; the operation and family counts and protocol version |

## Not yet captured

- `migration` is reachable only for engine versions 2.6.1 to 3.0, which the
  in-browser engine (3.0.2) is not; the view's source is its only record.

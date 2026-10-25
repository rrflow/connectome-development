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
| `documentation` | API reference with a topic tree, prose and code examples per topic, language switch | RRFlow API reference generated from the public operation catalogue |
| `mini-embed-generator`, `mini-runner` | Embed builder: query, variables, setup, dataset, orientation, theme, result mode, options, live preview, copy iframe and URL; the compact runner | RRFlow embed (rebuilt when RRFlow has a browser deployment) |
| `overview` | Hero with mark and wordmark, local RRFlow card, instance list with filters and search, resources | Kept; already RRFlow |
| `command-palette` | Search with grouped results and keyboard hints | Kept |
| `connection-menu` | Connection switcher with search | Project and instance switcher |
| `sandbox-onboarding` | Sandbox introduction dialog | Scratch project introduction (D1b) |
| `settings-*` | Preferences, keybindings, templates, backup and restore, licences, about | Kept; the inherited wordmark is replaced in Slice C2 |

## Not yet captured

- RRFlow-native screens (the runtime workbench lenses, diagnostics, serving
  and project stages) need the desktop build and a running engine; they are
  captured through the desktop webview before D4 changes them.
- `migration` is reachable only for engine versions 2.6.1 to 3.0, which the
  in-browser engine (3.0.2) is not; the view's source is its only record.

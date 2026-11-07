# Sprint 016: guided workspace

Goal: every August Workbench view returns in today's visual, inside one window with
proper tabs and grouping, with animated guides that take a newcomer through real
reasoning on their own project.

Source: [parking lot 006](../parking-lot/006-guided-workspace.md), committed by the
repository owner on 2026-11-01. This sprint carries sprint 009's steps S1 and V1 to
V6 into this order. Sprint 009 keeps its record and its decisions.

## How steps land

- One pull request per step. It lands through the merge queue before the next step
  starts. Nothing is stacked.
- Each step's exact file tasks are written here against the current code when the
  step opens, because earlier steps change those lines.
- Every changed screen has a before-and-after capture at 1440x900 and 1366x768, and
  every visual difference is explained. A lost graph, view or interaction stops the
  step.
- A step that adds a view also adds or extends its guide, once the guide engine
  exists.

## The visual

The owner, 2026-11-03: "dark teal and burnt orange instead of purple". "Today's visual" in this sprint
means Connectome's tokens with those values, and the mark in the same shape with the same gradient
moved to them.

## Ordered steps

1. **Preserve.** Commit the 2026-09-16 plans, the Workbench captures, the Workbench
   parity list and a real-window capture of today's screens.
2. **The window.** Areas, tabs and an inspector frame, with today's lenses moved in
   unchanged. No page-level scroller remains.
3. **Inspector and full-window graphs.** Three depths, onward links, and the graph
   recentring on what you select.
4. **Guide engine and the first guide,** on the Graph and Records views that already
   work.
5. **Turnkey start,** once the engine work named in parking lot 006 has landed.
6. **History:** Stream, Signals, Activity. `RrdSessionClient` already has `changes`,
   `followChanges`, `audit` and `exportAudit` (`src/rrflow/session.ts:948-975`).
7. **Reasoning:** Flights, Runs, Claims, Tasks, Plans. Flights needs native commands
   over the served `flight-*` operations.
8. **Ask and Knowledge:** Query studio, Records editor, Schema designer, Knowledge
   paths. These are sprint 009's V1, V2 and V3. The governed edit calls exist
   (`previewChange`, `commitChange`, `discardChange`, `session.ts:927-942`).
9. **System:** Estate, Instances, Capabilities, Backups, API reference. These are
   sprint 009's V5 and V6.
10. **Engine first:** Traces, Cluster and Search need new public operations in RRFlow.
    They follow RRFlow's roadmap order.

## Step 1: preserve

### Tasks

1. `.agents/archive/2026-09-16/`: add the nine untracked files from the old checkout
   `connectome/.agents`, byte for byte, with a README.
2. `tests/visual/baseline/workbench/6448a4f/`: add the 85 Workbench captures as WebP
   with a manifest. They were taken by building RRFlow `6448a4f6` and running its real
   server, with seeded data.
3. `tests/visual/baseline/window/c1cbff2/`: add captures of today's desktop at real
   window sizes, as the "before" for step 2.
4. `tests/visual/capture-native.mjs:295`: the viewport is fixed at
   `{ width: 1440, height: 1800 }`, and the tall window hid the fold from every baseline.
   Add `--window <width>x<height>`, defaulting to today's value so existing comparisons
   keep working. `shot` moves the mouse to the window's corner instead of the literal
   `(1439, 1799)`.
5. `tests/visual/PARITY.md`: add the Workbench section. `tests/visual/README.md`: add the
   new baselines and the rule on real window sizes.
6. Sprint 009: add decision 21 and point S1 here.

### Definition of done

`pnpm check` passes, Connectome CI passes, and no product source changes.

## Step 2: the window

Written against `c1cbff20`. Re-read before starting.

### Current code

- `src/screens/connectome/pages/RuntimeConnection/index.tsx:212-217` wraps everything in one
  scroller:

  ```tsx
  <ScrollArea
      pos="absolute"
      inset={0}
      type="scroll"
      scrollbars="y"
  >
  ```

  Inside it, in order: breadcrumb, connection heading, project selector, section buttons,
  session panel, four lens cards, then the lens. At 1437x777 the lens begins at or below the
  fold.
- `index.tsx`, the `Project sections` nav, lists `overview`, `knowledge`, `tasks`, `activity`,
  `learning`, `services` and `api` as buttons.
- `tabs/records.tsx:65` and `tabs/vectors.tsx:51` fix the canvas height at 620 px.
- `routing.ts:55-62` owns the `/runtime/:id/:section/:detail` route.

### Target

- A window of fixed panes: a top bar with project and estate; an area rail; tabs; a work pane
  that scrolls by itself. Closed PR #10's `.workspaceHeader` and `.workspaceScroll` rules are
  reference input.
- The inspector column comes with step 3, when it has real content: an empty one would be a
  notice. The domain selector comes when the engine scopes reads by domain (RRFlow H-11c).
- `canvas` sizes follow the pane instead of the constant 620.
- Only today's real views get tabs in this step, moved in unchanged: Start › Home;
  Knowledge › Graph, Schema, Vectors; Reasoning › Tasks; System › Instances, Storage,
  API reference.
- Existing route addresses keep working, by redirect where the address changes.
- The connection heading, session panel and advanced details move into System › Instances,
  with a compact status in the top bar.

### Behaviour that changes on purpose

- The four lens cards stay on Home with their live readings, and open their tabs. They leave
  the Knowledge views, where the tabs replace them.
- The Activity, Learning, Services and Knowledge paths notices leave the navigation, as
  decision 20 of sprint 009 requires. Each returns as a real view in steps 6 and 8, or when
  the engine serves it. Their current look stays in the captured baselines.

- The page toolbar's band goes to the project bar at normal widths. Its only control there, the
  project engines button, opens the same dialog as the bar's "Manage project engines".

### Oracle

Before-and-after captures at both window sizes, every lens reachable with its graph on the
first screen, and no element scrolling at page level. `tests/visual/PARITY.md`'s native rows
stay met.

### Stop conditions

Stop if a lens loses a graph, control or reading, if a route stops resolving, or if the shell
needs a credential or bearer in the webview.

## Step 3: inspector and full-window graphs

Written against `1eb60184`.

### Current code

- `tabs/records.tsx` and `tabs/vectors.tsx` each split their width with `<Grid>`: a graph in eight
  columns and a details panel in four. Records' panel shows fields and links together. Vectors'
  panel shows the nearest records and a line of search evidence.
- `graph.tsx` `bringIntoView` already frames the selection and its neighbours with an animated
  camera, so a selection recentres. Step 3 gives it the room.

### Target

- `inspector.tsx`: `InspectorPanel` puts a view's details in the window's right-hand column through
  a portal, so a view keeps its state and only the place changes. The column takes no room until a
  view has something to show, and closes and reopens. `InspectorObject` shows one object at three
  depths, plain words, details and raw, with its onward links in view at each.
- Graph and Vectors move onto it and their graphs take the pane's full width.
- Other views adopt it as they land. Schema, Storage, Tasks and the rest have no object selection
  today, and an empty column would be a notice.

### Oracle

The capture walks Details, Raw and Plain words on a selected record and fails if its links leave
the view, then closes and reopens the column. Before-and-after captures at real window sizes, with
every lens's reading kept: `baseline/window/step-2/` is the "before".

### Stop conditions

Stop if a panel loses a control, a reading or a link, or if the inspector needs a credential.

## Step 4: guide engine and the first guide

Written against `de7cdeba`.

### Current code

No guide exists. Parking lot 006 sets the contract. The inspector (`inspector.tsx`) and Graph
(`tabs/records.tsx`) hold the controls the first guide teaches.

### Target

- `guides/engine.tsx`: `GuideProvider` runs one guide at a time over the real window. It finds a step's
  control by `data-guide`, follows it as panes move, and dims everything else without blocking it.
  Dialogs and dropdowns open above it.
- `guides/explore-graph.v1.json`: the first guide, as data. The only button is Finish on the last step.
- A step ends in one of two ways. `useGuideSignal` reports an event, for picking a record: only a real
  pick counts, because the selection can already be there when the tab opens. `useGuideState` reports a
  state, for the open depth and what the graph shows: the person can get there before the step begins,
  and then no control could produce the event the step waits for.
- If a step's control is not on screen, the callout says why. A step on another tab offers **Back to
  this step**.
- `guides/cards.tsx`: Home offers guides and says why one cannot start.
- `scripts/check-guides.mjs`, in `pnpm check`: fails if a guide names an anchor or signal the source no
  longer has, or leaves a step with no way to finish.

### Oracle

The native capture walks the guide on a real engine by doing the real actions, and fails if a step does
not advance:

- `guide-explore-graph`: all five steps in order, then Finish.
- `guide-ahead-of-its-steps`: a record already picked, Details already open, and the graph already
  showing what is around it. No step passes without a real pick, no step strands the person, and leaving
  changes nothing they did.
- `guide-away-and-back`: closing the details panel and changing tab, then returning.
- `guide-reduced-motion`: with reduced motion the spotlight has no animation or transition.

The smoke test proves a guide cannot start without a session. `check-guides` is shown to fail on a stale
anchor, a stale signal, a removed emitter and a malformed step.

### Not proved here

The reason shown for a project with no records is not reached by a test: the capture seeds its estate
before the Home screen is read. Step 5 owns the empty project and its sample estate, and tests it.

### Found while reviewing, not fixed here

**Around the selection** names only the selected dot, so the others need a hover to read. The guide ends
on this screen. It is older than this sprint: `baseline/native/83804c3` shows the same. It gets its own
fix before step 5, with its cause and a capture that fails without the fix.

### Stop conditions

Stop if a step needs a Next button, if a guide blocks the window under it, or if a guide would claim
something the engine did not return.

## The plan against the code

Status: PARTLY DECIDED, 2026-11-03. The owner decided 3, 4, 5 and 7 in
[parking lot 007](../parking-lot/007-guided-workspace-against-code.md). Decisions 1, 2 and 6 are open, and
[parking lot 008](../parking-lot/008-views-and-knowledge-surfaces.md) waits on review.

Written against Connectome `998c058f`, engine pin `15f36a87` and RRFlow `development/main` `e6f3632b`.
Paths use parking lot 007's prefixes. Lines are re-checked when each pull request opens, because earlier
ones move them. Exact tasks are written below for the first three pull requests. The others cite their
files and are made exact when they open, as this sprint's rule requires.

### Milestones

These names match LFG's release names and RRFlow #245, so "prototype" means one thing across projects.

| Milestone | It is reached when | Depends on |
|---|---|---|
| **Full UI prototype** | 20 real tabs, hover explanations everywhere and a guide in each area, on a real engine with the capture estate. | This sprint only |
| **Developer build** | The above, plus: pick a folder, approve once, and watch a real project fill in. | Project map, RRFlow #236 and #241, Connectome #30 |
| **Integration prototype** | The above, plus LFG and SWAG working through the engine, shown in their tabs. | RRFlow Gate G, including #246 and #249 |

### Order

Sprint 016's rule of one pull request per step changes: steps 6 to 9 are each several pull requests, because
step 8 alone cannot be reviewed as one. Each still lands before the next opens, and nothing is stacked.
Step 5 keeps its number and lands when its dependencies do.

| PR | What | Tabs | Waits on |
|---|---|---|---|
| — | Graph labels, Connectome #35 | 8 | The owner's word |
| F1 | Move the engine pin to `development/main` | 8 | Decision 1 |
| F2 | A hover explanation on every control | 8 | Review of parking lot 008 |
| 6a | History › Stream and the read point | 9 | Decision 2 |
| 6b | History › Signals and Activity | 11 | Review of parking lot 008 |
| 6c | Graph at a chosen moment | 11 | |
| 7a | Reasoning › Flights; retire the old diagnostics page | 12 | |
| 7b | Reasoning › Claims; the run view inside Tasks | 13 | |
| 8a | Knowledge › Knowledge paths | 14 | |
| 8b | Ask › Context and the top-bar search | 15 | Review of parking lot 008 |
| 8c | The shared layer, and the Designer graph inside Knowledge › Schema, read-only | 15 | Decision 6 |
| 8d | Knowledge › Records, read-only | 16 | |
| 8e | Ask › Query | 17 | |
| 8f | Edits in Records and Schema | 17 | POAM-043 sets the limit |
| 9a | System › Instances, including the Stop fix | 17 | |
| 9b | System › Capabilities and Estate | 19 | A run proving the estate read |
| 9c | System › Backups | 20 | |
| L1 | Learning › SWAG, read-only | 21 | |
| L2 | Learning › LFG | 22 | LFG's status contract |
| 5 | Turnkey start | | Other sessions |
| 7c | Reasoning › Plans | | Connectome #30 |
| 7d | Reasoning › Runs as its own tab | | Stage records in the engine |
| 10 | Traces, Search, Cluster | | New public operations |

Every row after F1 also waits on decision 1, because each pull request lands before the next opens.
Parking lot 008 proposes K1, K2 and K3 between these rows, once reviewed.

Full UI prototype counts the 20 tabs through 9c. The two Learning tabs sit outside that count, since they
are optional and absent unless configured.

### The path of a new engine-backed tab

Every tab that adds an operation follows the same path, so none skips a layer:

1. The SDK method. If it is missing, as for `query-live-poll`, stop: it needs an RRFlow pull request.
2. `src-tauri/src/rrd/client/<name>.rs`, and a projection in `src-tauri/src/rrd/view/<name>.rs` that keeps
   what the tab needs.
3. A command in `src-tauri/src/rrd.rs`, registered at `src-tauri/src/main.rs:102`.
4. Types and a method in `src/rrflow/session.ts`. Shared reads go in `RC/queries.ts`.
5. `RC/tabs/<name>.tsx`, with `InspectorObject` for what can be selected. Every control is explained on hover.
6. An entry in `RC/areas.ts`, naming the operations it needs, and its route in `RC/index.tsx`.
7. A guide, or an extended one, held by `scripts/check-guides.mjs`.
8. A process test under `src-tauri/src/rrd/client/process/` against a real engine, and a capture step at
   both window sizes.

### Tab map

"Whole" means the August view returns with the same information or better, apart from anything the row
names. "Replaced" means parking lot 007's decision 3 applies: the tab shows what the engine serves today,
and grows when the engine does.

| Tab | August source | Existing code to re-author or reuse | Missing today | Returns |
|---|---|---|---|---|
| Start › Home | `wb/static/app.js:162-188` | `RC/index.tsx:334-395`, `RC/workspace.tsx` | Tiles and recent changes; `session.ts` has the reads | Replaced: no run timeline |
| Knowledge › Graph | `wb/static/app.js:1286-1389` | `RC/tabs/records.tsx`, `RC/graph.tsx` | Time arguments at `src-tauri/src/rrd/client.rs:646-657` | Whole |
| Knowledge › Schema | `wb/static/app.js:436-469`, `wb/static/app.js:1054-1100` | `RC/tabs/models.tsx`, `src/screens/connectome/views/designer/` | Whole registry at `src-tauri/src/rrd.rs:129-146`; shared layer | Whole; unbacked drawer sections wait |
| Knowledge › Vectors | | `RC/tabs/vectors.tsx`, `RC/tabs/quantization.tsx` | Nothing | Built |
| Knowledge › Records | `wb/static/app.js:414-434` | `src/screens/connectome/views/explorer/`, `src/providers/Inspector/`, `src/components/DataTable/` | Typed cells at `src-tauri/src/rrd/view.rs:166-170`; `knowledge/records` already means Graph, so this needs `knowledge/tables` | Whole for reading |
| Knowledge › Knowledge paths | | Closed PR #10, `8a9eb5e5:src/screens/connectome/pages/RuntimeConnection/tabs/knowledge.tsx`, as reference | Native, `session.ts` and React; SDK at `sdk/operation.rs:522`, `sdk/operation.rs:543` | New |
| Ask › Query | `wb/static/app.js:1102-1136` | `src/screens/connectome/views/query/`, console at `RC/tabs/records.tsx:875-1030` | Parameters, plan, manifest, read proof, typed cells | Whole minus the operator pipeline |
| Ask › Context | | `src/screens/connectome/pages/RuntimeConnection/pipeline.tsx` as a pattern | Native, `session.ts`, React; SDK at `sdk/operation.rs:803` | New |
| Ask › Search | `wb/static/app.js:1403-1429` | | A public operation | Waits |
| Reasoning › Flights | `wb/static/app.js:506-825` | Replaces `src/rrflow/diagnostics.ts:184-192` and `src/screens/connectome/pages/RuntimeDiagnostics/index.tsx` | Native, `session.ts`, React; SDK at `sdk/operation.rs:823`, `sdk/operation.rs:836`, `sdk/operation.rs:856` | Replaced |
| Reasoning › Claims | `wb/static/app.js:1397-1401` | `client.query` at `src/rrflow/session.ts:843` | React only; capture seed has no claims | Whole, though rrflowQL rows lack confidence and signature |
| Reasoning › Tasks | | `RC/tasks.tsx` | Stripped fields at `src-tauri/src/rrd/client/tasks.rs:57-102` | Built |
| Reasoning › Runs | `wb/static/app.js:1391-1395` | The Tasks inspector until then | Attempt listing, stage records | Replaced, inside Tasks |
| Reasoning › Plans | | Connectome #30 | That PR pins off-main `8d475008` | Another session's |
| Reasoning › Traces | `wb/static/app.js:844-936` | | A public operation | Waits |
| History › Stream | `wb/static/app.js:938-1052` | `changes`, `followChanges` at `src/rrflow/session.ts:948-966` | React; fields at `src-tauri/src/rrd/view/history.rs:79-108` | Whole, minus the audit join |
| History › Signals | `wb/static/app.js:471-497` | As Stream | React | Replaced: no routing lane |
| History › Activity | `wb/static/app.js:1431-1435` | `audit`, `exportAudit`, `saveArtifact` at `src/rrflow/session.ts:968-989` | React; the pin move | Replaced |
| System › Instances | `wb/static/app.js:190-270` | `RC/session.tsx`, `src/components/ActionBar/projects.tsx`, `src-tauri/src/rrd/estate/lifecycle.rs` | The Stop fix at `src-tauri/src/rrd/estate/lifecycle.rs:580` | Whole |
| System › Estate | `wb/static/app.js:338-376` | | Native, `session.ts`, React; SDK at `sdk/operation.rs:675` | Whole, if a run proves the read answers on an ordinary install |
| System › Capabilities | `wb/static/app.js:272-324` | Full document at `src/rrflow/runtime.ts:120`; badges at `RC/index.tsx:503-531` | React | Whole |
| System › Storage | | `RC/tabs/storage.tsx` | Nothing | Built |
| System › API reference | | `RC/api/index.tsx` | Nothing | Built |
| System › Backups | | `backups`, `createBackup`, `restoreBackup` at `src/rrflow/session.ts:994-1007` | React | New |
| System › Cluster | `wb/static/app.js:1138-1253` | | The engine says it stays absent in alpha | Waits |
| Top bar | `wb/static/app.js:1515-1534` | `src/providers/Commands/commands.tsx` | Depends on Ask › Context | Replaced: keys return, search changes |
| Inspector | `wb/static/app.js:1454-1474` | `RC/inspector.tsx` | Adoption in each new tab | Better: links onward |

### PR F1: move the engine pin

**Why.** `audit-read` fails on ordinary pages at the pin (POAM-030), so Connectome reads one record at a
time (`src-tauri/src/rrd/client.rs:76-81`). The fix landed in RRFlow #144. `rrd-contract` and `rrd-client`
have no differences between the pin and `development/main`, so this should not change the API.

**Files.**

- `package.json:80`. Current:
  `"@rrflow/rrd-client": "github:rrflow/rrflow-development#15f36a8758e32b33c930a20da836def3e5cc3207"`. Target:
  the same with the tip of `development/main`, read when this opens.
- `src-tauri/Cargo.toml:47-48`. Current: `rev = "15f36a8758e32b33c930a20da836def3e5cc3207"` on `rrd-client` and
  `rrd-contract`. Target: the same revision as `package.json`.
- `src-tauri/Cargo.lock` and `pnpm-lock.yaml`, regenerated by their tools.
- `src-tauri/src/rrd/client/process/effects.rs:61`: add a process test reading 64 audit records at once.

**Oracle.** The new test fails on the old pin and passes on the new one. `pnpm check`, the process tests, and
a full capture at both window sizes show no lost screen.

**Stop if** the contract, the OpenAPI digest or an operation differs from what was read here. RRFlow's own
Connectome gitlink is a separate pull request, raised deliberately.

### PR F2: a hover explanation on every control

**Files.**

- New `RC/explain.tsx`, built on today's `Hint` tooltip (`RC/glossary.tsx:249-257`):

  ```tsx
  export interface ExplainButtonProps extends ButtonProps, ElementProps<"button", keyof ButtonProps> {
  	/** What pressing this does, including any effect, in plain words. */
  	why: ReactNode;
  }
  ```

  It wraps Mantine's `Button` in a `Tooltip` with `multiline`, `w={300}`, `withArrow`, `openDelay={150}` and
  `events={{ hover: true, focus: true, touch: false }}`, so the same text opens on keyboard focus.
- Replace all 56 `<Button>` uses, each with a sentence checked against what its handler does:
  `RC/tasks.tsx` (10), `RC/tabs/quantization.tsx` (12), `RC/tabs/records.tsx` (10), `RC/tabs/vectors.tsx` (5),
  `RC/tabs/models.tsx` (4), `RC/tabs/storage.tsx` (3), `RC/index.tsx` (3), `RC/session.tsx` (3),
  `RC/guides/engine.tsx` (3), `RC/guides/cards.tsx` (1), `RC/shell.tsx` (1), `RC/workspace.tsx` (1).
- Status badges and each option of `SegmentedControl` under `RC/` gain the same text. Truncated text gets a
  `title`, as `RC/tabs/records.tsx` already does in `RecordRow`.
- New `scripts/check-explained.mjs`, added to `pnpm check`: fails if a file under `RC/`, other than
  `explain.tsx`, imports `Button` from `@mantine/core`. TypeScript then requires `why`.
- `tests/visual/capture-native.mjs`: a hover walk over each tab that fails if a control shows no tooltip or
  its tooltip leaves the window.
- `tests/visual/PARITY.md`: the hover rule and August's 19 tooltips.

**Stop if** an explanation would state a result the code does not prove, or if the gate cannot tell a raw
button from an explained one.

### PR 6a: History › Stream and the read point

**Native: carry what the view needs.** `src-tauri/src/rrd/view/effect.rs:20-31`. Current:

```rust
pub struct MutationView {
    /// The mutation's wire name, such as `put_record` or `retire_data`.
    pub operation: String,
    /// What it writes: `kind:id` for a record, relation, vector, sample, geo
    /// value or object; the event kind for an event; `schema` for the registry.
    pub target: String,
    /// The other end it attaches to, when it has one: a relation's
    /// `from → to`, or the subject of an event, vector, geo value or object.
    pub subject: Option<String>,
    /// Display values of what it sets, bounded like every other property.
    pub properties: BTreeMap<String, String>,
}
```

Target: add `pub kind: Option<String>`, the record, relation, vector or event kind, so lanes do not parse
`target`. Add `pub valid_from: Option<u64>` and `pub valid_to: Option<u64>`, as the contract gives them
(`contract/lib.rs:2670-2691`). `src-tauri/src/rrd/view/history.rs:79-108` adds `scope` to `ChangeView`, and the
claim's `valid_from`, `valid_to`, `tx_time`, `confidence` and `supersedes_sha256`. `src/rrflow/session.ts:505-515`
mirrors these. The process tests at `src-tauri/src/rrd/client/process/effects.rs:139` assert them.

**Lanes.** New `RC/history/lanes.ts`, pure and shown in a legend so nobody mistakes it for an engine field:

| Lane | Rule, on public fields |
|---|---|
| Reasoning | `family` is `claim` |
| Lifecycle | A record, relation or event whose table `model` in `client.schema()` starts `lifecycle_` |
| Search | `put_vector`, or a `runtime_trace` event with `boundary` of `vector` |
| Storage | `put_schema`, `publish_object_reference`, or a `runtime_trace` event with `boundary` of `kv` |
| Data | Everything else |

August's two lane sets become one, and nothing is hidden. Its `model` and `memory` families had no lane in
Signals. New `scripts/check-lanes.mjs`, run with `node --experimental-strip-types`, feeds each of the ten
`TransactionMutation` names through the rule and fails if one has no lane.

**Reading.** New `RC/history/window.ts`, `useChangeWindow(client, sessionKey)`:

- `client.changes(0, 1)` gives `head_cursor`. Then pages of 256 run forward from `head - 512`, following
  `through_cursor` until `has_more` is false. There is no backward paging, so **Older** reads the 512 cursors
  before the window, with at most 2048 changes held.
- `client.followChanges` runs only while the view is at Latest and on screen, because every read is written to
  the audit journal.

**View.** New `RC/history/stream.tsx`, `RC/history/transport.tsx`, `RC/history/river.tsx`, `RC/history/filmstrip.tsx`:

- First, Rewind, Resume or Freeze, Forward, Latest, a scrubber and speeds of 0.5× to 8×, stepping every
  `850 / speed` ms. With reduced motion, Resume is replaced by plain steps.
- Lanes across one cursor, 160 columns centred on it and 72 when narrow. Clicking a mark freezes it. **Each mark
  gets a hover card,** which August lacked (`wb/static/app.js:979`).
- The frozen change opens in `InspectorObject`: plain words, details and raw. Links lead to the record on Graph
  and to the neighbouring changes. A link to Activity says "around this time", because no public field joins them.
- Filmstrip of every loaded frame, virtualised, with its scroll position kept.

**Read point.** New `RC/readpoint.tsx`, shown through `WorkspaceShell`'s `top`. Freezing sets the point. The bar
says "Reading cursor N of M, as it stood on <date>", with **Back to now**. Views that cannot follow it state their
own coordinate.

**Navigation.** `RC/areas.ts:20-53`. Current area list ends with `reasoning` and `system`. Target: add

```ts
{
	id: "history",
	label: "History",
	icon: iconHistory,
	tabs: [{ route: "history/stream", label: "Stream" }],
},
```

between them, using `iconHistory` from `src/icons.ts:186`, and teach `workspaceRoute` at `RC/areas.ts:58-68` the
`history` section. `RC/index.tsx:399` onward renders the tab behind `session &&`.

**Guide.** `RC/guides/rewind-history.v1.json`: press First, press Forward, click a mark, open Details, finish. The
marks moving are real recorded changes in their real order, which is the animation parking lot 006 asks for.

**Oracle.** The capture walks `wb/tests/workbench.spec.js:209-235` on a real engine: the head badge equals the
engine's `head_cursor`, First and Forward move the cursor, clicking a mark freezes that cursor, and the inspector
shows the same one. It fails if the view shows a change the engine did not return.

**Stop if** a lane needs a field the public record does not carry, or if the read point would merge two stamps.

### The later pull requests, by file

- **6b.** `RC/history/signals.tsx` shares `window.ts` and `lanes.ts`. Its 48-column window follows the cursor,
  fixing August's defect at `wb/static/app.js:476`. Its lens deck lists only real tabs. `RC/history/activity.tsx`
  reads `audit` newest first, which needs `control_sequence` from the read stamp that `src-tauri/src/rrd/view.rs:78-86`
  drops. It pairs `authorized` and `completed` by `request_id`, offers export through `exportAudit` and
  `saveArtifact`, and hides Connectome's own reads by default with a visible switch.
- **6c.** `src-tauri/src/rrd/client.rs:646-657` takes `graph_known_at_cursor` and `graph_valid_at_unix_ms`, and
  `src/rrflow/session.ts:833` and `RC/queries.ts:23-30` carry them. Only the graph section moves
  (`contract/diagnostic.rs:608-628`), so Graph labels its counts accordingly. This is the bi-temporal view: scrub
  Stream, then see the graph as it stood then.
- **7a.** `src-tauri/src/rrd/client/flights.rs`, `src-tauri/src/rrd/view/flights.rs`, three commands, and
  `RC/tabs/flights.tsx`. It shows the prompt, context mode and budgets, the marker with a plain note that nothing
  evaluates it yet, three real events in order, the five plan stages and ranked uses. Same-prompt runs compare by
  `cohort_sha256`. It says plainly that no model runs. **Capture `RuntimeDiagnostics` first,** since no baseline has
  it, then remove it with `src/rrflow/diagnostics.ts`, as `connectome.md:606` requires.
- **7b.** `RC/tabs/claims.tsx` runs `FROM claim AT VALID t KNOWN k PROJECT *`, handles the refusal when no schema
  exists at that cursor, and follows the read point. The capture seed gains claims at
  `src-tauri/src/rrd/client/process.rs`. `src-tauri/src/rrd/client/tasks.rs:57-102` stops dropping `outcome`, the
  open and close times and the budget's deadline, and `RC/tasks.tsx` shows the run in the inspector.
- **8a.** `src-tauri/src/rrd/client/knowledge.rs`, `src/rrflow/knowledge.ts`, `RC/tabs/knowledge.tsx`. Compare and
  swap on `expected_revision`, keeping the draft on conflict. External paths show as configuration only, as
  `connectome.md:709-716` requires. PR #10's file is the reference, not copied code.
- **8b.** `src-tauri/src/rrd/client/context.rs`, `RC/tabs/context.tsx`, showing the engine's five stages, ranked items
  and evidence. The top-bar search and keys reuse it, and its settings are configurable (decision 7 and
  parking lot 008).
- **8c.** The shared layer, each part separately provable:
  - A workspace scope for views, separate from what `src/shell/components/App/hooks/connection.tsx:9-13` watches.
  - A fill mode in `RC/shell.tsx:97-117`, with no `ScrollArea` for a pane that scrolls itself.
  - The whole registry from `src-tauri/src/rrd.rs:129-146`.
  - Remove `useRequireDatabase` from `TablesPane`, `ExplorerView` and `DesignerView`.
  - `src/components/Inputs/index.tsx:31` imports only what it uses.
  - `scripts/check-rrflow-isolation.mjs` also follows `import()`, so a lazy view cannot carry SurrealDB past it.
  - Then the Designer graph, read-only, inside Knowledge › Schema.
- **8d.** Typed cells from `src-tauri/src/rrd/view.rs:166-170`, a keyset next page in place of `Pagination`'s total,
  and rewritten queries in `src/screens/connectome/views/explorer/ExplorerPane/hooks.tsx:35-57`. Prove keyset paging
  with a process test first, since nothing has run it. Add `knowledge/tables`.
- **8e.** Parameters and the plan through `src-tauri/src/rrd/client.rs:101-105`. `src/screens/connectome/views/query/`
  moves onto `src/rrflow/editor.ts`. Selected and rejected paths and read proof go in the result header. The console
  moves here from `RC/tabs/records.tsx:875-1030`, with its captures.
- **8f.** Preview and commit through `previewChange` and `commitChange`, in a drawer opened from the inspector. Native
  errors gain a code and details at `src-tauri/src/rrd/error.rs:12-21`, so a stale commit reads as stale.
- **9a.** Saved profiles and negotiation. **The Stop fix:** the record an engine leaves behind must not be proved as if
  another process wrote it (`src-tauri/src/rrd/estate/lifecycle.rs:580`, `src-tauri/src/rrd/estate/lifecycle.rs:655`).
- **9b.** Capabilities reads the full document, with maturity counts and the surface matrix, without August's crash at
  `wb/static/app.js:306`. Estate adds `src-tauri/src/rrd/client/estate.rs`. **First prove by a run whether an ordinary
  install answers `estate-read`;** reading the code found no installation path that creates the document.
- **9c.** `RC/tabs/backups.tsx`, with restore behind its receipt.
- **L1.** Native adapter for `swag.dev-status/v1` with an explicit loopback configuration, and `RC/tabs/swag.tsx` showing
  training runs, model endpoint state and timings, labelled as SWAG's report.

### Harness

- Re-authored views cannot run in the browser harness, because `RrdSessionClient.requireNative()` throws outside Tauri
  (`src/rrflow/session.ts:794-798`). After 8e, the inherited captures for those views stop and native captures carry them.
  Comparison is by eye against `tests/visual/PARITY.md`, since pixel comparison across harnesses means nothing.
- No component test runner exists, and none is added. Pure rules are held by `scripts/check-*.mjs`, and behaviour by the
  native capture and process tests.

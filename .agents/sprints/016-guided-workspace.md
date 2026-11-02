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

### Found while reviewing

**Around the selection named only the selected dot.** It is older than this sprint:
`baseline/native/83804c3` shows the same. sigma draws its first frame while it is constructed, before
`graph.tsx` binds the label layer's frame handlers, so that frame's labels stayed queued. First mount hid
this with a separate refresh, but changing scope rebuilds sigma without one. Fixed in its own pull
request, and the capture now fails if the labels are missing.

**Stopping an engine reads as a failure.** Not fixed yet; step 9 owns it. After **Stop this engine**, the
endpoint record left behind is proved as if another process had written it. The row says "Another process
recorded an endpoint for this project", then settles on "did not prove itself" and a connection error, for
the engine the person just stopped on purpose. `baseline/window/around-labels` shows the settled row.

### Stop conditions

Stop if a step needs a Next button, if a guide blocks the window under it, or if a guide would claim
something the engine did not return.

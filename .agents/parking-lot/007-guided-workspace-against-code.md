# Guided workspace checked against the code

Status: PARTLY DECIDED, 2026-11-03. The repository owner asked for the plan to be checked against
the existing code before more is built. The owner decided 3, 4, 5 and 7 on 2026-11-03, and decisions 1
and 2 are read from the owner's words below. Decision 6 is open, and parking lot 006 and sprint 016
stand as written on that point.

Paths are at Connectome `998c058f`. `RC/` is `src/screens/connectome/pages/RuntimeConnection/`.
`wb/` is `crates/connectome-ui/` at RRFlow `6448a4f6`, the August Workbench. `contract/` and
`sdk/` are `crates/transport/rrd-contract/src/` and `crates/transport/rrd-client/src/` at the
engine pin `15f36a87`. `connectome.md` is `docs/reference/client/connectome.md` at that pin.

These findings come from reading the code. Nothing new was run, so a few are marked as
inference and are proved by a run when their step opens.

## What the check found

**Confirmed.** Everything from August is still reachable as a reference, and decision 1 of
parking lot 006 stands. Ten of the nineteen August views can return whole or nearly whole on
public operations. Most of the work is in Connectome's own native layer, which no other session owns.

**Five things change the plan.**

1. **"Served" describes the engine, not Connectome.** Parking lot 006's table is headed
   "Engine at `15f36a87`" and is accurate about the engine. Connectome's native layer has no
   command at all for flights, context assembly, estate reads, knowledge trees or attunement,
   and `session.ts` has no method for them. `rrd_query` takes no parameters and drops the plan,
   read manifest and read proof (`src-tauri/src/rrd/client.rs:101-105`,
   `src-tauri/src/rrd/view.rs:154-164`). Errors reach the webview with no code or details
   (`src-tauri/src/rrd/error.rs:12-21`).
2. **Some August data no longer exists in the engine.** See decision 3.
3. **One read point cannot drive every view.** See decision 2.
4. **Re-authoring in place is larger than the plan says.** See decision 6 and the sprint.
5. **Two things the owner wants were never planned:** mouse-over popups as a rule (decision 4)
   and LFG and SWAG tabs (decision 5).

## Decision 1: what to build while turnkey start is blocked

**What.** Step 5 needs the project map, RRFlow #236 and #241, and Connectome #30. All are other
sessions' work and all are open. The project map has no pull request yet. The owner set a strict
order, so moving past step 5 needs the owner's word.

| Option | What | For | Against | Impact | Effort |
|---|---|---|---|---|---|
| **A. Build on (recommended)** | Move to the foundations and History now. Return to step 5 when its dependencies land. | Most of the remaining views need nothing from those sessions. | A new project keeps showing little until step 5 lands. | Sprint 016 order | None |
| B. Hold | Wait for the dependencies. | Keeps the strict order. | Blocks every view on work this sprint does not control. | None | None |

**Read as decided 2026-11-03: option A.** The owner's words: "restore all of my UI from augiust while
authoring it to be properly grouped tooltips and popup modals". The owner did not name this decision,
so this is a reading, and the owner may correct it. Step 5 returns when its dependencies land.

## Decision 2: what the read point means

**What.** Decision 5 of parking lot 006 says "One moving read point drives every view, and the top
bar always says which moment is on screen". The engine cannot do that at the pin.

**Where.** Only rrflowQL (`AT VALID … KNOWN …`) and the graph section of `diagnostics-read` take both
time axes (`contract/diagnostic.rs:41-44`). Vector and context reads take valid time and read at
head. Tasks, flights, schema, knowledge trees, estate, backups and storage counters take neither.
Audit runs on a separate sequence with no link to runtime cursors. No operation maps a clock time
to a cursor. `connectome.md:287-288` forbids merging results from different stamps. Every scrubbed
read is also written to the audit journal, so it adds rows to Activity.

| Option | What | For | Against | Impact | Effort |
|---|---|---|---|---|---|
| **A. Narrow it (recommended)** | The read point drives the views that can obey it: Stream, Signals, Graph, Claims, Query and Records reads. Every other view states its own real coordinate, such as "live counters" or "revision 12". The top bar always says which moment each view shows. | Truthful, and it still delivers the bi-temporal view the owner wants: scrub history, then see the graph as it stood then. | Not every view moves. | Amends decision 5 | Medium |
| B. Keep decision 5 and ask the engine | RRFlow adds historical reads to every family, plus a time-to-cursor operation. | Matches the original words. | Blocks the control on engine work across many owners. | RRFlow roadmap | Large |

**Read as decided 2026-11-03: option A.** The owner's words: "we want ease of use and clear UI favored
and yes we want th engine to do the work build the files and connectome be the ui". The owner did not
name this decision, and option A is the clearer one for a person, so this is a reading the owner may
correct.

## Decision 3: August views the engine can no longer feed

**What.** These views cannot return as they looked, because what fed them is gone. The old Workbench
read physical stores directly, and those record types have since changed or gone.

| View | August showed | Public at the pin | Evidence |
|---|---|---|---|
| Flights | Model, tools, tokens, cache, acceptance; seven stages, four lanes | The `observe` provider only, and no model runs. Every flight has exactly three events. The context event carries five plan stages and ranked uses. | `contract/flight.rs:44-50`, `contract/flight.rs:122-135` |
| Runs | Goal, plan, attempt, observation, decision, verification, outcome | Goal and outcome. Attempts can be read only by a known ID, and nothing lists them. `governed-reasoning-runner` is unavailable. | `contract/reasoning_budget.rs:227-231` |
| Activity | Commands, triggers, durations, recall effectiveness | Audit records: action, principal, decision, status, phase and digests. | `contract/lib.rs:3188-3204` |
| Signals | Six lanes from a Workbench-side rule | No lane field exists. Reads are not in the changefeed, so the routing lane has no source. | `wb/src/lib.rs:1283-1428`, `contract/lib.rs:2702-2713` |
| Stream | An audit record on each change | No public link joins a change to its audit record. | `contract/lib.rs:2702-2713`, `contract/lib.rs:3188-3204` |
| Home | The active reasoning run's timeline | No run records. | as Runs |
| Query lab | Operator pipeline, network and GPU flags | Plan candidates and read proof exist. Those three are not public. | `contract/lib.rs:526-536` |

| Option | What | For | Against | Impact | Effort |
|---|---|---|---|---|---|
| **A. Return what is real, and ask for the rest (recommended)** | Build each view on what the engine serves, and show it plainly as what it is. List the missing data as engine work (below), so each view grows when the engine does. | Real views now. No fabricated data, which `connectome.md:287-288` forbids. | Flights and Runs are smaller than in August until the engine grows. | RRFlow POA&M gets the list | Part of each step |
| B. Wait | Hold these views until the engine serves everything. | Nothing looks reduced. | Holds six views behind engine work with no date. | None | None |

**Engine work to raise with RRFlow,** each checked before it enters the POA&M:

1. A way to list a task's attempts, with times (Runs).
2. Reasoning stage records through the governed runner (Runs, Home).
3. Provider arms for flights, so model and tool lanes exist (Flights, Gate G).
4. A public trace operation, with traced queries and commits (Traces, H-05).
5. A public source-route operation (Search, POAM-032).
6. A link between a change and its audit record (Stream).
7. A bounded transaction preview (edits, POAM-043).

Cluster is different. RRFlow's contract says `clustered_server` "must remain absent from installed and
runtime capability values" and is not an alpha requirement, so that tab returns only when clustering
becomes a supported capability.

**Decided 2026-11-03: option A, with an addition.** The owner's words: "we replace with what it can
serve and have it built with minimal defined schema for establishing naming and patterns that lend
itself to grow and be easy to edit. we want to have components that can be triggered and provide dynamic
a2ui passivek and direct knowledge for the operator to learn". [Parking lot 008](008-views-and-knowledge-surfaces.md)
proposes the design for review.

## Decision 4: what "proper mouse-over popups" means

**What.** The owner asked for proper mouse-over popups. Neither sprint 016 nor parking lot 006 mentions
them as a rule, so this is my reading of the words.

**Where.** Today's popups are glossary terms (`RC/glossary.tsx:249-257`), `ActionButton`
(`src/components/ActionButton/index.tsx:41-55`) and graph dots (`RC/graph.tsx:391-404`). None of the 56
plain `<Button>` uses under `RC/` explains itself. August had one custom graph popup and 19 plain
browser tooltips. Its timeline marks and truncated text showed nothing on hover, so this goes past
August.

| Option | What | For | Against | Impact | Effort |
|---|---|---|---|---|---|
| **A. A rule for every tab (recommended)** | Every button says what it will do, including any effect. Every technical word explains itself. Every mark on a graph or timeline shows what it is. Truncated text shows in full. Icons carry a label. The same text opens on keyboard focus. Text states real behaviour and never implies a result that has not happened. A check fails the build if a button under `RC/` has no explanation. | Teaches at the pointer, and suits the layman direction. New tabs cannot skip it. | 56 explanations to write and verify now. | Every tab | Medium |
| B. Only where confusing | Add popups case by case. | Less work. | It drifts, and no check can hold it. | Some tabs | Small |

**Decided 2026-11-03: option A.**

## Decision 5: how LFG and SWAG reach Connectome

**What.** The owner wants extended tabs for LFG and SWAG. Parking lot 006 says "Learning becomes an area
when the engine serves it", and engine-admitted LFG and SWAG execution is unimplemented
(`docs/reference/inference/lfg-swag.md:3` in RRFlow). `connectome.md:585-590` says external systems appear
"only through their installed RRFlow adapter/capability records and engine-issued observations". SWAG's own
`docs/developer-workspace.md` says Connectome can consume `swag.dev-status/v1` through an adapter. On
2026-11-02 SWAG reported `connectomeIntegrated: false`. LFG's plan names an "integration prototype" that
works through a real RRFlow adapter, and that adapter is draft RRFlow #249.

| Option | What | For | Against | Impact | Effort |
|---|---|---|---|---|---|
| **A. Read-only adapters now, effects through the engine (recommended)** | A Learning area with a SWAG tab that reads `swag.dev-status/v1` from an explicitly configured loopback endpoint, in the native process. It is absent unless configured and labelled as SWAG's own report, never as engine evidence. An LFG tab follows once LFG has a versioned status contract. Launching or selecting anything goes only through Gate G's engine path. | The owner sees real training and model state soon. Default RRFlow readiness is unaffected. | Amends decision 3 of parking lot 006. It also relies on my reading that a labelled, separate read is not the hidden connection `connectome.md` forbids, so the owner should rule on that. | `areas.ts`, native layer | Small to medium |
| B. Engine only | No tab until Gate G projects these records through the engine. | The cleanest reading of the contract. | No LFG or SWAG tab until Gate G lands. | None | None now |
| C. Embed their web pages | Show SWAG's `dev.html` and LFG's Inspector in a tab. | Fast. | A second visual, which decision 2 rules out. SWAG's host and origin checks refuse cross-origin use. | Security review | Small |

**Decided 2026-11-03: option A.** The owner accepted it as written, which includes the reading that a
separate, labelled, explicitly configured read is not the hidden connection `connectome.md` forbids.

## Decision 6: rulings the inherited views need

**What.** Connectome's inherited views hold SurrealQL text and test for vendor classes, so there is no
single seam to re-point (`src/screens/connectome/connection/connection.tsx:340`,
`src/components/DataTable/datatypes.tsx:338-412`). Pointing `useConnectionAndView` at a project starts the
SurrealDB client against the RRFlow endpoint (`src/hooks/routing.ts:56-62`,
`src/shell/components/App/hooks/connection.tsx:9-13`). rrflowQL is one read statement with no comments,
`ORDER BY`, offset or `count`. Several parity items cannot be met as written, and these points need a ruling.

| Question | Recommendation | Why | Alternative |
|---|---|---|---|
| The console in Graph and the editor in Query | **One editor, in Ask › Query.** Graph keeps its buttons, and they open Query with the query filled in. | Two editors would be two sources of truth. The console's captures move with it, as sprint 009's decision 17 allows. | Keep both |
| The mini runner shares three Query panes, and sprint 009 keeps it until a browser deployment exists | **Let the panes move to RRFlow. The mini runner returns with that deployment.** Its baseline stays. Read from source, it cannot start today: `src/adapter/index.tsx:8` looks for `Connectome-mini`, and `tools/mini-embed.html:26` declares `connectome-mini`. | `tests/visual/PARITY.md` already says it is rebuilt when a browser deployment exists. | Copy the panes first, which is a parallel path |
| Inspector column or drawers | **Reading in the 320px column. Editing in a resizable drawer opened from it.** | A record editor does not fit in 320px. The column still holds every object. | Widen the column |
| Designer sections the engine has no data for: permissions, changefeed, drop writes, field assertions | **Not shown until the engine backs them.** Their parity items move to "waits on the engine". | Decision 7 of parking lot 006 and decision 20 of sprint 009 rule out notices. | Show them disabled |
| Functions, Users, GraphQL, Migration | **Stay unreachable until their operations exist,** so the final vendor removal waits for them. | The later decisions outrank V7's capability-state plan. | Delete them, against decision 17 |
| The API reference and the documentation view | **Keep the API reference at System › API reference.** Drop V6's move. The documentation view is retired at the final cut. | It is built and passes its captures. Moving it back would produce a second one. | Re-author both |
| Order inside the inherited views | **Schema graph, then Records, then Query, then edits.** | The Designer graph has the fewest forbidden imports and needs no write path, so it proves the shared layer first. Sprint 009 lists Query first. | Query first |
| Edits on a large estate | **Build edits last, and record the limit until POAM-043 closes.** | A preview reads the whole scope within 10,000 keys (`src-tauri/src/rrd/client/transaction.rs:25-28`). | Wait for POAM-043 first |

## Decision 7: what the top-bar search does

**What.** The parity list says `/` searches loaded objects. It never did. `/` focused a field, and Enter
ran source routing (`wb/static/app.js:1515-1522`), which no longer exists at the pin.

| Option | What | For | Against | Impact | Effort |
|---|---|---|---|---|---|
| **A. Search through context assembly (recommended)** | `/` opens one search box that calls `context-assemble` with the text. Results are the engine's ranked records, each opening in the inspector. The keyboard shortcuts return, fixed so they ignore modifier keys. | A real answer from the engine, using no model. `connectome.md:499` forbids a client-side scan. | Its ranking is the engine's recall, not a file route. | Top bar, native layer | Small once Ask › Context exists |
| B. Keep it for source routes | No search until the engine serves routes. | Matches August's behaviour. | No search for a long time. | None | None |

**Decided 2026-11-03: option A, with an addition.** The owner's words: "and is configurable to improve and
experiment". [Parking lot 008](008-views-and-knowledge-surfaces.md) proposes how. This adds an eighth engine
item to decision 3's list: public controls over context ranking, since `AssembleContext` takes only budgets,
seeds and valid time.

## Later direction, 2026-11-03

The owner, reviewing the Evaluate design: "it also needs to actually align with the visuals of
connectome style tokens and we should have it be dark teal and burnt orange instead of purple and we
should ensure the icon is connectome and we have enhanced layman friend visuals for graphs". So
"today's visual" in parking lot 006 now means Connectome's tokens with dark teal and burnt orange in
place of violet and cyan, applied by changing token values and the mark's gradient, with no change
to the mark's shape. Earlier on the same page: "needs to be grouped better it is flat and overwhelming
no layman will even approach this likely". Asked where the Workbench was: "where is the workbench
shouldnt that be under overview since it is separte". So the testing and comparison Workbench is its
own space under Overview, beside a project's workspace and not inside it. Parking lot 006's Evaluate
area, if any is added to a project's rail, should not be built that way.

The same message sets who owns the work: the engine does it and builds the files, and Connectome is the
UI. The Workbench's screens call public engine operations, and no view keeps its own copy of that work.

## Commit

Decisions 3, 4, 5 and 7 are recorded above, and parking lot 006 and sprint 016 took the changes. When the
owner decides the rest, this file records the outcome. Saying "go" accepts the recommendations in decisions
1, 2 and 6.

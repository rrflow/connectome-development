# Guided workspace: restore the August Workbench in today's visual

Status: COMMITTED, 2026-11-01. The repository owner reviewed a clickable
prototype beside the running Workbench and said "lets fix and go". This is also
the navigation model that sprint 009's step S1 requires before the shell.

## The owner's direction

> we want all of that work that existed in august restored but properly now
> authored under this visual. We need proper tabs and grouping and animated
> interactive components that will actually guide the layman user through new
> complex AI workflows and reasoning. we anchor them and make the barrier of
> entry turnkey

Two readings of those words were put to the owner with the prototype and not
corrected: "this visual" is today's Connectome identity, not the Workbench's
charcoal and mint; "anchor" means guides attach to real on-screen controls and
the project's real data.

## What was lost

The first-party Connectome Workbench was `crates/connectome-ui` in the RRFlow
repository, created in `e1bd7788` on 2026-08-18: 18 views and an inspector. It was
never in this repository's history, so earlier inventories missed it.

| RRFlow commit | Date | Effect |
|---|---|---|
| `98e65511` | 2026-08-27 | Cut `app.js` from 124,096 to 9,956 bytes. Its journal said this was not feature parity and promised to restore the views. |
| `54487226` | 2026-09-03 | Deleted the preserved flight, cluster and connection code, the README saying "Do not delete", and the document promising restoration. |
| `b5db6c28` | 2026-09-04 | Deleted the crate. |

No capture preceded any of it. The cut had a real reason: the crate opened
physical stores directly. That justified changing the data path, not losing the
views. `6448a4f6`, the parent of `98e65511`, was built and run again on 2026-11-01.
Its captures are the reference baseline at
`tests/visual/baseline/workbench/6448a4f/`.

The Workbench is not simply better. Its drill-down stopped after one step, its
local graph rarely narrowed, and it had bugs that `tests/visual/PARITY.md` lists
so they are not carried over. Today's lenses have better wording and let you
follow links from record to record. The inherited views have the schema graph, the
query editor and record editing.

## Decisions

1. **Everything from August returns,** rebuilt on public engine operations. Option
   B of the 2026-09-16 plan stands: reference input, never copied code.
2. **One window.** Areas on the left, tabs across the top, an inspector on the
   right. Each pane scrolls by itself and no page-level scroller remains. Every
   screen is judged at a real window size, 1440x900 and 1366x768.
3. **Six areas.** See the table below. Project, estate and domain stay in view at
   the top. Learning becomes an area when the engine serves it.
4. **Three depths on every object:** plain words, details, raw evidence, plus
   links onward. No object is a dead end.
5. **Time is a control for the whole app.** One moving read point drives every
   view, and the top bar always says which moment is on screen.
6. **Plain words by default.** A newcomer comes first and full depth stays one
   click away. This supersedes the 2026-09-16 audience order.
7. **A view exists only when it is real.** A tab appears when the engine serves
   what it needs. No notices, as decision 20 of sprint 009 requires.

## The guide contract

A guide is one of the product's main features, so these rules are binding:

- **Anchored.** Each step points at a real control or a real object on screen.
  There are no separate tour screens, and if the anchor is absent the guide says
  why.
- **You do the step.** A step finishes when the action really happens and, for any
  effect, when the engine returns its receipt or read stamp. There is no Next
  button. UI state never upgrades evidence.
- **Your data.** Guides run on the open project. An empty project gets a labelled
  sample estate on a real engine, never a fake one.
- **Animation carries meaning.** A moving token is a real recorded event in its
  real order, and it can be paused, rewound and scrubbed. Reduced-motion settings
  turn it into plain steps with no loss of information.
- **Guides are data.** Each is a versioned file naming steps, anchors and the event
  that ends each step, so a new workflow gets a guide without new app code.
- **Leave at any time.** Leaving changes nothing, and a guide never blocks the
  controls underneath it.

No new runtime library is needed: `sigma`, `graphology`, `@xyflow/react`, `elkjs`,
`lottie-web` and `react-resizable-panels` are already declared.

## Turnkey start

Open the app, pick a folder, approve one plain summary of what will be added, and
watch the project fill in, with no terminal and no configuration. The one approval
stays because RRFlow's rules require explicit authorization before it changes a
project. Removing it would be the owner's decision and an RRFlow change.

This depends on engine work other sessions own: the project map, adopting a
leftover `.rrflow` folder (RRFlow #236), and reading source files (RRFlow #241),
plus the plan controls in Connectome #30. Until those land, a new project shows
little, which is why today's window reads "1 records · 0 relations".

## Where every view goes

| View | Origin | New home | Engine at `15f36a87` |
|---|---|---|---|
| Runtime overview | Workbench | Start › Home | Served |
| Connection profiles | Workbench | System › Instances | Served |
| Estates | Workbench | System › Estate | Served |
| Tables | Workbench | Knowledge › Records | Served |
| Data models, Runtime schema | Workbench | Knowledge › Schema | Served |
| Runtime graph | Workbench | Knowledge › Graph | Served |
| RRFlowQL contract lab | Workbench | Ask › Query | Served |
| Source routes | Workbench | Ask › Search | Needs a public operation |
| Prompt flights | Workbench | Reasoning › Flights | Served |
| Reasoning runs | Workbench | Reasoning › Runs | Partly served |
| Claims | Workbench | Reasoning › Claims | Partly served |
| Causal traces | Workbench | Reasoning › Traces | Needs a public operation |
| Temporal stream | Workbench | History › Stream | Served |
| Signal observatory | Workbench | History › Signals | Served |
| Activity | Workbench | History › Activity | Served |
| Cluster history | Workbench | System › Cluster | Needs a public operation |
| Capabilities | Workbench | System › Capabilities | Served |
| Inspector | Workbench | Right pane, every view | Served |
| Global search, keyboard lenses | Workbench | Top bar | Served |
| Records and relations graph, console | Lenses | Knowledge › Graph | Served |
| Vectors map, TurboQuant | Lenses | Knowledge › Vectors | Served |
| Data models lens, glossary | Lenses | Knowledge › Schema | Served |
| Storage engine | Lenses | System › Storage | Served |
| API reference | RRFlow | System › API reference | Served |
| Tasks, controller proposals | RRFlow | Reasoning › Tasks | Served |
| Instance lifecycle | RRFlow | System › Instances | Served |
| Schema designer graph | Inherited | Knowledge › Schema | Served |
| Query editor, graph results | Inherited | Ask › Query | Served |
| Table explorer, record inspector and creator | Inherited | Knowledge › Records | Served |
| Knowledge paths editor | Closed PR #10 | Knowledge › Knowledge paths | Served |
| Backups, restore, export | Native client | System › Backups | Served |
| Context assembly | New | Ask › Context | Served |
| Plans and handoffs | Connectome #30 | Reasoning › Plans | Partly served |

The remaining inherited views (functions, users, GraphQL, parameters, migration,
map, embed) keep decision 18's plan in sprint 009. Each gets a tab when the engine
serves it, and parameters become query variables.

## Delivery

Sprint [016](../sprints/016-guided-workspace.md) holds the ordered steps.

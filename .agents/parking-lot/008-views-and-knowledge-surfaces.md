# Views that grow, and knowledge that can be triggered

Status: PROPOSED, 2026-11-03. The repository owner set the direction while deciding parking lot 007.
The design below is a reading of that direction, written for review. No code follows until the owner
has reviewed it.

Paths use parking lot 007's prefixes, at Connectome `84a52496`.

## The owner's direction

On decision 3 of parking lot 007:

> we replace with what it can serve and have it built with minimal defined schema for establishing
> naming and patterns that lend itself to grow and be easy to edit. we want to have components that can
> be triggered and provide dynamic a2ui passivek and direct knowledge for the operator to learn

On decision 7:

> and is configurable to improve and experiment

Three readings of those words need the owner's check:

1. "a2ui" is the [A2UI protocol](https://a2ui.org/): declarative UI messages, drawn only from a catalog
   of components the client has approved. It carries data and no executable code.
2. "Passive" knowledge appears as the operator works, without being asked for. "Direct" knowledge is
   what the operator asks for.
3. "Easy to edit" means a short file in this repository, with a check that says what broke. Editing
   inside the app is open question 1.

## View definitions

`WorkspaceTab` in `RC/areas.ts` holds a route and a label, and everything else about a view lives in its
component. Each replaced view starts from one short file instead, in the same pattern as guides:

```json
{
	"id": "history-activity",
	"version": 1,
	"area": "history",
	"label": "Activity",
	"route": "history/activity",
	"needs": ["audit-read"],
	"object": "audit-record",
	"render": "table",
	"fields": [
		{ "name": "action", "from": "action", "label": "What was asked" },
		{ "name": "decision", "from": "decision", "label": "Allowed or refused" },
		{ "name": "phase", "from": "phase", "label": "How far it got" }
	]
}
```

- **Naming.** The id is `<area>-<tab>`, the route is `<area>/<tab>`, and the file is
  `<id>.v<version>.json`, as guides already do. `name` is Connectome's stable name, `from` is the engine's
  field, and `label` is plain words.
- **How a view grows.** The Raw depth always shows everything the engine returned, so a new engine field
  is visible with no edit. One more line in `fields` promotes it into the view and the Details depth.
- **Nothing is guessed.** A field the engine did not return shows as unknown, and `connectome.md:287-288`
  still applies.
- **Visuals stay authored.** `render` names `table` or a component, such as Stream's river. The file names
  a visual and does not draw it, so today's visual stays the only one.
- **What it does not hold.** No queries, layout, conditions or logic. Something that needs those is a
  component. This follows ADR-0002's progressive formalization: small and closed at the boundary, and
  extended by new versions.
- **One owner.** `WORKSPACE_AREAS` is built from these files. A new `scripts/check-views.mjs`, in
  `pnpm check`, fails on an operation the pinned catalogue lacks, an unknown area, a repeated route, or a
  `from` the pinned contract lacks. Decision 7 of parking lot 006 still holds: a tab is listed only when
  its view is real.

## Knowledge surfaces

An entry needs only a trigger and text. It names an A2UI surface only when it needs more than text. The
`graph-around` anchor below is real:

```json
{
	"id": "graph-around",
	"version": 1,
	"mode": "passive",
	"on": { "hover": "graph-around" },
	"text": "Shows only this record and what it touches. Nothing changes in the project."
}
```

### Triggers

| Mode | Trigger | What the operator gets | First in |
|---|---|---|---|
| Passive | Hover or keyboard focus on a control | What it does, including any effect (decision 4) | F2 |
| Passive | Selecting an object | Its plain-words depth, from the view's fields | K2 |
| Passive | A refusal or an empty result | Why, and what would work instead | K2 |
| Passive | A mark on Stream | What that change was, in a hover card | 6a |
| Direct | "Explain this" on a control or object | The full surface, in the inspector | K2 |
| Direct | `/` or Ask › Context | Ranked records and the evidence for each | 8b |
| Direct | Starting a guide | The guide engine, which is built | Built |
| Direct | Asking a model | A model-written surface, labelled as one | K3 |

The refusal trigger needs a code to match on. Errors reach the webview with no code or details today
(`src-tauri/src/rrd/error.rs:12-21`), so that part of 8f moves to K2. RRFlow's comparison lab shows why it
matters: a filtered TurboQuant search is refused with "no vector access path satisfies the request
contract", and that sentence alone teaches an operator nothing.

### Who may write a surface

| Source | Example | How it is labelled | Its data | When |
|---|---|---|---|---|
| Authored | A file in this repository | An explanation | Engine reads, bound by JSON Pointer | K2 |
| Built from an engine reply | Context results | With the read stamp | As the engine returned it | 8b |
| A model or another agent | A model explaining a run | "Written by <model>, not engine evidence" | Only what the request was authorized to send | K3 |

### Rules

These bind in the same way as the guide contract in parking lot 006:

- **Data, never code.** Only components in Connectome's catalog render. Anything else is refused visibly.
- **Passive stays out of the way.** It never takes focus, moves the layout or blocks a control, and reduced
  motion is honoured.
- **Surfaces cannot commit.** A surface's actions are named: open a tab, open an object, start a guide,
  copy. Anything with an effect opens the existing preview and commit path and ends in the engine's receipt.
- **True when shown.** A surface states what the engine returned or what the code proves, and never implies
  a result that has not happened.
- **Stamps stay honest.** A surface that reads engine data shows its read stamp and never merges two.
- **Asking a model is an external effect.** It needs explicit configuration, authorization and a budget.
  Nothing calls a model by default, and default readiness never depends on one.

A new `scripts/check-knowledge.mjs`, in `pnpm check`, fails on a trigger that names a missing anchor or
signal, or a surface that does not validate against the catalog.

## Renderer

What A2UI offers, read from its specification on 2026-11-03: four messages (`createSurface`,
`updateComponents`, `updateDataModel`, `deleteSurface`), a flat component list, JSON Pointer bindings, and
a catalog defined as JSON Schema, including custom catalogs. It is transport-agnostic. v0.9.1 is its current
release and v1.0 is a candidate. Its README calls the project an early-stage public preview.

| Option | What | For | Against | Effort |
|---|---|---|---|---|
| **A. The official renderer with our catalog (recommended)** | `@a2ui/react` pinned to exactly 0.15.0, on its v0.9 path, with a Connectome catalog whose components are Mantine. | Binding, templates and validation come from the protocol's own project. Agent-sent surfaces use the same path later. | Before 1.0 and moving: 0.15.0 was published on 2026-11-02. It adds `@a2ui/web_core` (8.5 MB unpacked), `zod`, `clsx`, `markdown-it` and `@a2ui/markdown-it`. Not yet run here. | Medium |
| B. Our own subset | A small renderer for the parts we use, validated against A2UI's schemas. | No new dependency. | We own conformance, and agent-sent surfaces would mean rework. | Medium |
| C. A private format | Our own JSON, no protocol. | Least work. | It is not A2UI, so no outside agent could target it. | Small |

Option A amends parking lot 006's "No new runtime library is needed". K2 **stops and falls back to B** if the
renderer cannot draw through Mantine without a second visual, or if K2's measured bundle growth is more than
the owner accepts.

## Configurable search

`context-assemble` takes `seeds`, `max_graph_depth`, `max_items`, `max_output_bytes`, `max_storage_keys` and
`valid_at` (`contract/memory_context.rs:20-30`). Each result lists the evidence that found it: seed, text,
graph or vector.

- **Profiles.** A named set of those settings, as a file in the same pattern as a view. The search panel can
  change them and save a new one.
- **Compare.** The same query under two profiles, side by side, showing what moved and why. Each column shows
  its read stamp, and the view says when the stamps differ, because `connectome.md:287-288` forbids merging them.
- **What cannot be configured yet.** Ranking itself: fusion and turning a source on or off. `AssembleContext`
  denies unknown fields, so this needs a public engine change. It is the eighth engine item in parking lot 007.
- **The engine's configuration stays out of reach.** A profile only shapes one request. Connectome still never
  edits `.rrflow/config.toml`.
- **Measuring.** A profile shows what changed, not that it improved. RRFlow's comparison lab (#253) tests vector
  search only today. A context-recall test on a labelled set would turn a change into a measured one, and is
  separate work.

## Order

These take effect after review, and all follow F1, so decision 1 of parking lot 007 still comes first.

| PR | What | Waits on |
|---|---|---|
| K1 | Definitions for today's 8 tabs, `check-views`, and `WORKSPACE_AREAS` built from them. No visible change. | Review |
| F2 | As planned, but the text lives in a knowledge file behind one `Explain` trigger instead of inline `why` props. | K1 |
| 6b | The first replaced views, on definitions. | F2 |
| K2 | The renderer, the catalog, "Explain this", and refusal surfaces with native error codes. | Open question 2 |
| 8b | Search with profiles and compare. | K2 |
| K3 | Model-written surfaces. | Its own review, and an engine path through Gate G |

**Stop if** a definition starts needing logic, `check-views` cannot read field names from the pinned contract,
or a surface would show something the engine did not return.

## What this does not settle

- **OBJ-11.** RRFlow's objective asks for operator-defined views as "versioned, authorized, removable definitions
  over the public operation catalogue". These files are a Connectome-side start and do not meet it. Authorization
  and the engine-owned parts stay with RRFlow.
- **Evaluate.** A comparison-lab report carries metrics, dimensions, verdicts and views, so Evaluate could use the
  same definitions and catalog. That would make it the real test of "dynamic". It still needs its own design review
  and is not in this sprint.

## Open questions

1. **Where is a view edited?** Recommended: in files first. In-app editing comes with OBJ-11's authorized
   definitions, because an edit made in the app is a stored, operator-owned change.
2. **Which renderer?** Recommended: option A.
3. **Can an operator turn passive surfaces off?** Recommended: yes, apart from hover text, which decision 4 makes
   a rule.

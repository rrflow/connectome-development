# Sprint 010 — Connectome experience reference map

**Status**: DRAFT — review before execution  
**Source**: Parking Lot 005 (committed Option B)  
**Priority**: P0 product-definition prerequisite  
**RRFlow reference revision**: `4513c68048955efd3a55f80be685ed0d60203a2d`

## COSTAR profile

- **Context**: Connectome is one standalone Tauri product. RRFlow contains a
  small client-only workbench and preserved behavior inventory that are product
  references, not code/runtime dependencies.
- **Objective**: Produce one reviewable map from proven RRFlow workflows and
  evidence to Connectome's cohesive navigation and progressive drill-down.
- **Style**: Senior-developer workbench, information-dense summaries,
  progressive disclosure, canonical RRFlow names, explicit evidence classes.
- **Tone**: Methodical and evidence-first; no placeholder claims.
- **Audience**: Senior operators/developers first, with understandable state and
  next actions for less-expert operators.
- **Response**: One concise product-reference document and aligned top-level
  links. No product code or source moves in this sprint.

## Goal

Define what Connectome will author before implementing another visual slice.
This sprint does not copy, embed, or import the RRFlow UI.

## Task 1 — Author the reference crosswalk

### Source anchors

- `../rrflow-g02-w01/crates/connectome-ui/static/index.html:12-29` — instance
  context, Overview, Models, Graph, Activity, Capabilities, Query, Raw Snapshot.
- `../rrflow-g02-w01/crates/connectome-ui/static/app.js:61-100` — the content
  projected by each reference view.
- `../rrflow-g02-w01/crates/connectome-ui/src/lib.rs:71-175` — authenticated
  session, diagnostic snapshot, capabilities, query, and runtime-tool boundary.
- `../rrflow-g02-w01/crates/connectome-ui/migration/README.md:3-22` — prompt
  replay/context/traces, cluster telemetry, and connection-profile behaviors.
- `README.md:14-42` — Connectome's current behavior and evidence limitations.
- `src/screens/connectome/pages/RuntimeConnection/index.tsx:23-239` — current
  public bootstrap projection.

### Output

Create `docs/reference/product/connectome-experience.md` with one crosswalk row
per reference behavior. Each row must name:

1. operator question and job;
2. RRFlow reference source;
3. Connectome destination view;
4. summary, detail, and raw-evidence drill-down;
5. required generated RRD operation/artifact;
6. read/write scope and confirmation/receipt semantics;
7. evidence level required for acceptance; and
8. status: available, contract-blocked, or not yet authored.

The document must include at least Overview, Models, Graph, Activity,
Capabilities, Query, Raw Evidence, Configuration & Access, Prompt Trail,
Traces, Cluster/Operations, Connection Profiles, and Host & Provider
Integrations. The integration row must link Parking Lot 006 and separately show
host-hook coverage, OpenAI/Anthropic API-catalog coverage, RRFlow-operation
projection, installation/scope, drift, and conformance status.
`Contract-blocked` is an honest state, not a placeholder implementation.

## Task 2 — Define the cohesive information architecture

In the same document, define one Connectome shell with stable destinations and
contextual drill-down. It must specify:

- persistent selected RRFlow instance, scope, connection/session evidence, and
  current read stamp;
- global at-a-glance health and actionable failures;
- feature destinations organized by operator task, not the old implementation
  folders;
- keyboard/search/command access appropriate for repeated senior-dev use;
- detail drawers or routes that retain context and expose structured evidence;
- raw contract/payload views as the deepest level, never the default level;
- write previews that show path/scope, exact effect, validation, and required
  confirmation before invoking a real typed operation; and
- success states backed by returned receipt/stamp/identity rather than local UI
  optimism.

Do not prescribe a component tree or visual styling before the first feature
slice proves the pattern.

## Task 3 — Align active entry documents

Update only:

- `README.md` to link the product experience reference and state the
  reference-driven reauthoring rule; and
- `docs/reference/engineering/architecture.md` to link the product contract
  without duplicating its navigation matrix.

Do not change feature source, routes, styles, test fixtures, dependencies,
lockfiles, CI, remotes, or either repository.

## Verification

- every RRFlow reference view and preserved behavior has a crosswalk row;
- every proposed Connectome destination has an operator job, authority, and
  acceptance evidence;
- every write-capable destination identifies its real operation and result;
- unsupported operations are marked contract-blocked, not simulated;
- `rg` confirms no instruction to embed, copy, or source-import RRFlow UI; and
- `git diff --check` passes with no product-code changes from this sprint.

## Definition of done

The next implementation sprint can select one row and know what to preserve,
what to improve, which public artifact it requires, what the UI writes or
reads, and how completion will be proven—without treating the RRFlow UI as a
second application.

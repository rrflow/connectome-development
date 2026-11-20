# Restore workspace access at startup

Status: implementation pending; no capability-parity completion claim.
Owner: Gate H / H-06, native client requirement and no-loss visual requirement.
Baseline: `7cbe1f10b248e6477dc2c5b46581a639a6337344`.
Driver: this RRFlow recovery session. Parent engine PR440 remains draft.

## Change brief

The existing sidebar asks `useConnectionAndView` for an inherited connection;
that hook explicitly excludes runtime profiles. Consequently the native app
shows only Overview and Mini outside a project's nested area rail. The original
workbench, query, schema, records and storage views exist but cannot be discovered
from startup. The home hero consumes space while engine management is a dialog.

Use the existing route catalogue for native navigation at startup and in a
project. Preserve every route and tab, the current views and their interactions.
Move the area rail to the application sidebar instead of rendering two rails.
Offer explicit project selection when no runtime project is selected; never
silently choose a project or start a process on navigation. Keep direct local
start and remote connection controls visible. Reduce the home hero and expose
actual local-engine counts without calling a saved profile connected.

Scope: `src/screens/connectome/{sidebar,project-navigation,index}.tsx`, existing
screen styles; `src/features/runtime/shell/shell.tsx`; overview presentation;
default sidebar preference; focused browser tests; this journal and index.
The route catalogue, native engine registry, session and public RRD operations
remain their existing owners. No mock data or client-side execution policy is
introduced. Cloud synchronization is missing and must not be labelled connected.

Read: sidebar and screen composition, complete project layout and view gate,
workspace shell, project-menu generation, routing hooks, native engine resolver,
preview/serve flow, project manager and row controls, installation summary,
overview/local card, navigation icon, existing styles, defaults, native client
requirement, parity checklist and existing smoke fixtures. Historical commits
`8a9eb5e5` and `58a3aeae` exist but dry-run merges conflict; branch ancestry is
not absorption proof. The inherited visual baseline `38142b7` is still tracked.

## Recovery order and boundaries

1. This package: visible tools and truthful local start, preserving existing views.
2. Recover query/explorer/designer interactions in their existing feature folders
   through the typed native client, with before/after visual and installed tests.
3. Assign missing engine operations to the contract catalogue and `rrd-engine`;
   no UI substitute for transactions, functions, access administration or sync.
4. Join task/controller execution to the prompt workbench and engine receipts;
   its observe flight currently records a prompt without running a model.
5. Qualify temporal recall, constraints/lexicon, storage and cloud synchronization
   against their owning gates. Do not erase gaps by renaming or hiding controls.

The current ledger classifies 134 capabilities as engine-present/UI-missing,
47 partial, 99 requiring engine work and 9 missing. These are audit inputs,
not an exhaustive current SurrealDB/Qdrant parity proof. Each recovered behavior
needs its original source, canonical destination, test oracle and remaining gap.

## Acceptance and stop conditions

Before/after: an empty startup exposes all route-derived areas and Workbench;
choosing a tool without a project asks for one without network effects; selecting
a saved project opens the exact view; existing project switching and all 33 smoke
journeys continue to pass. Verify desktop start/serve/readback independently;
browser fixtures prove navigation only. Run focused smoke, `pnpm check`, build,
full smoke, candidate and merge-group gates. Inspect desktop at normal and narrow
widths. Stop on lost route/action, cross-project state leakage or weakening of an
existing oracle. No native engine change is planned in this UI package.

Research: local code/history establishes this defect; no external API adaptation.
Resource: reuse existing isolated targets, four Cargo jobs, no cache deletion.
Trace: preserve actual failed startup/engine-selection evidence in parent POAM-093.

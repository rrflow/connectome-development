# Parking Lot 002 — Real configuration, filesystem grants, and evidence tabs

**Status**: OPEN — requirements captured; no implementation decision committed  
**Date**: 2026-09-16  
**Source**: Operator direction after Sprint 008 C0 review; RRFlow H-06, R2, and R3 boundaries

## COSTAR profile

- **Context**: Connectome currently renders only a three-public-GET bootstrap.
  Its authenticated native prototype is not wired to a screen, its profile
  stores inherited credential/database fields, and RRFlow currently advertises
  configuration for inspection but has no catalogued public configuration
  mutation operation.
- **Objective**: Evolve Connectome into a layman-friendly application that can
  perform and verify real RRFlow configuration and data operations, explicitly
  scope project/external filesystem access, and show the observable trail from
  a prompt through RRFlowDB, retrieval/vector work, Arrow/DataFusion when
  selected, multimodal adapters, and the final result.
- **Style**: One capability-backed tab and one real operation at a time. Every
  mutation uses preview/apply, authorization, a stable operation identity, and
  an engine receipt. No static lifecycle, broad generic JSON tunnel, direct
  storage access, or sibling-source dependency.
- **Tone**: Safety- and evidence-first. The UI must be understandable to a
  non-specialist without concealing unavailable, denied, partial, stale, or
  uncertain states.
- **Audience**: The operator configuring a project, future maintainers, and
  reviewers tracing whether a displayed claim came from the real engine.
- **Response**: A committed boundary decision followed by independently
  reviewed implementation packages. This parking-lot item writes no product
  code and creates no engine operation.

## What

Five connected decisions must be made before authoring the post-C0 UI:

1. how Connectome performs a real RRFlow configuration write;
2. how the operator grants the project root, selected external paths, or an
   explicit all-path scope without turning the renderer into filesystem
   authority;
3. which capability-driven tabs appear and in what implementation order;
4. what a layman-friendly “last prompt trail” may display; and
5. how RRFlowDB, native vector retrieval, Arrow/DataFusion, and multimodal
   adapters remain one engine-owned path rather than separate UI connections.

## Where

### `src/types.tsx:134-179`

The current `Authentication` and `Connection` models serialize username,
password, namespace, database, token, and inherited query/view state. A runtime
profile adds only `target` and `runtimeInstance`:

```ts
export interface Authentication {
	mode: AuthMode;
	protocol: Protocol;
	hostname: string;
	username: string;
	password: string;
	namespace: string;
	database: string;
	token: string;
	// ...
}

export interface Connection {
	id: string;
	name: string;
	target?: "runtime" | "diagnostics" | "control-plane";
	runtimeInstance?: string;
	// inherited database/query/view fields
	authentication: Authentication;
}
```

The target needs a minimal non-secret installed-runtime profile and an opaque
native connection handle. Filesystem grants and session identities cannot be
stored as renderer secrets or inferred from these inherited fields.

### `src/screens/connectome/pages/CreateConnection/index.tsx:61-120,440-523`

The current runtime flow accepts only an HTTP(S) host and optional expected
instance, then persists the profile and navigates immediately:

```tsx
draft.target = "runtime";
draft.authentication.hostname = runtimeURL?.host ?? "localhost:9477";
draft.authentication.mode = "none";
// ...
<TextInput label="RRD HTTP host" />
<TextInput label="Expected instance ID (optional)" />
```

There is no installed-project chooser, native credential handoff, path grant,
configuration preview, or engine receipt.

### `src/screens/connectome/index.tsx:149-187`

Runtime, client-owned diagnostics, and client-owned control-plane pages are
separate routes. Every inherited connection view redirects a runtime profile
to one monolithic page:

```tsx
<Route path="/runtime/:id">
	{({ id }) => <RuntimeConnectionPage id={id} />}
</Route>
```

A real workspace must replace this with one runtime shell whose tabs derive
from the validated operation/capability catalogue.

### `src/rrflow/runtime.ts:1-340`

The renderer owns handwritten response models and old deployment vocabulary;
`RrdAuthenticatedClient` accepts `api_key` and exposes session identity through
a serializable result. It offers only capabilities, diagnostics, context, and
disconnect calls. It has no generated configuration, grant, transaction,
query, trace, vector, analytical, or multimodal operation.

### `src/screens/connectome/pages/RuntimeConnection/index.tsx:23-241`

After C0, this page truthfully shows only observed public bootstrap evidence.
It has no tabs and performs no authenticated mutation. That is the correct
starting point; it must not be expanded with static sample state.

### RRFlow owning records

- `docs/reference/client/connectome.md`: Connectome is a projection client;
  mutations name catalogued operations and exact resources and return engine
  receipts/evidence.
- `docs/research/rrflow-canonical-estate-configuration-and-runtime-controls.md`:
  active configuration is engine-owned; direct TOML editing is not
  reconfiguration; R2 plans `configuration inspect`, `configure plan`, and
  `configure apply`; R3 owns bounded reasoning and graph/BM25/vector/RRF plus
  Arrow/DataFusion selection evidence.
- `docs/reference/operations/estate-control.md`: the only current public estate
  operation is authenticated read; no public estate mutation is catalogued.
- `docs/architecture/system-overview.md`: RRFlow's vector subsystem is native
  to RRFlowDB; DataFusion computes over stamped Arrow batches selected by
  `RrdEngine` and cannot authorize or commit state.

## Why this cannot be implemented as one UI patch

- A React or Tauri edit of `.rrflow/config.toml` would bypass the planned
  revision, digest, authorization, stale-plan rejection, audit, restart, and
  receipt contract.
- “All files” is a materially broader security grant than the installed
  project root. Its read/write/effect semantics, exclusions, symlink and mount
  handling, revocation, and evidence must be owned by a typed engine contract.
- Current generated/published client and installed credential handoff
  prerequisites are incomplete.
- Current public operations cannot truthfully power configuration mutation,
  complete prompt trails, or every retrieval/analytical/multimodal tab.
- Implementing all tabs together would preserve inherited authority and make
  failures impossible to localize. Each lens needs one real operation and
  acceptance corpus first.

## Decision 1 — configuration write boundary

### Option A — renderer writes project configuration

- **Description**: React serializes fields directly into project configuration.
- **Pros**: Fastest visible edit flow.
- **Cons**: Exposes paths/credentials to renderer state; bypasses engine
  authority, preview, revision, authorization, audit, and receipt; cannot
  reconcile restart or concurrent changes.
- **Impact**: Creates a second configuration authority and violates the current
  RRFlow contract.
- **Effort**: Small implementation, unacceptable product semantics.

### Option B — Tauri writes project configuration directly

- **Description**: Renderer sends a form to a native command that edits TOML.
- **Pros**: Keeps raw filesystem access out of React.
- **Cons**: Still bypasses `RrdEngine`, configure plan/apply, active revision,
  policy, audit, and receipts; native location does not make the write
  authoritative.
- **Impact**: Creates a second native configuration authority.
- **Effort**: Medium, unacceptable product semantics.

### Option C — generated RRD configure inspect/plan/apply (recommended)

- **Description**: Connectome renders the live configuration revision, submits
  a typed desired change, displays the engine's immutable preview/digest and
  operational impact, then applies that exact plan through an authenticated
  native session and renders its receipt.
- **Pros**: Real write, one authority, stale-plan rejection, audit, restart
  continuity, cross-surface parity, and clear layman confirmation.
- **Cons**: Blocked until RRFlow R2 catalogs the operation and the generated
  client plus secure installed credential handoff are packaged.
- **Impact**: Adds Configuration & Access UI only after C1/C2 and engine R2.
- **Effort**: Large across engine/client; medium in Connectome after handoff.

## Decision 2 — filesystem scope and grants

### Option A — installed project root only

- **Description**: RRFlow can read/write only its explicitly installed project
  root and RRFlow-owned state beneath it.
- **Pros**: Smallest authority; easiest containment and explanation.
- **Cons**: Cannot cover external source trees, media estates, shared datasets,
  or other operator-selected folders.
- **Impact**: No general external-path grant UI.
- **Effort**: Small.

### Option B — project default, selected roots, or explicit all-path grant (requested)

- **Description**: The default is the installed project root and descendants.
  The operator may add individually selected canonical roots or deliberately
  choose an advanced all-path scope. Read, write, execute, and external-effect
  rights remain separate. “All” means everything visible to the native
  process's OS identity under engine policy; it never bypasses OS ACLs.
- **Pros**: Matches the requested layman workflow while keeping ordinary use
  bounded; explicit roots are inspectable and revocable.
- **Cons**: All-path authority is high risk. The engine contract must define
  exclusions, canonicalization, symlink/junction/mount replacement, TOCTOU,
  network shares, device paths, revocation, and audit before the UI can offer
  it.
- **Impact**: Requires a catalogued grant plan/apply/revoke family, native folder
  picker, redacted display labels, policy checks, and adversarial platform
  tests. The renderer stores only non-secret grant summaries/identities.
- **Effort**: Large.

### Option C — policy presets without arbitrary path entry

- **Description**: Offer Project, Project + selected data folders, and a managed
  workstation preset whose exact paths are resolved by native policy.
- **Pros**: Friendlier wording and fewer dangerous text fields.
- **Cons**: Presets can hide authority and may not meet unusual project layouts;
  still needs the same engine grant contract.
- **Impact**: Adds preset metadata over Option A or B.
- **Effort**: Medium after the grant contract exists.

## Decision 3 — workspace/tab structure

### Option A — one comprehensive dashboard

- **Description**: Add configuration, data, retrieval, prompt, and media cards
  to the current runtime page.
- **Pros**: One route and fast mockup.
- **Cons**: Sweeping, hard to verify, encourages static placeholders, and
  cannot communicate capability/operation boundaries clearly.
- **Impact**: Repeats the pre-C0 failure mode.
- **Effort**: Large and coupled.

### Option B — capability-driven runtime tabs, delivered one at a time (recommended)

- **Description**: Keep one runtime shell and progressively add:
  1. Overview & Connection;
  2. Configuration & Access;
  3. Data & Query;
  4. Retrieval (graph/BM25/vector/RRF);
  5. Prompt Trail & Evidence;
  6. Media & Adapters; and
  7. Operations & Audit.
  A tab appears enabled only when its required catalogued operations are
  available. Unavailable tabs may explain their exact blocker without
  fabricating content.
- **Pros**: Layman-friendly separation, incremental proof, direct capability
  mapping, and bounded tests.
- **Cons**: Requires a shared runtime-session/view-model shell and careful
  navigation migration.
- **Impact**: Replaces separate client-owned diagnostics/control routes and
  inherited database screens only as typed replacements land.
- **Effort**: Medium per tab over several packages.

### Option C — restyle inherited tabs first

- **Description**: Keep the old query/database screens and relabel them as
  RRFlow tabs before the generated operations exist.
- **Pros**: Fastest visual breadth.
- **Cons**: Renames alternate authority, obscures real evidence, and makes
  later removal harder.
- **Impact**: Violates direct convergence and the C0 truth boundary.
- **Effort**: Medium, unacceptable product semantics.

## Decision 4 — “last prompt trail” content

### Option A — raw prompt and hidden reasoning transcript

- **Description**: Show raw model chain-of-thought and every payload.
- **Pros**: Appears maximally detailed.
- **Cons**: Exposes private reasoning, secrets, project content, and unbounded
  data; the engine contract explicitly does not export chain-of-thought.
- **Impact**: Security/privacy violation and unbounded rendering risk.
- **Effort**: Unacceptable.

### Option B — correlated observable evidence trail (recommended)

- **Description**: For the latest selected request, show request/operation/run
  identity, sanitized prompt label or digest, exact instance/resource/read
  stamp, selected and skipped source paths, graph/BM25/vector/RRF avenues,
  Arrow/DataFusion selection and bounded work, context item/evidence identity,
  model/tool attempt outcomes, cancellation/denial/truncation, commit receipt,
  and final outcome. Raw sensitive content is opt-in only if a future typed
  operation explicitly authorizes it; chain-of-thought is never exposed.
- **Pros**: Lets an operator diagnose path/README/source selection and confirm
  which engine work actually happened without inventing private reasoning.
- **Cons**: Requires H-05 trace completeness, R3 reasoning/context operations,
  bounded evidence schemas, and live delivery.
- **Impact**: Becomes the Prompt Trail & Evidence tab over engine-issued data.
- **Effort**: Large engine prerequisite; medium UI lens.

### Option C — local client activity log

- **Description**: Infer the trail from UI clicks, fetches, and console logs.
- **Pros**: Available immediately.
- **Cons**: Cannot prove engine planning, database reads, vector candidates,
  DataFusion work, commits, or outcomes; leaks data and becomes alternate truth.
- **Impact**: Recreates the retired diagnostics authority.
- **Effort**: Small, unacceptable product semantics.

## Decision 5 — RRFlowDB, vector, DataFusion, and multimodal topology

### Option A — separate direct UI connections

- **Description**: Connect the UI independently to RRFlowDB, a vector service,
  DataFusion, and model/media providers.
- **Pros**: Familiar integration-dashboard shape.
- **Cons**: Splits authorization, stamps, transactions, evidence, and failure
  handling; RRFlow's vector capability is native to RRFlowDB and DataFusion is
  engine-selected compute, not an external database.
- **Impact**: Creates multiple authorities and cannot prove one causal result.
- **Effort**: Large, unacceptable product semantics.

### Option B — one RRD operation with engine-selected paths (recommended)

- **Description**: Connectome sends one typed intent to `RrdEngine`. The engine
  reads canonical RRFlowDB state, chooses native graph/scalar/BM25/vector work
  and Arrow/DataFusion escalation at one stamp, invokes only explicitly
  installed multimodal adapters, and returns typed result/evidence. The UI
  visualizes those lanes and their work rather than choosing them locally.
- **Pros**: One authorization, stamp, budget, receipt, causal trail, and failure
  model; accurately represents the system already being built.
- **Cons**: Tabs remain unavailable until their engine operations and evidence
  are complete.
- **Impact**: Data, Retrieval, Prompt Trail, and Media tabs share one native
  session and capability catalogue.
- **Effort**: Large across Gates E–I/H-06; incremental UI work.

## Proposed package order for later commitment

1. Finish C0 and retain its anti-mock truth gate.
2. C1: consume the pinned generated client and complete discovery identity.
3. C2: secure installed project/credential handoff and opaque native session.
4. Add a read-only Overview plus Configuration & Access tab from live generated
   capability/configuration data; all mutations remain disabled.
5. After RRFlow R2: implement configure inspect/plan/apply and the chosen path
   grant operation with exact preview/receipt/restart evidence.
6. Prove one real RRFlowDB mutation/query/restart lens before porting breadth.
7. Add Data & Query, then Retrieval, then Prompt Trail, then Media & Adapters,
   each behind its real capability and conformance corpus.
8. Remove each inherited/alternate screen only after its typed replacement
   passes; never perform a sweeping rename or deletion.

This order is a discussion proposal, not a committed sprint. It becomes
authorable only after the decisions above are committed and each engine
prerequisite is present.

## Stop conditions

- No direct edit of `.rrflow` files from React or an ad hoc Tauri command.
- No raw API key, bearer token, session identity, unrestricted path, or secret
  file location in renderer state, logs, routes, screenshots, or errors.
- No “all paths” control until a typed engine grant contract and adversarial
  Linux/macOS/Windows tests define its exact authority.
- No tab enabled from the existence of a TypeScript type, static array, or
  mock; the live capability catalogue must advertise its operation.
- No client-selected DataFusion/vector path or direct read of rrflowKV.
- No raw chain-of-thought or unbounded prompt/project content in diagnostics.
- No sprint may combine more than one new mutation family or one major evidence
  lens without independent acceptance.

## Decision needed

Commit or revise the recommended choices before sprint authoring:

- Decision 1: Option C — generated RRD configure inspect/plan/apply.
- Decision 2: Option B — project default, selected roots, explicit advanced
  all-path grant.
- Decision 3: Option B — capability-driven tabs delivered incrementally.
- Decision 4: Option B — correlated observable prompt/evidence trail.
- Decision 5: Option B — one engine request with engine-selected data paths.

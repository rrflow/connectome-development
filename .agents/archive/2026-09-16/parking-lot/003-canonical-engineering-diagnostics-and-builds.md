# Parking Lot 003 — Canonical engineering, diagnostics, and build modes

**Status**: COMMITTED — 1C / 2C / 3C / 4B / 5B / 6B  
**Date**: 2026-09-16  
**Source**: Operator request for senior-development practice, strict canonical
naming, causal traces, and useful debug builds after Sprint 008 C0
**Committed**: 2026-09-16  
**Rationale**: The operator approved the recommended authority-first,
release-derived, typed-diagnostics direction. Generated RRFlow artifacts remain
the engine authority; Connectome owns only its client registry, projections,
build modes, and bounded migration policy. Package E1 is combined with Parking
Lot 004 Package A0 so the repository receives one foundation rather than two
competing governance systems.
**Initial transfer**: Sprint 009 takes only the authority/naming and no-new-debt
foundation. E2–E6 remain separately staged and are not authorized by that sprint.

## COSTAR profile

- **Context**: Connectome now has an honest C0 public-bootstrap boundary, but
  its active governance, historical roadmap, package metadata, build modes,
  logging, error presentation, capability policy, and handwritten RRD client
  still express several incompatible eras. The source currently has 51 direct
  `console.*` calls across 28 renderer files, free-form adapter logging, a
  release-capable devtools feature, nondeterministic build metadata, and no
  canonical diagnostic event or build identity.
- **Objective**: Establish one mechanically enforceable vocabulary and one
  causal diagnostics model, then add release-derived diagnostic builds that can
  reproduce failures without creating a second product, exposing protected
  content, or presenting logs as durable RRFlow evidence.
- **Style**: Contract first, generated authority where available, small
  independently reviewable packages, closed event/error vocabularies, explicit
  security boundaries, and ratchets that prevent new debt before inherited
  debt is migrated.
- **Tone**: Precise and operational. A maintainer should be able to distinguish
  product truth, transport correlation, diagnostic projection, and local debug
  convenience without interpreting a free-form log message.
- **Audience**: The operator, senior maintainers, future junior developers,
  security reviewers, and RRFlow contributors who must correlate a Connectome
  action with engine-owned evidence.
- **Response**: Choose one option for each of the six decisions below. Once
  committed, author only Package E1 as the next sprint, verify it, and review
  the result before authoring E2. This parking-lot item changes no product code
  and does not claim that RRFlow telemetry or the generated client is ready.

## Executive finding

The next change must not be a repository-wide “add logs” or naming sweep. The
correct order is:

1. fix authority and terminology so every later name has one owner;
2. make build identity and release/diagnostic profiles deterministic;
3. introduce typed, redacted diagnostic events and failures at the native
   composition boundary;
4. ratchet new call sites while migrating high-risk inherited logs in bounded
   slices;
5. continue W3C context through the packaged generated RRD client when that
   upstream artifact exists; and
6. build the layman-friendly prompt/evidence trail from durable RRFlow events,
   receipts, and stamps — never from Connectome log lines.

This sequence follows the same invariant as RRFlow: one semantic implementation
with multiple diagnostic projections. A debug or diagnostic build may expose
more bounded signal, but it may not enable alternate data, authorization,
query, vector, DataFusion, multimodal, or success behavior.

## Current evidence

### Repository identity conflicts

`GOVERNANCE.md:13-43` still says RRFlow owns Connectome as an
`apps/connectome` submodule and mixes Connectome, Clyffy, Vyrm, and MAESTRO
product relationships:

```md
| **Parent** | RRFlow engine repository (`apps/connectome` submodule) |
| **Connectome** | Separate Tauri desktop client, mounted as `apps/connectome` in RRFlow |

The RRFlow repository owns it through a git submodule
```

`README.md:3-12,92-104` now correctly states that Connectome is an independent
repository and release boundary that consumes public RRD contracts and packaged
artifacts. These two active records cannot both be authoritative.

Historical records also remain written as current product direction:

- `.agents/parking-lot/001-rebrand-and-restructure.md:1-73` commits the product
  identity “Cortex DevTools” and a direct Qdrant/Clyffy architecture;
- `.agents/sprints/001-identity-rebrand.md:1-136` implements that identity;
- `.agents/sprints/007-rrflow-mainline-consolidation.md:13-154` treats
  `apps/connectome` and an engine submodule pointer as authoritative; and
- `docs/roadmap/clyffy/README.md:1-14`,
  `docs/roadmap/clyffy/architecture.md:1-134`, and
  `docs/roadmap/clyffy/spokes.md:1-89` describe Cortex DevTools, Qdrant spokes,
  and direct service ownership that no longer match RRFlow's native vector and
  public-client boundaries.

They are useful historical design input, but an unmarked historical document
must not outrank current executable contracts.

### Package and build identity drift

`package.json:2-12` declares Connectome `3.7.3`, an `engineProtocol` string of
`2.0.0`, and a personal author identity. `src-tauri/Cargo.toml:1-8` declares
version `0.0.0`, the same personal author, and a personal repository URL. The
implemented public protocol in `src/rrflow/runtime.ts:3-4` is RRD v1. A bug
report therefore cannot name one reliable application version, source, or
protocol identity.

`vite.config.ts:73-81,126-131` currently:

```ts
envPrefix: ["VITE_", "TAURI_"],
// ...
minify: process.env.TAURI_DEBUG ? false : "esbuild",
sourcemap: !!process.env.TAURI_DEBUG,
// ...
"import.meta.env.DATE": JSON.stringify(new Date()),
```

Vite exposes variables matching `envPrefix` to client source. A broad
`TAURI_` prefix therefore makes every matching build-environment variable a
renderer input. The wall-clock `new Date()` also makes otherwise identical
frontend builds report different identities.

`src-tauri/Cargo.toml:20-41` has no custom release-derived diagnostic profile,
and enables Tauri's `devtools` Cargo feature for every build:

```toml
tauri = { version = "2.4.0", features = ["devtools"] }
```

Tauri already makes devtools available in development builds; the feature is
what enables them in production builds. A useful diagnostic binary should not
quietly become a production browser inspector.

### Capability and browser security drift

`src-tauri/capabilities/surrealist.json:1-47` retains a stale filename, grants
renderer-originated logging through `log:default` / `log:allow-log`, grants
read/write filesystem commands, and allows the internal devtools toggle.

`src-tauri/tauri.conf.json:2-4,77-81` uses a personal reverse-domain identifier,
does not explicitly select capability files, and has no CSP:

```json
"identifier": "dev.eonsofstupid.connectome"
// ...
"security": {
  "csp": null
}
```

Under Tauri's capability model, leaving the configured capability list empty
enables discovered capability files. The future sprint must explicitly select
production capability inputs and prove that development-only permissions do
not enter a release or diagnostic bundle.

### Logging is free-form and can contain protected data

`src/adapter/base.tsx:115-128` defines logging as arbitrary labels and message
strings:

```ts
log(label: string, message: string): void;
warn(label: string, message: string): void;
trace(label: string, message: string): void;
```

`src/adapter/browser.tsx:149-158` interpolates them into `console.*`.
`src/adapter/desktop.tsx:100-102,263-273` always attaches the renderer console
and forwards the same strings to the Tauri log plugin. There is no stable event
name, schema, correlation field, redaction class, size bound, or testable
severity rule.

High-risk examples include:

- `src/screens/connectome/connection/connection.tsx:130,795-800` logging a raw
  endpoint, namespace, and database;
- `src/providers/Designer/helpers.tsx:202-204` logging each generated mutation
  query;
- `src/shared/util/schema.tsx:136-145` logging table identities and raw errors;
- `src-tauri/src/main.rs:55-60,117-124,138-143` formatting launch arguments,
  open resources, and URLs with `Debug`; and
- `src/shared/util/errors.tsx:21-84` accepting arbitrary causes and stack traces
  for direct renderer display.

`src-tauri/src/main.rs:71-86` writes the same free-form stream to stdout, a
webview, and an unbounded-policy application folder. A diagnostic sink has not
been separated from renderer authority or release policy.

### Correlation is handwritten and conflated

`src-tauri/src/rrd/client.rs:305-336` creates sequential identifiers:

```rust
let request_id = format!("connectome-request-{}", self.sequence);
let operation_id = format!("connectome-operation-{}", self.sequence);
let idempotency_key = mutation.then(|| format!("connectome-key-{}", self.sequence));
```

Those values are neither process-unique nor generated from the authoritative
client contract. `src/rrflow/runtime.ts:1-220` separately duplicates RRD wire
models and vocabulary in TypeScript. There is no W3C `traceparent`/
`tracestate` continuation, and no distinction among a UI action, Tauri IPC
invocation, RRD request, RRD operation, diagnostic span, or durable receipt.

The packaged generated client and secure installed credential handoff remain
upstream blockers. The local handwritten client must not become a second
canonical SDK while those are pending.

### CI proves compilation, not diagnostic parity

`.github/workflows/connectome-ci.yml:13-112` accurately separates mocked
renderer evidence from native fake-server tests. It does not yet prove:

- canonical vocabulary or metadata agreement;
- explicit production capability selection and CSP;
- release versus diagnostic semantic input parity;
- artifact/symbol absence of secrets and absolute workspace paths;
- typed log/error schema and redaction behavior;
- bounded log rotation, exporter failure isolation, or shutdown behavior; or
- installed RRFlow trace-context continuation.

These are future gates, not missing claims that should be added to the current
C0 evidence.

## Owning authority hierarchy

The recommended hierarchy is intentionally asymmetric: Connectome can define
its own client behavior, but it cannot redefine an engine contract.

1. **Generated RRFlow public artifacts** own RRD operations, wire fields,
   capability names, resource/stamp/receipt shapes, durable trace operations,
   and supported protocol versions.
2. **RRFlow executable architecture contracts** are the temporary upstream
   reference when the packaged projection is not yet available. They are not a
   license to copy a handwritten local contract permanently.
3. **Connectome active governance** owns repository boundaries, client-only
   events, UI language, build profiles, capability policy, and projection
   behavior.
4. **Connectome code** consumes those owners. It is not allowed to introduce a
   competing product or engine term merely because an inherited identifier
   already compiles.
5. **Historical parking lots, sprints, and roadmaps** retain provenance but
   become explicitly non-authoritative after supersession.

The local RRFlow records already define the required upstream boundary:

- `../vyrm/docs/architecture/engine-data-flow.md:476-526` separates durable
  trace evidence from diagnostic spans and defines the closed
  `rrflow.<boundary>.<operation>` catalogue;
- `../vyrm/docs/architecture/engine-data-flow.md:534-647` defines typed links,
  closed snake-case attributes, W3C propagation, and projection behavior;
- `../vyrm/docs/architecture/engine-data-flow.md:649-685` defines development,
  release, diagnostic, runtime-analysis, verification, and benchmark modes plus
  machine-readable build identity;
- `../vyrm/docs/reference/client/connectome-implementation-guide.md:135-220`
  defines Reachable through Recovered and the secure native credential
  boundary; and
- `../vyrm/docs/reference/protocol/signal-catalogue.md:5-23,196-203` explicitly
  says the generated catalogue is a projection and does not prove runtime
  emission, parity, overhead, or readiness.

## Proposed canonical vocabulary

This vocabulary becomes enforceable only if Decision 1 Option C is committed.

| Concept | Canonical form | Rule |
|---|---|---|
| Desktop product | `Connectome` | Product and repository name. Do not use “Cortex DevTools” as a current alias. |
| Engine/product umbrella | `RRFlow` | Human-facing proper noun. Never shorten it to `RR` or call it the database. |
| Public runtime boundary | `RRD` | Protocol/service boundary, not the product name or a generic database label. Type names use `Rrd...`; serialized fields follow generated contracts exactly. |
| Durable database | `rrflowDB` | Exact product casing in prose. It owns durable records, trace evidence, receipts, and stamps. |
| Storage/query components | `rrflowKV`, `rrflowQL` | Exact product casing in prose; Rust/TypeScript identifiers follow language style. |
| Analytical executor | `DataFusion` | Proper noun. It plans/executes analytical work selected by RRFlow; it is not an authority or separate Connectome connection. |
| Vector capability | `RRFlow vector` or the generated capability name | Never present Qdrant as a current direct service/spoke unless a future catalogued adapter explicitly says so. |
| Engine operation | `rrflow.<boundary>.<operation>` | Closed upstream catalogue only. Connectome preserves it and never manufactures a new `rrflow.*` value. |
| Client diagnostic operation/event | `connectome.<boundary>.<operation>` | Closed, static, lowercase dot namespace defined in a Connectome registry. Dynamic values never enter names. |
| Structured attribute | lowercase namespaced components | Static keys; bounded typed values; identifiers stay fields rather than event-name suffixes or metric labels. |
| Human UI state | Reachable, Ready, Discovered, Authenticated, Connected, Persisted, Recovered | Render only when the minimum evidence in the implementation guide exists. |
| Durable trace event | engine-owned immutable causal evidence | Can support a product truth claim when its required receipt/stamp also exists. |
| Diagnostic span/log | lossy troubleshooting projection | Can help explain behavior; cannot prove completion, persistence, connection, or recovery. |
| Audit record | authenticated authorization/mutation accountability | Not a performance trace or generic activity log. |
| Receipt/stamp | engine-issued durable coordinate | Never replace with a log acknowledgement or exporter success. |

### Identity domains must remain distinct

| Identity | Owner | Purpose | Must not become |
|---|---|---|---|
| `client_action_id` | Connectome UI/application service | Correlates one operator intent across renderer work. | Authorization, idempotency, or durable evidence. |
| `ipc_invocation_id` | Connectome native boundary | Correlates one typed renderer-to-native invocation. | An RRD request ID reused across retries. |
| `request_id` | Generated RRD client/contract | Public request correlation under RRD rules. | A trace ID or UI component key. |
| `operation_id` | Generated RRD client/contract | Public operation coordinate under RRD rules. | A local sequence invented by the renderer. |
| `idempotency_key` | Generated RRD mutation contract | Deduplicates the exact admitted mutation according to protocol policy. | A log field emitted in cleartext or a generic correlation ID. |
| `trace_id` / `span_id` | W3C/OpenTelemetry context and RRFlow projection | Causal diagnostic continuation. | Authentication, sampling proof, or durable completion. |
| receipt/stamp IDs | RRFlow engine | Reconciliation, persistence, and authoritative state. | An exporter acknowledgement or UI toast ID. |

The exact local field spellings above are proposed contract names, not an
instruction to add them to the current handwritten RRD envelope. Package E3
must reconcile them with the packaged generated client before implementation.

## Research conclusions

### Build profiles

Cargo custom profiles must declare an `inherits` profile and can be selected
with `--profile`. That supports a `diagnostic` profile derived from `release`,
but inheritance alone does not prove semantic parity. Connectome must compare a
machine-readable semantic fingerprint and behavior across both artifacts.

Recommended modes:

| Mode | Purpose | Allowed differences | Forbidden claim |
|---|---|---|---|
| `dev` / `test` | Fast editing and correctness tests. Devtools may be available. | Assertions, incremental compilation, test harnesses, local pretty output. | Release timing, release parity, or installed conformance. |
| `release` | Shipped optimized default. | Bounded normal diagnostic policy only. | Complete observability or debug-symbol availability. |
| `diagnostic` | Reproduce release behavior with protected symbols/line tables and runtime-selectable bounded detail. | Debug information, symbol packaging, log detail within policy. | Alternate semantic features, devtools, or conformance until parity passes. |
| `runtime-analysis` | Explicit profiler/scheduler investigation based on the diagnostic artifact. | Instrumentation known to affect timing. | Conformance or timing equivalence. |

“Debug build” in operator-facing documentation should name one of these modes;
it must not ambiguously mean Cargo `dev`, a release binary with devtools, or a
release-derived diagnostic artifact.

Every diagnostic record and exported bundle should include one redacted build
manifest containing at least Connectome version, source commit/tree and
clean/dirty state, target, profile, toolchain, feature/capability closure,
frontend asset identity, executable/bundle digest, RRD contract/catalogue
identity, and runtime diagnostic policy. A timestamp is metadata, not identity.

### Structured diagnostics

The stable unit is a typed event, not a formatted string. The minimum event
model should separate:

- static event name;
- severity and outcome;
- wall-clock timestamp plus monotonic duration where applicable;
- client action / IPC / RRD / W3C / receipt coordinates when applicable;
- stable error class and failed boundary;
- bounded, allowlisted attributes;
- short redacted human message; and
- build/runtime resource identity supplied by the native composition root.

Renderer code should call a typed client diagnostic API. Native code should
validate and redact before enqueue/serialization, then route the event to
bounded local sinks. Libraries emit provider-neutral Rust `tracing` events and
spans; the executable installs subscriber layers. An optional OpenTelemetry
exporter belongs at that composition boundary and cannot be required for
correct operation.

Async Rust work must instrument the future or use async-aware instrumentation;
it must not hold a `Span::enter` guard across `.await`. Attribute macros must
also skip protected arguments explicitly because default debug recording can
capture them.

### Redaction and errors

Default diagnostics must reject, before enqueue or serialization:

- credentials, bearer/session/API tokens, cookies, and authorization headers;
- connection strings and private endpoint query components;
- prompts, source bodies, query bodies, generated mutation text, vectors,
  model input/output, and hidden reasoning;
- arbitrary project/file paths, launch arguments, environment values, and
  unvalidated URLs;
- raw error chains, stack traces, and user-controlled control characters; and
- high-cardinality values as metric labels or event names.

The public/native error contract should contain a closed class, failed
boundary/stage, outcome/retry semantics, safe operator message, remediation
hint, and protected correlation coordinates. A detailed source chain or
backtrace is an opt-in bounded attachment in a diagnostic capture, not the
default UI error string.

### Causal truth

W3C `traceparent` and optional `tracestate` are interoperability context, not
identity or authority. Invalid/missing context creates a new root according to
the engine policy. Sampling changes only diagnostic recording. Connectome must
not infer success from a sampled span, log delivery, or exporter acknowledgement.

The eventual prompt trail UI therefore joins:

```text
Connectome client action
  -> typed native invocation
  -> generated RRD request / operation
  -> validated W3C continuation
  -> RRFlow durable trace links + receipts/stamps
  -> redacted diagnostic projections for explanation
```

The last two rows are different data. The durable RRFlow path supports the
truth claim; Connectome diagnostics explain the client's participation.

## Decision 1 — canonical authority and naming

### Option A — prose style guide and manual review

- **Description**: Correct active documents and ask reviewers to enforce names.
- **Pros**: Small initial change; no generator or gate.
- **Cons**: Cannot prevent drift across TypeScript, Rust, JSON, UI strings, and
  RRFlow projections; repeats the current conflict.
- **Impact**: Names improve temporarily but remain non-verifiable.
- **Effort**: Small initially, continuous manual cost.

### Option B — Connectome-owned master registry for everything

- **Description**: Define local copies of engine and client terminology in one
  Connectome registry.
- **Pros**: One local file and straightforward local checks.
- **Cons**: Makes Connectome a competing owner of RRD and RRFlow catalogues;
  will drift from packaged SDKs and executable discovery.
- **Impact**: Cleaner local code with false cross-repository authority.
- **Effort**: Medium; unacceptable long-term semantics.

### Option C — generated engine authority plus a closed client registry (recommended)

- **Description**: Consume engine names and fields from pinned generated
  artifacts. Maintain a separate closed Connectome registry only for
  `connectome.*` events, client error classes, build modes, and UI projection
  terms. Mark superseded documents explicitly and add mechanical ratchets.
- **Pros**: One owner per concept, visible provenance, generated agreement, and
  enforceable no-new-drift policy.
- **Cons**: Some engine-side enforcement remains blocked until the packaged
  generated client exists; requires a small local schema/generator or typed
  registry.
- **Impact**: Establishes the foundation for all following packages.
- **Effort**: Medium locally; coordinated upstream handoff for engine fields.

## Decision 2 — build and diagnostic mode model

### Option A — retain development and release only

- **Description**: Use current `TAURI_DEBUG` behavior and ordinary release
  builds.
- **Pros**: No new profile or CI work.
- **Cons**: Cannot reproduce optimized failures with dependable symbols or
  identity; mode meaning remains implicit and frontend-driven.
- **Impact**: Debug reports remain difficult to compare or trust.
- **Effort**: None now, high incident cost.

### Option B — ship release devtools and verbose logging

- **Description**: Keep Tauri devtools enabled and raise log verbosity in the
  distributed binary.
- **Pros**: Immediate interactive inspection.
- **Cons**: Expands release capability and protected-data exposure, changes the
  security boundary, and still lacks build parity and stable signal contracts.
- **Impact**: Creates an unsafe debug surface rather than a diagnostic build.
- **Effort**: Small, unacceptable default policy.

### Option C — explicit release-derived diagnostic matrix (recommended)

- **Description**: Define `dev/test`, `release`, `diagnostic`, and
  `runtime-analysis`; make diagnostic inherit release, retain protected
  symbol/line data, keep the exact semantic feature and capability closure, and
  require parity plus build-manifest checks in CI.
- **Pros**: Reproducible optimized failures, explicit evidence standing, no
  second implementation, and platform-specific symbol handling.
- **Cons**: Requires build tooling, CI time, artifact policy, and native
  qualification on Linux/macOS/Windows.
- **Impact**: Gives “debug build” a precise supported meaning.
- **Effort**: Medium to large, delivered in isolated build/security work.

## Decision 3 — diagnostics architecture

### Option A — standardize free-form log prefixes

- **Description**: Keep `console.*`, `log` crate, and adapter strings but agree
  on labels such as `DB`, `RRD`, and `UI`.
- **Pros**: Quick migration and readable local output.
- **Cons**: Labels are not schemas; no safe correlation, cardinality,
  redaction, or compatibility contract.
- **Impact**: Cosmetic consistency without reliable diagnostics.
- **Effort**: Small.

### Option B — send renderer and native data directly to an exporter

- **Description**: Add an OpenTelemetry SDK/exporter to both runtimes and emit
  spans directly.
- **Pros**: Broad tool compatibility and fast remote visualization.
- **Cons**: Couples libraries and renderer code to a provider, duplicates
  resource/context policy, increases failure paths, and risks exporting secrets
  before native validation.
- **Impact**: Exporter behavior can become product behavior.
- **Effort**: Large and fragile.

### Option C — typed provider-neutral events with native composition (recommended)

- **Description**: Define closed client event/error contracts. Renderer code
  sends allowlisted typed values to native code; native code validates,
  redacts, bounds, and correlates them. Rust libraries emit `tracing`
  spans/events; the executable composes local formatting/capture and optional
  OpenTelemetry layers.
- **Pros**: Testable schemas, early redaction, async causality, optional
  exporters, bounded failure isolation, and one local policy owner.
- **Cons**: Requires new pinned native dependencies, a migration adapter, and
  careful queue/rotation/shutdown tests.
- **Impact**: Replaces logging as strings with diagnostics as a contract.
- **Effort**: Medium foundation, then incremental migrations.

## Decision 4 — correlation and trace context

### Option A — use one identifier everywhere

- **Description**: Reuse an RRD request ID as the UI, IPC, trace, and operation
  identity.
- **Pros**: Easy searching and fewer fields.
- **Cons**: Erases retry/fan-out semantics, violates owner boundaries, risks
  confusing trace context with authority, and makes collisions/misparenting
  hard to detect.
- **Impact**: Simple-looking but causally false traces.
- **Effort**: Small, unacceptable semantics.

### Option B — distinct identity domains with explicit links (recommended)

- **Description**: Keep client action, IPC invocation, generated RRD
  request/operation/idempotency, W3C trace/span, and receipt/stamp coordinates
  distinct. Link only where a typed contract proves the relation; use links for
  async/retry work rather than false parentage.
- **Pros**: Accurate retries and fan-out, compatible distributed tracing,
  auditable authority boundaries, and honest UI joins.
- **Cons**: More fields and requires the generated client to carry context
  correctly.
- **Impact**: Enables the eventual prompt trail without inventing provenance.
- **Effort**: Medium after packaged client/context support; blocked before then.

### Option C — keep all trace context local to Connectome

- **Description**: Trace UI and native work but do not propagate context to
  RRFlow.
- **Pros**: Can ship without an upstream change.
- **Cons**: Cannot correlate the actual engine path; encourages heuristic joins
  by time or message.
- **Impact**: Useful for UI performance only, not full causal debugging.
- **Effort**: Medium with limited value.

## Decision 5 — protected data and error policy

### Option A — emit broadly and redact at each sink

- **Description**: Preserve detailed values in events, then configure file or
  exporter filters.
- **Pros**: Maximum local troubleshooting content.
- **Cons**: Sensitive values already exist in queues, memory, crash dumps, and
  alternate sinks; one missed sink defeats the policy.
- **Impact**: Unacceptable leakage surface.
- **Effort**: Small initially, high audit burden.

### Option B — allowlisted typed fields and pre-serialization redaction (recommended)

- **Description**: Diagnostic constructors accept only typed allowlisted fields
  and safe wrappers/digests. Validate size/control characters and redact before
  enqueue. Detailed source chains/backtraces require an explicit diagnostic
  capture policy.
- **Pros**: Deny-by-construction, testable, consistent across sinks, and suited
  to safe support bundles.
- **Cons**: Debugging occasionally requires a separately authorized capture;
  wrappers and tests add code.
- **Impact**: Makes safe diagnostics the default product behavior.
- **Effort**: Medium.

### Option C — raw detail only on local development machines

- **Description**: Permit raw prompts, paths, queries, and errors whenever the
  build is `dev`.
- **Pros**: Convenient during local implementation.
- **Cons**: Development data can still be real/sensitive; creates code paths
  and habits that bypass the contract; hard to prove the mode check.
- **Impact**: Local builds become a standing exfiltration exception.
- **Effort**: Small, not recommended.

## Decision 6 — migration and documentation strategy

### Option A — one repository-wide rename and logging rewrite

- **Description**: Update all historical documents, identifiers, console calls,
  errors, and profiles in one change.
- **Pros**: Fast apparent consistency.
- **Cons**: Review is unbounded, behavior and terminology changes mix, import
  debt can be accidentally removed, and regressions are hard to localize.
- **Impact**: Violates the requested methodical buildout.
- **Effort**: Large and high risk.

### Option B — authority-first ratchets and touched-slice convergence (recommended)

- **Description**: Correct active authority first; explicitly label historical
  records; capture inherited debt in a machine-readable baseline; prohibit new
  raw console/free-form logging/retired terms; then migrate one risk-ranked
  boundary per reviewed package.
- **Pros**: Immediate no-new-debt guarantee, small diffs, preserved history,
  measurable burn-down, and clear rollback.
- **Cons**: Temporary mixed code remains visible and requires disciplined
  baseline maintenance.
- **Impact**: Consistency improves monotonically without a sweeping rewrite.
- **Effort**: Small foundation, sustained bounded work.

### Option C — postpone cleanup until the generated client arrives

- **Description**: Make no naming/build/logging changes before C1/C2.
- **Pros**: Avoids touching code that may be replaced.
- **Cons**: New UI work continues accumulating unsafe logs and false terms;
  build identity and local diagnostics do not depend on the SDK blocker.
- **Impact**: Enlarges later migration and weakens current debug evidence.
- **Effort**: None now, larger later.

## Recommended decision stack

Commit **1C, 2C, 3C, 4B, 5B, and 6B** together. They form one compatible
architecture:

- generated RRFlow authority plus a closed Connectome registry;
- a release-derived diagnostic build, not release devtools;
- typed provider-neutral diagnostics composed in native code;
- distinct correlated identities and W3C continuation;
- redaction before serialization; and
- ratcheted, risk-ranked migration.

Choosing only the build profile without the redaction/event contract would
produce more unsafe output. Choosing only typed logging without canonical
authority would formalize the wrong names. Choosing only W3C propagation while
keeping handwritten sequential RRD IDs would create misleading correlation.

## Proposed implementation packages after commitment

These are package boundaries, not authored sprints. Per repository governance,
only the next package becomes a sprint after this item is committed and its
exact source is reviewed again.

### Package E1 — authority, terminology, and no-new-debt gates

**Goal**: Make active written authority internally consistent and prevent new
naming/logging debt without changing runtime behavior.

**Likely scope**:

- `GOVERNANCE.md` — replace the submodule/parent statement with the independent
  repository and packaged-artifact boundary already stated by `README.md`;
- historical `.agents` and `docs/roadmap/clyffy` entry points — add explicit
  superseded/non-authoritative provenance without deleting history;
- a new active engineering contract under `docs/reference/` — record the
  authority hierarchy, vocabulary, identity domains, event/error conventions,
  build-mode meanings, and evidence distinction;
- a small machine-readable client registry — own only Connectome event names,
  error classes, and build modes;
- `scripts/` and `package.json` — add ratchets for retired active terms, new raw
  `console.*`, new arbitrary adapter log labels, and metadata/protocol
  disagreement; and
- `.github/workflows/connectome-ci.yml` — run the gates without calling them
  RRFlow conformance.

**Acceptance**:

- one active record states the repository/release boundary;
- historical Cortex/Qdrant/submodule plans are visibly historical;
- no local registry contains an invented `rrflow.*` operation;
- current inherited console/log debt is counted explicitly and cannot grow;
- no product behavior, dependency, or wire model changes; and
- the entire existing C0 verification matrix remains green.

### Package E2 — deterministic build identity and secure modes

**Goal**: Produce named development, release, and release-derived diagnostic
artifacts with explicit security and identity.

**Likely scope**:

- reconcile `package.json`, `src-tauri/Cargo.toml`, Tauri identifier, repository,
  protocol metadata, and installer metadata under one generated/validated build
  manifest;
- replace wall-clock identity with source-derived deterministic metadata;
- narrow Vite renderer environment exposure to explicit non-secret values;
- remove production devtools enablement while retaining ordinary development
  ergonomics;
- define a Cargo `diagnostic` profile inheriting `release` and document
  platform-specific symbols as protected artifacts;
- explicitly select production capabilities, split development-only grants,
  and establish a restrictive CSP based on measured application needs; and
- add CI assertions for release/diagnostic semantic inputs, capabilities,
  manifest fields, and absence of raw workspace paths/secrets in distributable
  artifacts.

**Acceptance**:

- the application can report one structured build manifest;
- two builds of the same declared input report the same semantic identity;
- diagnostic inherits release and differs only in admitted diagnostic
  properties;
- release and diagnostic have no webview devtools or renderer log grant;
- no `TAURI_*` environment namespace is broadly exposed to client code; and
- Linux, macOS, and Windows symbol/bundle policy is explicit before artifacts
  are retained.

### Package E3 — typed diagnostic and error core

**Goal**: Establish safe structured client diagnostics before migrating call
sites.

**Likely scope**:

- add pinned `tracing` and `tracing-subscriber` dependencies only after this
  decision authorizes them and compatibility with the pinned Tauri/log stack is
  verified;
- define closed Connectome event, severity/outcome, error class, redaction, and
  typed safe-value contracts;
- compose bounded stdout/file/ring-buffer output at the Rust executable;
- ensure exporter absence, timeout, rejection, overflow, and shutdown never
  alter an application result;
- replace renderer arbitrary strings with a typed native diagnostic invocation
  or a narrow migration adapter; and
- test control-character injection, size bounds, secret/path/query/prompt
  exclusion, queue overflow, rotation, and error projection.

**Acceptance**:

- an event has stable machine fields independent of display formatting;
- redaction occurs before serialization/enqueue;
- no renderer can choose an arbitrary native severity, event name, path, or
  protected payload;
- async spans preserve correct context across `.await`;
- expected denial/cancellation is not mislabeled as an internal failure; and
- diagnostic output remains a lossy projection, never application state.

### Package E4 — risk-ranked call-site migration

**Goal**: Burn down inherited free-form logs without a mass rewrite.

**Order**:

1. credentials, endpoints, launch resources, paths, query/mutation bodies, and
   raw errors;
2. RRD bootstrap/native transport boundaries;
3. configuration persistence and file operations;
4. updater/analytics/external network activity;
5. inherited query/schema/designer views; and
6. low-risk development warnings.

Each slice removes only its reviewed baseline entries, adds contract tests, and
leaves unrelated imports/code untouched.

### Package C1/C2 prerequisite — generated client and credential handoff

This remains owned by RRFlow packaging. Connectome must receive:

- a pinned packaged generated Rust client/model artifact;
- exact operation/catalogue/OpenAPI identities;
- generated RRD correlation/context support; and
- a qualified installed-client locator/credential boundary that never passes a
  secret or session ID through the renderer.

No local path dependency, sibling code generation, fixed credential, or private
installation-file parser satisfies this prerequisite.

### Package E5 — end-to-end causal correlation

**Goal**: Correlate Connectome participation with real RRFlow operations after
C1/C2, without changing authority.

**Likely scope**:

- replace handwritten RRD models/IDs with the packaged generated client;
- generate/link client-action and IPC identities locally;
- let the generated boundary own request, operation, idempotency, and W3C
  propagation rules;
- preserve engine `rrflow.*` operations and durable coordinates exactly;
- test invalid/missing context, retry/fan-out links, concurrent isolation, and
  no cross-profile context leakage; and
- expose only safe correlation summaries to the renderer.

### Package E6 — sanitized diagnostic bundle and evidence UI

**Goal**: Give operators a useful layman-facing debugging surface without
turning logs into engine truth.

**Likely scope**:

- bounded export with build manifest, policy level, client events, typed errors,
  and safe correlation coordinates;
- explicit consent, preview, byte/age limits, retention, and destination;
- a clear separation among client diagnostics, engine durable trail, audit,
  receipts/stamps, and unavailable evidence;
- no default prompt/query/path/model-output capture; and
- prompt trail views only for catalogued RRFlow operations whose durable
  evidence contracts exist.

## Stop conditions

Pause the relevant package rather than filling gaps with local inventions when:

- a proposed term or field belongs to an unpublished/generated RRFlow
  contract;
- release and diagnostic cannot prove the same semantic inputs and outputs;
- a renderer capability is required only to simplify diagnostics;
- a useful message appears to require a credential, prompt, query, vector,
  model output, arbitrary path, or raw stack trace;
- an exporter, file sink, or webview must succeed for the operation to succeed;
- a UI state would be inferred from a log/span rather than its required
  receipt/stamp/evidence; or
- a package grows beyond one reviewable authority or runtime boundary.

## Primary-source research basis

- [Cargo profiles](https://doc.rust-lang.org/cargo/reference/profiles.html) —
  custom profile inheritance and selection.
- [Tauri logging plugin](https://v2.tauri.app/plugin/logging/),
  [capabilities](https://v2.tauri.app/security/capabilities/),
  [configuration](https://v2.tauri.app/reference/config/), and
  [CSP](https://v2.tauri.app/security/csp/) — renderer logging permissions,
  capability discovery/selection, devtools behavior, and webview policy.
- [Vite environment variables and modes](https://vite.dev/guide/env-and-mode)
  and [shared options](https://vite.dev/config/shared-options) — matching
  prefixes are exposed to client code.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) — bounded
  `traceparent`/`tracestate`, privacy, validation, and trust-boundary rules.
- [OpenTelemetry naming](https://opentelemetry.io/docs/specs/semconv/general/naming/),
  [error recording](https://opentelemetry.io/docs/specs/semconv/general/recording-errors/),
  and [log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  — stable low-cardinality names, `error.type`, and distinct event/correlation
  fields.
- [Rust `tracing::Span`](https://docs.rs/tracing/latest/tracing/struct.Span.html)
  — async instrumentation and `Span::enter` constraints.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  — protected-data exclusion, injection resistance, access, retention, and
  availability controls.

## Decision request

Approve the recommended stack as **1C / 2C / 3C / 4B / 5B / 6B**, or record a
different option for each affected decision. Approval commits the architecture,
not all six implementation packages. The next authored sprint will cover only
Package E1 after its source anchors are refreshed.

# Engine configuration and diagnostic UI pattern

Status: supporting implementation pattern, 2026-11-22. This is not a claim
that all six layers or the complete prompt trace are implemented.
The engine's [scoped configuration contract](https://github.com/rrflow/rrflow-development/blob/main/docs/reference/deployment/scoped-configuration.md)
and [observability contract](https://github.com/rrflow/rrflow-development/blob/main/docs/architecture/engine-data-flow.md#runtime-modes-build-profiles-and-build-identity)
own configuration and runtime semantics. Connectome consumes their public
operations; it does not create settings or measurements to fill a dashboard.

## Six layers, one configuration authority

| Layer | Configuration belongs to | Evidence needed to tune it | Current boundary / outstanding work |
|---|---|---|---|
| QL | Planner and execution budgets: candidate counts, memory, deadlines and admissible paths | Admitted policy revision, chosen/rejected paths, rows, keys examined, decoded bytes, spills and execution timing | Query lab already projects bounded query evidence. A complete prompt-to-query trace is not supplied by the periodic engine probe. |
| TX | Isolation, admission, conflict/retry and snapshot retention policies | Admission/commit outcome, conflict identity, queue wait, durable receipt and snapshot/watermark | Existing transaction admission is authoritative. The six-layer storage-agnostic coordinator and its full tuning surface are not established. |
| MX | Bounded context capacity, prefetch/eviction and focus policy | Occupancy, hits/misses, borrowed/copied bytes, pin lifetime and promotion outcome | The current memory store is not the requested lock-free Arrow focus tier. Do not expose a fictional focus-decay control. |
| DB | Instance partitioning, catalog and placement/publication policy | Source/read identity, selected tier, generation/coverage, publication and recovery outcome | Existing composition and storage facade are the starting points. Production cold publication still needs relocation behind that facade. |
| LSM | Storage-owned WAL, cache, flush, compaction and write-admission settings | Physical/durable sequences, retained WAL bytes, write amplification, lock/queue wait and maintenance work | Storage settings and bounded write-phase samples exist. Not every setting is live-editable or exposed through Connectome. |
| CLD | Backend selection, scan/encoding budgets and immutable-generation policy | Backend/format, selected generation, bytes read/decoded/copied, scan latency and publication result | Production `ColdStorageBackend`, independent `cld-vortex` / `cld-parquet` conformance and benchmarks are still missing. Current cold evidence is not proof of these capabilities. |

rrflowKV remains the bounded physical access boundary, not an extra semantic
transaction coordinator. Physical sequence numbers are not rrflowDB change
cursors. Neither those coordinates nor a cold coverage cursor are row counts.

For each new configurable setting, the engine contract must supply the stable
identifier, owning layer, typed value/unit, default and validation bounds,
scope/inheritance and provenance, effective revision, applicability, and
activation mode (live at a declared boundary or restart required). A proposed
change is distinct from the admitted effective value. Preview must report
validation failures and effect/restart requirements; activation follows the
existing governed configuration operation. Do not turn installation-sealed
storage values into renderer-local sliders. Unsupported settings stay unavailable.

## Internal and customer builds

Use the same engine, formats, admission rules and public operation catalogue.
The existing Cargo `diagnostic` profile inherits release optimization and keeps
line tables/symbols. A profile name alone does not prove release parity.
The engine contract requires identity and parity evidence before diagnostic
results qualify release behavior. Dev/test timings cannot qualify production
latency; extra scheduler/profiler instrumentation has its own analysis status.

Diagnostic collection needs bounded memory, sampling, a declared cost and
dropped-sample counts. The existing LSM write recorder is opt-in, bounded and
nonpersistent; Windows thread CPU measurements are unavailable rather than
zero. Customer builds still need actionable errors and bounded operational
evidence. Internal tools may request richer authorized measurements, but must
not bypass permission, visibility, durability or resource limits. Full build
identity, effective diagnostic configuration and prompt-trace UI remain work
to implement and verify, not features inferred from the profile declaration.

## What a prompt trace must mean

A prompt needs a correlation identity carried through authorized operations,
with separate attempts and terminal outcomes. A useful trace names each actual
boundary: client round trip, engine admission, queue wait, planning, stamped
scan, execution, context selection and durable commit. Parent/child relationships
allow overlapping work to be shown without summing concurrent spans as elapsed
time. The engine defines these spans; Connectome renders them.

Avoid a generic "touches" number. Show point reads, range scans, keys examined,
rows selected/returned, graph steps, vector candidates, decoded bytes and
copied/borrowed bytes with their actual scope and availability. A query's
attached work counters can describe that query; differences between periodic
storage observations include other agents and background work. Probe latency
is the probe's latency, not the user's prompt latency. An absent measurement
is not zero, a counter reset is not negative work, and retained WAL size is a
gauge that may shrink after maintenance.

## Canonical code locations and reusable pattern

```text
src-tauri/src/rrd/client/       authenticated typed transport and bounded projections
  configuration.rs            governed policy read/preview/approval
src/rrflow/session.ts          renderer-facing public types
src/features/runtime/
  api/queries.ts              shared query keys, reads and retry policy
  components/notice.tsx       pending/error/stale/readback states
  components/inspector.tsx    plain explanation, details and raw evidence
  engine/model.ts            pure interpretation; no transport or policy authority
  engine/engine-tab.tsx       session-scoped observations and refresh lifecycle
  engine/parts.tsx            evidence captions and availability
  engine/cursor-rail.tsx      only comparable semantic coordinates
  query-lab/query-answer.tsx  request-specific plan/execution evidence
scripts/check-one-engine.mjs  interpretation oracles for real contract shapes
```

Extend these owners instead of adding another global metrics store or settings
authority. `src/rrflow/diagnostics.ts` and native `diagnostics.rs` speak the
separate Vyrm protocol; they do not prove an RRFlow diagnostics operation.
The current frontend is React/TSX. Adding Svelte beside it would create another
implementation rather than clean up this one.

Keep each view's cached readings bound to the engine session. Retain a last
successful reading only with its timestamp and visible refresh failure. The
engine overview compares independently timed observations; it does not certify
atomic agreement or process continuity across restart. Without an engine
process epoch, interval activity cannot prove that no restart occurred.

This package fixes the concrete overview violations: invented KV-to-change
agreement, overwriting a DB observation with a newer query cursor, missing
maintenance counters displayed as zero, reset counters presented as work,
cold coverage advancement described as copied records, and hidden refresh
failure beside cached data. Project changes reset local observation history.

## Verification and implementation order

First preserve truthful existing observations and prove their display against
an installed engine. Then implement the DB/CLD port and identical backend
conformance described in the engine's six-layer review. Establish TX/MX
publication/visibility contracts before adding focus rotation. Extend the
engine-owned configuration and operation evidence contracts, generate the
client projection, and only then add corresponding tuning controls/trace views.

For each capability, require a failing behavioral oracle, the actual native
request path, visible unavailable/error states, and installed readback. For
performance claims also require release identity, configuration, corpus,
concurrency, warm/cold conditions, correctness checks, sample count, raw
latencies and failures. Frontend model tests and a successful build establish
neither storage correctness nor a speed target.

The paired package's commands and observed results are recorded in
[the temporal relationship journal](project-temporal-relations.md).

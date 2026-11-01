# Native controller proposal workflow

Source: [parking lot 003](../parking-lot/003-controller-proposals.md). Priority P0.
Goal: expose engine-owned tasks, budgets and experimental proposals through the
existing authenticated desktop session, preserving identity and uncertain effects.
Authorized by the owner's existing end-to-end implementation direction.

## Ordered source-grounded tasks

1. **Dependency pin.** `package.json:78` currently pins `@rrflow/rrd-client` to
   `86adada6dab6411cc58cb9aaa931e35472c0f452`; `src-tauri/Cargo.toml:47-48` pins
   `rrd-client` and `rrd-contract` identically. Target all three pins:
   `61ddb26416811ba7e56edf2e28b8cef3acad5930`. Resolve both lockfiles normally.
   Regenerate `src/rrflow/fixtures/engine-values.json` only with the actual pinned
   engine via `the_value_model_golden_matches_the_engine`; never relabel old data.
2. **Native commands and projections.** `src-tauri/src/rrd/client.rs:262` currently
   has `client: RrdClient,`; retain the connected address for a bounded proposal
   transport. At lines 489-588, `async fn lease(&self)` and `async fn send<T, Fut>`
   pin shared leases; add duration-aware leasing, preserving concurrent read/Stop.
   Add `mod tasks;` beside `mod transaction;` at line 52, and typed task commands
   in new `client/tasks.rs`, with new bounded view projections. In `rrd.rs`, add
   `rrd_task` alongside `rrd_query`; register `rrd::rrd_task,` after
   `rrd::rrd_query,` at `src-tauri/src/main.rs:120`. Task scope is native-derived.
   No raw credential, bearer, profile endpoint or arbitrary HTTP operation crosses.
3. **Task workspace.** `src/rrflow/session.ts:661` currently declares
   `export class RrdSessionClient {`; add typed `task(request)` using existing
   native `call`, with projection types in new `src/rrflow/tasks.ts`.
   `RuntimeConnection/index.tsx:334-341` currently includes
   `["activity", "Activity"],`; add `["tasks", "Tasks"],` before it.
   Mount new `tasks.tsx` before `<ProjectSection` at line 578, keyed by session
   identity. Reads do not dispatch inference. Blank task/budget fields require
   operator input. Explicit proposal preparation shows configured candidates and
   digests. Save recovery coordinates before sending; never retry mutations.
4. **Verification and documentation.** Add real installed-process task tests under
   `src-tauri/src/rrd/client/process/` (currently modules `effects`, `live`, `values`).
   Extend backend governance and `docs/native-workbench.md` with the resulting
   commands and limitations, retaining existing prose. New process checks use the
   existing real engine fixture; routing evaluation/training receives no test data.

## Definition of done

Native format/check/test/strict Clippy and frontend full check/build pass; regenerate
the golden through the exact pinned engine; exercise task/budget/readback through
that engine. Verify UI errors, session isolation, no auto-dispatch, attempt recovery
and Stop availability. A live BF16 trial requires the existing configured endpoint
and a real task; preserve any failure and exact revision. Draft dependency, CI,
packaging, worker execution, source replanning and training remain explicit gates.

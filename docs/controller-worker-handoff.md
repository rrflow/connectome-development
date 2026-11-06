# Selected-worker handoff

Status: active implementation; exact-source desktop trial and dependency landing pending.

## User flow and authority

In **Tasks and model handoffs**, record a real task, configure its engine budget,
review controller inputs and request a proposal. Read the budget and retained
attempt. A selected binding exposes **Review selected worker**; abstention does
not. Review resolves the accepted selection from RRFlow and checks its task and
configuration identities against current reads. Explicit worker policy and a
native session long enough for its configured timeout are required.

**Request worker draft** sends one public `task-worker-execute` request. RRFlow
owns permissions, selection validity, budget/capacity reservation and completion.
The native client uses the catalogue-derived, contract-validated SDK operation
with one send. The renderer receives no credential, endpoint secret, guessed
capability or provider ranking. The current UI handoff uses task text without
an additional historical-context selection; this is not project-file execution.

Draft output is rendered as text with its engine-returned attempt, selection,
binding, service alias and content/response hashes. It does not complete the
task or authorize training. The browser stores only task/attempt coordinates
before IPC. Errors and reload require readback, never automatic inference retry.
The same attempt reader returns worker output. Stop and budget reads remain
available during the request; remote termination is not inferred from Stop.

## Implementation identity

Connectome PR28 starts from clean PR27 head
`f8139cc725a6f546fdf177b522ff4772121bf8ca`, retaining PR26. All existing Rust and
TypeScript SDK pins move together to RRFlow worker candidate
`e35283303f4c5823c612686d32fb6bee1ac368ac`. Dependency lockfiles were regenerated
with Cargo and pnpm 11.24.0. Node requirements and both CI setup steps now match
the SDK's Node 24.22.0 minimum. No check is removed.

The exact engine was built using its canonical `scripts/build_rrflow.py`, with
clean embedded source provenance. The separate development artifact is
154,010,112 bytes, SHA-256
`8c323716f02e210ebc211bf4593dde84b03d1b55d50f62e710676cda5a971da0`.
It is unsigned and unoptimized, not an installer or qualified release.

## Checks and observations

The pre-edit PR brief records the current/target behavior, files, failure oracle
and limits. Reviewed README/CONTRIBUTING, task renderer/projections, native task
client/session handling, contract-owned worker request/output validation,
installed task/value tests, dependency checks, CI and previous desktop evidence.
No external algorithm was copied and no model performance claim is made.

The first native check found two unsupported `CorrelationId::to_string` calls;
they now use its existing `as_str` boundary. The first frontend check correctly
rejected the old engine-values fixture's source pin. Regeneration must run the
existing installed-process writer against the new exact engine, then pass the
non-writing verifier. Changing only the fixture's revision is not acceptance.
An initial pnpm executable guess was absent; the installed 11.24.0 command shim
was used successfully. A combined PR-creation shell command was rejected before
execution; separate file creation, resolved-target push and PR commands succeeded.

The projection test uses the actual prior native worker response in
`src-tauri/fixtures/task-worker-output.json`, attributed to the original result
SHA-256 `38014d0cddf8ea1763d93465a35cb8a1be36b3c0fc56c9315e878024f151c3ca`.
It checks retained content/identity projection and explicitly rejects a corrupted
copy. This is captured protocol evidence, not a new model observation or training
data. The installed task test adds missing-selection review/dispatch denial,
unchanged budget and absent worker-attempt readback against an actual engine.

The [validation record](evidence/controller-worker-20261031/validation.json)
binds the tested source-file hashes and retained log hashes. Actual commands:

- `cargo test --manifest-path src-tauri/Cargo.toml --locked worker_projection_tests`: one passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked`: 41 passed, 17 process cases ignored in this ordinary run.
- With the exact engine in `RRFLOW_BIN`, `cargo test --manifest-path src-tauri/Cargo.toml --locked rrd::client::process -- --ignored --test-threads=1`: 17 passed, none failed. The optional visual-seeding helper returns without capture inputs; it supplies no visual evidence. The remaining cases exercise installed engines.
- The focused installed task case passed independently, including worker preflight denial with unchanged budget and no recorded attempt. It overlaps the process suite.
- `CONNECTOME_WRITE_GOLDEN=1` with the existing `rrd::client::process::values` writer passed against the exact engine. The later full process run verified the refreshed fixture without that variable. All 12 values stayed equal; only the recorded source revision changed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`, native formatting and `git diff --check`: passed.
- Pinned pnpm `check`, `build` and `test:smoke`: passed, including 72 API examples, 18 value-model checks and four existing browser cases. These browser cases do not exercise the native worker action.

TypeScript typechecking also passed independently. Build warnings about inherited
vendor browser externals and large chunks remain. Raw commands/results and logs
are retained under SWAG `.swag/evidence/20261031/connectome-worker/`. No new
provider request or training/evaluation record was produced by this package.

## Remaining acceptance

Keep this PR draft. A real configured BF16 desktop request and reload/readback
on this exact composed build have not yet been observed. Prior UI screenshots,
worker CLI receipts and the captured projection fixture cannot substitute for
that trial. Engine PR206/222/229 and Connectome PR26/27 remain dependencies.
Safe uncertain-attempt reconciliation, ordinary-edit successor planning, governed
project effects, RROFLOW correlation, reviewed learning and native/container
qualification remain required outcomes of the full SWAG workflow.

## Main reconciliation, 6 November 2026

The ongoing PR28 integration reconciles worker head `91b89ae46ac23af70c852c79559bc59ecd62eed5`
with main `95ba9975c506886f79984ad956e5dba557369f93`. This carries the existing
Tasks handoff forward; no replacement dispatch API or client authority is added.
The five conflicted paths were dependency manifests/locks and the recorded value
fixture. Only revision/archive identities conflicted; retain the worker pin
`e3528330` for this merge, pending the current engine dependency's landing.

Main's native client, estate and instance lifecycle, startup tests, query-language
tests and quantization tests are byte-identical in the merged index. The worker
command, typed projections, renderer actions and denial tests retain their existing
implementation. Main's guided workspace and visual changes merge without edits.
This comparison checks those boundary objects and the authored worker diff; it is
not a line review of every imported asset or source file.

Frozen dependency installation and standalone TypeScript checking pass on Node
24.22.0. The first full check failed on Windows CRLF checkout bytes; restoring
694 files to their already committed LF bytes changed no indexed content. The
next run passed formatting, identity/isolation, 72 API examples and 18 value checks,
then correctly rejected main's query fixture because it records `15f36a87`, not
the worker pin. Preserve that failure. Regenerate both value and query fixtures
through their real-process writers after aligning the engine/SDK revision; do not
relabel evidence or remove checks. No fresh Rust/native or desktop success is
claimed for this reconciliation yet.

Engine PR229's current ready candidate is `a5dbb754`; its CI and protected landing
remain required. After landing, align this package's SDKs and bundled engine,
run native/process/frontend acceptance and repeat actual desktop handoff/recovery
with independent engine readback. Existing desktop receipts retain their original
source identities. Then reconcile PR29 budget recovery and PR30 project-plan
controls in dependency order. Ordinary-edit replanning, verified project effects,
correlated observations and independently reviewed learning remain unfinished.
Binary, score and choice and bounded LFG/SWAG assessment cycles remain the product
direction; this merge does not implement those engine decision contracts.

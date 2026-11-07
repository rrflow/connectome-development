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

### Current SDK qualification

The merged UI's old `e3528330` SDK failed compilation on main's existing
quantization estimator. Updating both SDKs to published engine candidate
`a5dbb754f78f3d3d877d2ac9bb42df04a47648bf` then exposed the required live-query
result-identity field. Both failures are retained; no quantization or subscription
behavior was removed to make the pin update compile.

The native live client now carries the result-identity version observed in the
initial engine query. Its returned view exposes that version with the cursor.
Explicit query continuation requires both, including cursor zero; missing identity
is refused before dispatch, and the engine rejects a changed version. A fresh
query obtains a new baseline explicitly. Durable reconnect keeps the original
version; it cannot silently adopt a newer engine identity. The TypeScript session
bridge passes the observed version without embedding a version constant.

The canonical engine builder captured clean source `a5dbb754`; its frozen Windows
dev executable SHA-256 is
`94989c49bf6cae7b04d273103336c158e87539dc22f9222eb3edc29dca7cc395`.
The staged sidecar's revision and hash match. This is an unsigned, unoptimized
engineering artifact, not a model-weight or distribution qualification.

Both fixture writers ran against that executable. All 12 value observations,
45 query observations and three engine vectors remain equal to the prior data;
only their recorded engine revision changes. Raw writer bytes are retained before
formatting, and the full non-writing process run independently checks readback.

Current checks pass: `pnpm check` (79 API examples, 18 value checks, 100 query
checks), TypeScript, Rust formatting and the complete 73-entry native suite with
`--include-ignored --test-threads=1`. That suite comprises 53 ordinary tests,
19 installed-process scenarios and one inactive visual-capture helper; the helper
is not visual evidence. Live tests include missing/stale continuation denial,
matching-identity continuation and actual added/updated/removed rows. Final frontend build and four rendering smoke tests pass after the live-session
projection change. Strict `cargo clippy --all-targets --locked -- -D warnings`
also passes. These checks do not perform a new model call or establish desktop
model/recovery acceptance.

Dependency resolution retains the existing package versions; Cargo reselected
socket2's already-locked Windows bindings from windows-sys 0.60.2 to 0.61.2.
Inherited cm6-graphql exact peer-version mismatches and browser/WASM/large-chunk
build warnings remain limitations of the inherited surfaces owned by sprint 009,
not evidence of release qualification. The worker boundary adds no such dependency.

Keep PR28 draft behind engine PR229's candidate/protected acceptance and landing.
The current desktop model/recovery trial remains required; the older published
trial is not relabelled. Continue through the existing budget-recovery and
project-plan PRs, then source-grounded context, verified project effects and
reviewed outcomes. Binary/score/choice execution and bounded assessment triggers
are not implemented by this compatibility repair.

### Current desktop handoff and recovery

The clean UI source `9651939c8dc1a40843f0a5b0061caa7a549ab0fa` built with
the matching identified `a5dbb754` engine and completed a fresh desktop trial.
Its unsigned Windows dev executable is 58,861,568 bytes, SHA-256
`09ad51711478a5c14e99d7d764f9d35fa4242c7ef42b25c2ead1850ab08e8070`.
The [validation receipt](evidence/controller-worker-20261106/validation.json)
binds source, artifacts and private original readback hashes. The initial launch
harness could not access its process environment; a recorded PowerShell launch
started the identified application. No model request preceded UI admission.

An isolated installed estate used the existing operator-configured experimental
BF16 profile. Through the actual Tasks UI, the driver recorded a
[real PR-derived task](evidence/controller-worker-20261106/task-input.json),
set two steps with 60-second step and 120-second run limits, reviewed controller
inputs, requested one proposal, reconciled its budget, reviewed the selected
worker and requested one draft. The worker returned HTTP 200, 646 prompt tokens,
176 completion tokens and 13,200 ms observed elapsed time. This is one candidate
with task text only, not source inspection, model ranking or weight attestation.

Reloading the desktop and selecting Recover last attempt restored the same
accepted worker attempt and content digest. Independent public-engine reads
before reload, after reload and after UI recovery returned equal task, budget
and attempt payloads; the readback driver permits no inference operation.
The [comparison](evidence/controller-worker-20261106/recovery-comparison.json)
records those equalities. Budget remains two reserved steps and 15,119 ms charged,
with no active attempt or uncertain remote execution. The task remains open.
No renderer error was captured. The published task/budget/attempt JSON files
are unchanged payload projections; credentials, local paths, configuration and
complete session logs remain private.

[Accepted draft](evidence/controller-worker-20261106/worker-accepted.png) and
[recovered draft](evidence/controller-worker-20261106/worker-recovered.png)
are original desktop screenshots, without fixture seeding or masking. They
establish this current UI handoff/reload boundary. They do not establish process
restart, ordinary-edit successor planning, project mutations, RROFLOW correlation,
independent quality review, training permission or native assessment bursts.
Candidate CI and engine PR229's protected landing remain required before merging.

The first evidence check rejected the new JSON formatting after Windows passed
a literal wildcard to Biome. Formatting the explicit evidence directory fixed
the input; independent comparisons confirm every published payload still equals
its original engine response. Private-marker checks cover the public JSON,
and the recovered screenshot was inspected before publication.

### UI attempt correlated with local RROFLOW

A second isolated trial on the same `9651939c` UI and `a5dbb754` engine extends
the driver through the existing native observation API. Its operator profile
admits metadata export to the existing local RROFLOW receiver; both credential
references are configured at process start. A new real integration task passed
through UI task admission, an explicit two-step budget, controller review and
proposal, worker review and one worker request. No earlier attempt was retried.
The actual worker used 651 prompt and 202 completion tokens, with 15,139 ms
observed elapsed time. The task remains open with 17,027 ms total budget charged.

The operator-side driver then invoked native observation prepare/deliver/read
for that accepted worker attempt. It did not construct a substitute event or
infer a result from a screenshot. The engine's retained source response equals
the actual worker readback, and its exact byte digest matches the receiver's
reference. Independent receiver readback found one event. After desktop reload
and UI recovery, delivery replay retained the same acknowledgment and receiver
payload, with one delivery attempt and unchanged model budget. No provider call
was requested by the export/readback driver. The UI supplies the task/model
interaction; observation export currently uses public engine operations from
the operator-side driver, not an observation button in Connectome.

The [correlation receipt](evidence/controller-worker-20261106/correlation/validation.json)
binds the original worker output, native delivery, receiver event, budget
readbacks and [recovered UI](evidence/controller-worker-20261106/correlation/worker-recovered.png).
Receiver binary SHA-256 is
`786b6c48e64fc7c5962b1b4dc427af1b06867f8c05a54669e096ebf27a9b82bb`;
its recorded build revision is `b4c04ceec6686db056b53bc48de44137c5c2f885`.
This proves local metadata correlation, not hosted deployment or reviewed
learning. Project-source and plan references remain null because this task used
text only; no source identity or task-success label was manufactured.

An additional forced engine stop/restart probe was rejected by automatic
approval review before execution, with reason "blocked by policy". Independent
process observation confirmed the original engine remained running and no stop
record was created. The rejected action was not retried. This candidate has UI
reload evidence, not a new process-restart claim. The correlation trial uses a
separate estate and does not replace or stop the earlier process.

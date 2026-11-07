# Selected project source for a worker draft

Status: candidate implementation in [PR39](https://github.com/rrflow/connectome-development/pull/39).
The installed-process adapter journey passes against native candidate
`91b6c6789e2e7d217e0873cff532bd53aa937581`. Native protected CI/landing and the
UI candidate/protected CI remain pending. The actual desktop source-packet
journey described below passed against those candidate revisions.

## Review one file

In **Tasks and model handoffs**, obtain and read back a controller selection.
Choose **Read project source inventory**, select an optional file, then choose
**Review worker and selected source**. Review its path, content digest and byte
bound before approving its export and requesting a worker draft. Leaving the
selection empty preserves the existing task-text handoff.

The picker reads typed inventory metadata through RRFlow's public query API.
It does not read file contents in the renderer or parse formatted query strings.
A full bounded page is potentially incomplete. Missing, null, redacted or
malformed metadata is not permission to select a file or invent its digest.

Inventory is a stored observation. RRFlow resolves the selected entry and checks
current source eligibility, permissions, export policy and task budget at dispatch
and completion. The UI approval does not create a grant or enable export policy.
Drafts show actual captured and validated provenance; they do not change project
files, establish correctness or authorize training.

## Edits and recovery

Use the existing [project-plan controls](project-plan-controls.md) to explicitly
preview and accept an eligible successor after an ordinary edit, then execute its
inventory steps. General refresh after completed or later-effect jobs remains
unavailable. Historical records without typed file metadata stay unselectable.

Selection and session changes invalidate review. Failed or withheld attempt reads
clear displayed worker output while preserving recovery coordinates. Late replies
cannot restore output after a context change. Budget reads remain usable while a
worker call is pending; a readback is never permission to repeat inference.

## Evidence and remaining dependency

The candidate engine pin is `91b6c6789e2e7d217e0873cff532bd53aa937581`, from
[native PR291](https://github.com/rrflow/rrflow-development/pull/291). Its
verified candidate binary SHA-256 is
`5739eb4a55230fbab829d218189289f7de687a69c277c4bf7a4fadeb01e40ec1` (174,968,832
bytes). This is candidate evidence; the pin is not yet treated as landed.

The ignored installed-process test
`selected_source_worker_roundtrips_through_installed_ui_adapter` passed 1/1. It
uses the public CLI to opt into `ProjectSourceRead`, then serves that installed
estate through Connectome's existing process adapter. It reads the typed public
inventory, selects one file by entry identity/content digest, reviews the exact
source request, and sends one source-derived worker packet to a controlled
loopback protocol fixture. The packet is checked against typed source
provenance, including the path digest; the test does not add a raw path field to
the production packet. It then checks export-denial and stale-source refusals,
retained-output withholding and restoration, and budget/attempt readback after
restart with a fresh authenticated session. An active session is durable across
process restart, so the test explicitly closes its old control session before
checking the closed-session refusal on the new address.

The source query returned two rows with unavailable file projections. They are
unselectable and their count is ambiguous among legacy, redacted, and non-file
records; the test does not infer which explanation applies. The selected file's
path, digest, and byte count are checked independently. The test makes no live
provider or model-quality claim; its loopback response is only a controlled
protocol fixture.

Local validation on the candidate source included:

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` (pass).
- `cargo test --manifest-path src-tauri/Cargo.toml --locked rrd::client::tasks::source_projection_tests -- --nocapture` (4 passed).
- `RRFLOW_BIN=<verified 91b6 candidate> CARGO_BUILD_JOBS=1 cargo test --manifest-path src-tauri/Cargo.toml --locked rrd::client::process -- --ignored --test-threads=1` (25 passed).
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked -- --test-threads=1` (58 passed, 25 ignored).
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings` (pass).
- Node `v24.22.0` / Corepack pnpm `11.24.0`: frozen install and `pnpm check` (pass), `pnpm build` (pass with existing chunk/dynamic-import warnings), and `pnpm test:smoke` (5 passed).
- `node scripts/engine/build-sidecar.mjs --check` (pass).

Review covered the complete `process.rs` diff and the installed-test/helper
changes in `process/attunement.rs`; prior review covered the rest of that test
module. The separate pin/lock and canonical fixture diffs were also reviewed
and limited to the 91b6 SDK references and fixture revision updates. The local
ignored sidecar check passed but is not a committed source change. Native
protected checks/landing and UI candidate/protected CI are still required
before treating the joined source-aware journey as landed. Browser smoke
responses are controlled fixtures, not installed authorization or live-provider
evidence. Live BF16, generic binary/score/choice assessments, assessment cycles,
file effects, and learning require their own evidence.

## Actual desktop observation

On 7 November 2026, the desktop built from UI source
`0b40317a1d63862d2c6573bb3e73847725e8b878` used the native candidate above.
Its executable SHA-256 was
`2445aa2f9e7c91bb8933515c40cddcaf0a02254db6b0e08fe0cc3bafb636e714`.
The public install CLI enabled source read for a new, isolated project.

After an ordinary project edit, the desktop previewed and accepted a successor
plan and inventoried it. The operator then created a task, obtained and read back
one selection, reviewed the source digest and byte bound, and explicitly approved
export of the actual 8,767-byte SWAG decision-modes document. The controlled
loopback endpoint received exactly one selector request and one worker request.
Independent checks matched the source bytes and path digest, packet, request,
response and returned-content hashes to RRFlow's protected attempt readback.

Disabling source export through public configuration preview/apply withheld the
retained output and cleared the desktop draft. Restoring export recovered the
identical attempt. Stopping and starting that project through the desktop opened
the same estate at a new address; **Recover last attempt**, followed by
**Read budget and attempt**, displayed the same result and provenance. A separate
public API session verified exact attempt and budget equality after restoration
and restart: two steps reserved, 76 ms charged, and the original deadline.
No additional provider request occurred during these reads.

This establishes the controlled source-handling and recovery journey. The
fixture reports received bytes only; it is not a model assessment, reviewed
training outcome, file-editing worker, or proof of complete project fulfillment.

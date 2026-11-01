# Controller proposals in the project workspace

Status: COMMITTED, 2026-10-30. Source: owner's standing instruction to implement
the SWAG → Connectome → RRFlow workflow, with engine authority and real evidence.
This records an implementation decision within that authorization; it does not
claim the owner separately reviewed this document.

## Decision

The current workspace has no task surface (`RuntimeConnection/index.tsx:334-341`).
The native client pins sessions across concurrent requests (`rrd/client.rs:489-588`),
but its 30-second request timeout cannot cover all configured controller calls.
Engine PR222 supplies the validated single-send proposal binding; it is draft.

Options considered:

1. **Extend the native task client and project workspace.** Keeps credentials and
   authority in their existing owners; enables real proposal/readback/Stop. Requires
   coordinated SDK pins and native-process checks. Impact: native bridge, task view,
   dependency locks and engine fixture. Medium effort. **Chosen.**
2. **Renderer HTTP dispatch.** Less bridge code, but exposes authenticated transport
   to the webview and conflicts with backend governance. Impact: security boundary
   and duplicated protocol validation. Medium effort; rejected.
3. **External Python launcher only.** Reuses prior proof tooling, but does not deliver
   the requested integrated user workflow. Impact: separate credentials and lifecycle.
   Small effort; rejected as the product integration.

## Constraints and COSTAR

Context: current public main `5ba5a9d5`, engine dependency PR222 `61ddb264`.
Objective: real task creation/readback, explicit budget and controller request,
read-only attempt recovery, independently available Stop. This is a proposal slice;
it cannot claim worker execution, source replanning, learning or model qualification.
Style: existing Mantine workspace, native Rust SDK validation and bounded projections.
Tone: accurate observed states and actionable errors. Audience: owner and future
Connectome contributors. Response: code, draft PR and reproducible verification.

No model/provider defaults or training examples. No provider call on page load,
refresh, reconnect or readback. Missing endpoint policy is visibly unavailable.
Task/configuration digests must match what the operator reviewed. Session leases
must outlive the configured call; unsupported durations fail before dispatch.
Persist only last-attempt coordinates in the UI, never authoritative results.
Keep PR24's project-engine lifecycle separate. Engine dependency and required CI
must land before this integration can be represented as merged or releasable.

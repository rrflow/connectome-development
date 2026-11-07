# Actual desktop task recovery

Status: verified Windows preview observation; dependency and release qualification open.

## Sources and scope

Clean UI revision `0f75c015c0687a554cdf2b1a48c36488f8113aee` was built with
the staged RRFlow `6a4cbb042a13f5a7c41b53d11d62b54a85df3bed` executable.
The independently copied unsigned preview contains:

- `connectome.exe`: 52,248,064 bytes, SHA-256
  `1cdee435a65acaa92dedabccfd50e4555c210cdfa5be241465a41453ca4ef926`.
- `rrflow.exe`: 154,068,480 bytes, SHA-256
  `d4cc99d8527b97ba145023e0b1cc4a7c26a0682f6edc8c2d5d8d9ff1ad4ffec0`.

The [implementation journal](controller-task-recovery.md) records component
checks and their limits. This observation uses the actual native application,
its public SDK boundary and a separately served fresh estate using the same
engine binary. It is not an installer, clean-machine or fleet deployment test.
The existing admission harness prepared explicit endpoint policy without provider
credentials; subsequent UI actions used an operator-configured credential mapping.

The task comes from captured public PR29 title/body/revision. The UI first rejected
the full body at the engine's 4 KB goal bound. After task-list readback, an explicit
4,096-byte source projection was entered; the textarea normalized 24 CRLF pairs,
leaving the exact observed 4,072-byte goal. Both source digests and that verified
transformation are retained. No task text, response, ranking or label was invented.

## Observed journey

The UI recorded the task and explicitly configured the estate's observed limits:
256 steps, 60,000 ms per step and 900,000 ms total. It reviewed the configured
candidate and requested one real controller proposal. Public readback confirmed
an accepted selection with one step and 2,048 ms charged.

**Stop task budget** persisted `cancelled`. **Resume task budget** removed that
stop without changing the task, accepted selection, original deadline, allowance
or spent effort. Relative to the pre-Stop budget, the resumed budget differs only
in its observed clock; all fields were compared. Resume dispatched no model.

The user-facing worker review then displayed current task/configuration and the
retained selection. One explicit worker request returned an accepted draft. It
spent one additional step: the final budget has two steps and 22,528 ms, no active
attempt, no stop and no unknown execution. The original deadline remains intact.
The task stays open; a draft does not authorize or execute project-file changes.

Webview reload discarded the displayed result. **Recover last attempt** restored
only coordinates; **Read budget and attempt** obtained the retained worker and
budget. Independent public reads before reload, after reload before UI recovery,
and after UI recovery compare the task, both attempts and final budget exactly.
No additional attempt or spent effort appeared. The original selection stayed
unchanged throughout Stop, resume and worker execution.

The selected service reported 2,014 ms for selection and 20,445 ms / 263 generated
tokens for the worker. These are isolated observations, not performance or routing
quality measurements. One candidate was configured; its alias is not weight
attestation. No training consent or reviewed label is inferred.

## Evidence and corrections

[Manifest and 44 observations](evidence/controller-task-recovery-desktop-20261031/manifest.json)
bind the executable/source identities, actual HTTP payloads, task projection,
invariants and UI screenshots/text. The actual provider and local operator
credentials were scanned before publication; neither credential nor estate is
published. JSON uses the existing Biome formatter. Every original capture digest
is retained alongside its publication digest, with exact JSON-value equality
verified after formatting; screenshots remain byte-identical. Accessibility text
is losslessly compressed, with decompressed bytes matching each original digest.

Retained corrections are explicit: the startup observer first used the wrong
announcement field name after its engine was already listening. The same live
process was inspected and retained; it was never relaunched. The first task input
was oversized and rejected. The first raw-input hash assertion failed because it
did not account for textarea CRLF normalization; the later check proves that
exact transformation, without changing task state or repeating a provider call.
Native UI geometry required refreshed observation and scrolling for offscreen
controls. These failures do not become successful trial claims.

The owned UI was closed and its process absence checked. The external owned
engine was stopped after readback and waited for; its exit receipt is retained.
All earlier estates and trials remain untouched. The pre-publication PR29 brief
covers this journal, selected observations and workbench link. No runtime or
model call is repeated for evidence publication. Raw captures and command logs
remain in SWAG `.swag/evidence/20261031/connectome-resume-live/`.

The first publication check rejected CRLF line endings introduced when the local
writer finalized the manifest. Biome corrected that manifest only; captured
payloads, JSON values and publication digests are unchanged. The subsequent full
`pnpm check` passes: 480 formatted files, 73 generated API examples, 18 value-model
checks, dependency authority, version and TypeScript validation. A subsequent
whitespace check identified actual blank accessibility text nodes with trailing
spaces. Those raw text captures are now lossless gzip artifacts; no observed text
is trimmed and no source or CI rule is relaxed. The staged
artifact hashes are checked against the manifest before commit. Runtime suites
and actual model calls are not repeated for this evidence-only change.

Engine PR206 has merged at `5b4039fe930332895c1b24138891d39f600030c7` after its
protected run passed. Remaining engine/UI dependencies still require landing.
Unknown-outcome reconciliation, ordinary-edit replanning, governed project
effects, RROFLOW correlation, independently reviewed learning, model qualification
and native/container/public release remain open. This observation advances the
task-recovery part of the full workflow; it does not close the alpha objective.

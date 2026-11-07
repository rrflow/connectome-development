# Selected project source for a worker draft

Status: draft integration in [PR39](https://github.com/rrflow/connectome-development/pull/39).
The typed inventory query and UI controls have local verification. An installed
source-aware worker call and its protected readback are not yet qualified.

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

The current SDK and engine pin is `0224a82a87021bcf0e55fe9dae6fea271dcc7f7d`
from [native PR289](https://github.com/rrflow/rrflow-development/pull/289).
The real installed query test exercises an edit, explicit replan and inventory,
then compares the selected file's observed digest and byte count. Parser tests
and controlled browser disclosure/recovery tests pass. Browser responses are
protocol fixtures, not model or installed-authorization evidence.

This engine's public installation flow cannot provision `ProjectSourceRead`.
[Native PR291](https://github.com/rrflow/rrflow-development/pull/291) owns an
explicit installation choice. This UI must consume that tested dependency and
demonstrate review, worker execution and independent authenticated readback/reopen
before the source-aware journey is accepted. Live BF16, generic binary/score/choice
assessments, assessment cycles and learning require their own evidence.

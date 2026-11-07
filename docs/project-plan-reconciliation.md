# Project plan integration and receipt correlation

## Scope and source identity

PR30 reconciles `1f2e2a5c96edf7b783297e0f960abed1be9aa955` with protected
PR29 landing `f4623071baafd8e2618d56f26a829df1931f6963`. The latter passed all
six protected jobs in run `42333340356`; its tree equals the tested candidate.
The PR description carried the reconciliation brief before edits and the receipt
display amendment before that addition.

Both SDKs and lockfiles retain engine revision
`f45305394dbe391786c7d618645a5fc0b1b2bbee`. Native PR230 landed separately at
`5f8a7e3679318d235356f4475e9cb8349423929d`; that landing does not rename the
tested binary. The staged engine SHA-256 is
`086c42cec160de19104a67976f7608f74e61d86000f66e4c2c310a2ffd9a8af3`.

## Reconciliation and review

All seven conflict paths were resolved. Independent object comparisons preserved
23 UI30-only and 588 incoming-only paths before intentional navigation, guide and
smoke changes. Review covered overlapping registration/session owners, native
pending state, panel composition and navigation; object comparison is not a
line-by-line review of the inherited tree.

Project plan now appears under **Reasoning**, alongside Tasks, inside the current
workspace shell. Old `/plan` bookmarks resolve to `/reasoning/plan`. Native
attunement and quantization pending state remain separate; their inherited
session-close behavior is preserved. The prepared command's existing request key
is displayed read-only for receipt correlation. No new permission or mutation
operation is introduced by that display.

## Validation

Node 24.22.0 and pnpm 11.24.0 were used, including the nested preview server.
Frozen dependency installation, frontend checks, production build and all four
browser smoke tests pass after the receipt display change. Checks include 80 API
examples, 18 value-model checks and 100 query/vector checks. Browser smoke proves
disconnected navigation, the old bookmark, the session-required Tasks view and
the intercepted HTTP read boundary; it does not prove native authorization.

With the verified staged engine, all three focused project-plan scenarios pass.
The full process suite passes 23 entries, including one inactive visual-capture
helper; both actual-engine value and query fixtures match without regeneration.
The ordinary native suite passes 54 tests, with 23 process entries deliberately
ignored there. Strict Clippy (`-D warnings`) and formatting pass.
The [validation manifest](evidence/project-plan-reconciliation-20261106/validation.json)
records commands, identities and hashes of retained logs.

Retained failures include the old staged engine manifest mismatching the new pin
(corrected through the canonical staging script), a strengthened smoke assertion
expecting the connected Tasks heading in disconnected preview (corrected to its
actual session-required alert), and an atomic patch rejection from incorrect
guide context. No failed result was relabelled. The merge's older-parent
whitespace check reports inherited archival formatting; the change relative to
the protected landing is clean. Build warnings about inherited WASM resolution,
externalization, mixed imports and large chunks remain unresolved.

## Remaining acceptance

The historical [project-plan evidence](project-plan-controls.md) remains under
its original identity. A clean current desktop build and actual ordinary-edit,
stale-preview denial, fresh approval and correlated receipt/reconnect journey are
still required. A controlled source projection will establish that bounded UI
journey, not a completed development task. Successor execution, source-grounded
worker context, project-file effects, reviewed learning and binary/score/choice
assessment cycles remain separate work. This candidate is not release-qualified.

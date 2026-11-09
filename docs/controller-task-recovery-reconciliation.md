# Task recovery after worker integration

Status: source reconciliation and current desktop acceptance are documented;
native landing and protected UI acceptance remain pending.

## Source and behavior

[PR29](https://github.com/rrflow/connectome-development/pull/29) incorporates the
landed worker UI at `1032dd05e536e98f7b69eb55bdd64129a7472c31` through an ordinary
merge into `59526643f0a6d7ae8ef04d1858d988af6d6e1efd`. The six conflicting files
are the workbench guide, two manifests, two lockfiles and the engine value fixture.
Only conflicting hunks were resolved; worker execution, observation delivery and
the existing recovery implementation are retained.

Both SDKs and the staged engine now identify native PR230 candidate
`f45305394dbe391786c7d618645a5fc0b1b2bbee`. The independently verified executable
reports that clean source and hashes to
`086c42cec160de19104a67976f7608f74e61d86000f66e4c2c310a2ffd9a8af3`.
The sidecar manifest and lock agree. This is a debug developer executable, not a
qualified release. The value and rrflowQL query fixtures are regenerated through
their existing writers against this actual engine and independently checked
without write mode. All 12 values, 45 query results and three query vectors match
the landed parent; only their engine identity changes.

Resume retains the original deadline, allowance, spent effort and attempt history.
It does not call a model. A separate request follows explicit input review;
unknown remote execution, stale authority and exhausted budgets remain denied.
The [earlier implementation](controller-task-recovery.md) and
[desktop observation](controller-task-recovery-desktop.md) keep their original
source identities. They do not constitute a fresh desktop trial of this merge.

## Dependency review

Canonical package managers regenerated both lockfiles. The unrelated socket2
Windows binding reselection was restored to the exact landed package block;
locked Cargo metadata accepts that resolution. The remaining dependency changes
are the RRFlow SDK source pins and the generated TypeScript package integrity.

The peer check still returns 1 for five cm6-graphql 0.1.1 requirements: autocomplete,
language, lint, state and view require older exact CodeMirror versions than the
installed graph. These are unresolved compatibility issues, not false positives.
Their dependency entries are unchanged from the landed parent and their inherited
surface remains owned by [sprint 009](../.agents/sprints/009-connectome-ownership.md).
Successful workbench checks cannot establish complete GraphQL editor compatibility.

## Validation boundary

The value writer/readback and focused installed task recovery check pass. The
first full process run passed 19 entries and failed the inherited rrflowQL fixture:
its engine identity still named the predecessor. The failure is retained. The
published brief was amended before running that fixture's canonical writer;
its subsequent independent language readback passes. The failed run's diagnostic
printer also encountered a Windows console Unicode error after saving the actual
test exit and complete log; the continuation uses UTF-8 output.

The corrected full process run passes all 20 entries: 19 installed scenarios and
one inactive visual-capture helper, which supplies no visual evidence. The ordinary
native suite passes 53 tests with those 20 process entries ignored. Strict Clippy
(`-D warnings`) and Rust formatting pass.

Frozen installation, `pnpm check`, production build and four browser smoke tests
pass on Node 24.22.0 and pnpm 11.24.0. The frontend checks cover 80 API examples,
18 value checks and 100 query checks. An earlier continuation inherited Node
24.21.0; its results are retained separately. The first pinned smoke invocation
then stopped before tests because its nested server command found global pnpm
12.16.1. A process-local official Corepack shim path corrected that resolution;
the final smoke run used the unchanged verified build. No global tools, project
version policy or test assertions changed.

Inherited vendor WASM resolution, browser externalization, mixed import and large
chunk warnings remain. Full staged whitespace checking also reports ten incoming
historical Markdown files; their blobs match the landed parent exactly. The
resolved source scope passes. The [validation record](evidence/controller-task-recovery-reconciliation/validation.json)
binds source hashes, commands, results and raw-log digests. The fresh source-bound
desktop Stop/resume, separate worker request, reload and independent readback are
now documented in the [current desktop observation](controller-task-recovery-current-desktop.md),
with sanitized [manifest](evidence/controller-task-recovery-current-desktop-20261106/manifest.json)
and [readback](evidence/controller-task-recovery-current-desktop-20261106/readback.json).

Native PR230 must pass candidate and protected CI and land before this UI merges.
The UI also requires its own candidate and protected checks. Source-edit successor
planning, verified project-file effects, the complete RROFLOW workflow, independently
reviewed learning and release qualification remain separate acceptance work.

SWAG's binary, score and choice modes and bounded LFG/SWAG assessment cycles remain
native integration work. This recovery prerequisite does not add a trigger service,
authorize effects from model scores, or establish model quality or memory targets.

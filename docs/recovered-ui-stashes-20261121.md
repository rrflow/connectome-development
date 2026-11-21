# Recover the two Connectome UI stashes

Status: integration in progress; no completion claim.

Baseline: 26d1f83cf9fb10118f6e93dee70750f30ca7db3c. This package integrates
recovered stash commits 8cf93f88632928a9b0a101d01ec472d2c71f4339 (graph catch-up)
and 3e644ed080e068b4756f94e5dd47444c8a7e88db (installation preview and errors)
through ordinary merges, then candidate CI and the merge queue. The owner has
explicitly requested integration rather than another comparison-only report.
The existing absorption-ledger.md remains the historical inventory owner.

Source boundaries: src/features/runtime/live/use-live-changes.ts and its browser
scenario; package.json and src/components/ActionBar/projects.tsx, whose current
installation components remain the canonical destinations. Preserve later
changes when resolving conflicts. Do not reset the tree to either historical
snapshot or drop tests. These source commits have two parents and no untracked
third-parent tree. The source objects and recovery bundle are readable locally;
git bundle verify on connectome-recovered-objects-20261120.bundle passed.

Acceptance: pnpm check, pnpm build, the graph cache catch-up browser scenario,
installation-facts checks and full browser smoke, then required native and
process CI. This does not qualify the whole UI, change the installation layout,
or claim completion of other historical branches. No external research or new
runtime telemetry is required for merging these existing changes. Stop and
repair conflicts, test failures or missing dependencies before queueing.

Merge outcomes, exact revisions and validation will be recorded below.

## Local merge results

- 8cf93f88632928a9b0a101d01ec472d2c71f4339 merged as 71e72484.
  The browser helper had moved to tests/smoke/support/diagnostic.ts. Retained
  that helper with liveHead/commitWhileClosed, the catch-up scenario and later
  failure/engine-view scenarios rather than duplicating the old inline helper.
- 3e644ed080e068b4756f94e5dd47444c8a7e88db merged as 37c65f9a.
  Kept the full check chain including installation-facts. Resolved the old inline
  project form into AddProject and ProjectRow: preview remains explicit, errors
  stay on the affected project, and mode is selected from the folder by the
  existing native preview instead of restoring the old manual mode switch or
  four-project limit.

These are ordinary merge commits retaining the recovered work commits as parents.
The resolved application tree has no new feature delta against the starting
main: these two stash behaviours were already represented by the current code.
This package closes their outstanding Git integration; it does not establish
that unrelated missing features are implemented. No source object was deleted.

Local verification: pnpm check and pnpm build passed. The browser scenario
'a graph cached before the engine moved on is refreshed when the tab opens'
passed (one test). Full browser smoke passed: 36 tests. Required hosted candidate and queue gates remain pending.
Logs: D:/.usr/Temp/rrflow-project-policy-20261121/recovered-ui-{check,build,graph,smoke}.log.
Native checks are assigned to the repository candidate and merge queue. No
interactive desktop trial was run. No broader parity status is advanced.

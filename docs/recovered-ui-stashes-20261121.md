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

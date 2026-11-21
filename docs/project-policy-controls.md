# Live project policy controls

## Change brief ? 21 November 2026

Baseline 26d1f83cf9fb10118f6e93dee70750f30ca7db3c. Depends on RRFlow PR458,
9b35ccaf2b94cc064178be15bb993ac0be7045a2, through the one pinned public SDK.
Owning engine outcome: Gate D D-01/D-06, POAM-077. This session owns the joined
edit, preview, approve, query and independent readback driver.

Currently Connectome has no scoped policy controls and caches installed query
budgets. Add System / Policies and preferences to existing navigation, preserving
all workbenches. Show project numeric rules, bound user rules, effective values,
conflicts and provenance. Prepare exact engine plans in the native process;
renderer approval names an opaque handle. Preserve uncertain outcomes and permit
explicit same-command retries; never silently replace or replay an approval.
All contract integers cross the webview as decimal text. Project sessions remain
isolated. No global write is granted by a project connection.

Source map: native client.rs and query/artifact/live/tasks consumers; new client
configuration module and shared lossless projection helpers; rrd.rs/main.rs command
registration; session.ts and SDK-derived configuration projection; new feature and
route; query result projection and query-answer display. Existing attunement
projection helpers move to a shared native boundary with original tests retained.
Remove cached query budget after all consumers use effective configuration. Add
actual query admission provenance, not a diagnostic read presented as execution.
Both language SDKs and engine input retain one exact revision.

Read before implementation: README, package/Cargo manifests, CI workflow,
dependency and file-size gates; native client/attunement/query/startup/process
harness; artifact/tasks/live budget consumers; session, plan panel and project
context; route metadata/menu projection; query result/view. Existing engine
ADR-0006 supplies researched policy semantics; no new external algorithm claimed.

Failure oracle: preview cannot mutate; approval cannot change prepared payload;
stale/session-replaced plans refuse; changed limits govern the next query without
reconnect; returned admission matches that edit; restart retains it. Native process
tests, frontend checks/build/browser smoke, strict native lint/tests and an actual
desktop trial provide separate evidence. Stop on cross-project leakage, weakened
requirements, missing exact dependency or an unresolved candidate gate. Do not
mark this complete before joined readback and green queue evidence.

## Evidence

Implementation, failures, exact commands and results pending. No UI or release
qualification is claimed by this initial brief.

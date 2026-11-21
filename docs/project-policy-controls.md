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

Implementation is present; desktop and candidate/queue validation remain pending.
This is not whole-platform parity or release qualification.

The native client now reads effective budgets for query, export, live-query setup,
source inventory, cold-history reads and observe-flight recall. Request limits
are revalidated by the engine; a race can refuse a request, never silently weaken
policy. Query results carry decimal-text admission identity. Read/prepare/approve
use the pinned engine API; user policy is visible but not writable from a project.
Project rules are full snapshots effective from preparation time onward. Existing
future or past intervals are inspectable in raw evidence; this UI does not yet
edit arbitrary historical coordinates or user-source bindings.

Uncertain approval retains its plan and request identity natively, and the UI
stores only its digest, scoped to profile and instance. A matching stored head
proves success without replay. A superseding head cannot prove an older outcome;
the UI preserves that unresolved state. A first explicit CAS conflict denies the
edit; a later conflict after a lost reply does not disprove an earlier commit.

Traceability additions: query row/provenance view moved from oversized view.rs to
view/query_result.rs; existing native installation approval test moved unchanged
from oversized process.rs to process/startup.rs. The existing real reply-dropper
moved from the attunement test into process/reply_dropper.rs and is reused by both
journeys; no generated reply substitutes for the engine. Original behavior and
tests are retained. Helpers for decimal projection/refusal classification are
shared with attunement; only project CAS conflicts use the new scoped handling.

Local Windows evidence (Node 24.22.0, pnpm 11.24.0; native cache
D:/.usr/Temp/rrflow-project-policy-20261121/connectome-target, four Cargo jobs):

- Native contract check passed; 88 regular native tests passed, 34 opt-in ignored.
- Strict native all-target clippy passed.
- Both new installed-process policy scenarios passed: live query budgets and
  stamp, stale approval, foreign handle, isolation, discard and restart; actual
  lost reply, readback reconciliation and no duplicate effect.
- Three real-engine golden checks regenerated values, query language and offer
  from engine 9b35ccaf2b94cc064178be15bb993ac0be7045a2. Six new operations since the
  old UI pin are exposed through the existing generated API surface.
- Frontend full check and production build passed; inherited parity report stays
  unmet (289/348 capabilities not fully native; 66/66 visual comparisons open).
- Focused browser policy scenario passed. Full browser smoke still running.

Recorded failures: old staged engine revision was refused by build.rs; its
ignored manifest is preserved in scratch, and development uses an explicit new
engine. First process attempt passed Cargo's hard-linked output to installation,
which correctly refused it; a private byte-identical executable copy fixes the
input. The first stale-edit test exposed retryable CAS conflicts misclassified as
uncertain; scoped handling fixes it without relaxing lost-reply behavior. An
initial test incorrectly expected SQL LIMIT above budget to refuse: the engine
correctly truncates to its admitted row budget. The corrected oracle asserts two
rows plus truncation, and separately proves an explicit over-budget request is
refused. One async capture compilation error was corrected. Initial UI icon name,
manifest formatting and stale golden pin checks failed and were repaired. No gate
or enforcement weakened.

Canonical debug engine receipt is retained in session scratch. It reports dirty
source because the UI submodule is in progress; local debug evidence is not a
clean staged distribution claim. Hosted process CI builds the exact pin from a
clean checkout, verifies provenance, stages its sidecar and reruns the process
suite. Package source review covers the mapped modules and complete changed
regions; unrelated source was not exhaustively reviewed.

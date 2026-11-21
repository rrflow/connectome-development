# Recovered view-registry branch integration

Status: active integration; candidate and queue pending.

Baseline ed53cfdbd216db73b72a523311fdebadfd458c26. Integrate the recovered
F4b branch cbb3da9176c8150f0af25673ced5c7b0dc06e164 and its parent
ec5454eaa6238f8cc375ba5382a5e7e13226fd2a by ordinary merge. The owner
requires recovered source to reach main through a green candidate and queue.
[The absorption record](absorption-ledger.md) maps this branch to current
route-driven navigation, VIEW_NEEDS, ViewGate and the lifecycleState correction
from PR90. [The native client requirement](native-client-requirement.md) remains
open; this merge does not qualify inherited capabilities or visuals.

Read README, source/current registry, recovered project-view adapter and the
branch's changed-file list. Scope is those registry, view-gate, navigation,
store and catalogue-check boundaries, plus this evidence and its README link.
Read conflict source and current callers before resolving. Retain per-project
starting/stopping/stopped/failed states, real catalogue/capability admission and
experimental disclosures. Route files own available navigation; do not restore
an old built/planned list that hides currently implemented views.

First oracle: existing view-registry and lifecycle checks. Then pnpm check,
pnpm build and browser navigation/instance-state coverage. Required candidate
and merge queue must pass. Stop on lost view/state, bypassed capability checks
or missing engine catalogue input. No new research, trace, benchmark or engine
contract needed. Record actual source delta and results below.

Conflict review found a real remaining gap: current ViewGate renders children
when the required catalogue is unread or unusable; the recovered registry
returned instance unknown before its offer was read. Restore explicit waiting
and failed catalogue states at src/features/runtime/project/view-gate.tsx,
with retry and a browser regression asserting gated content is withheld until
a valid offer arrives. Keep untracked remote connections governed by their
public handshake, rather than restoring the obsolete global statusRead flag.

## Integration result

PR112 resolves the old inline RuntimeConnection index/workspace/views into the
current route files, project layout, ViewGate and VIEW_NEEDS. The incoming
mislocated graph/views.tsx and removed inline screen files are not recreated.
Their instance states, capability notices and navigation survive at those
current boundaries. The obsolete built/planned registry is not a second source
of route availability. Current Engram naming, native offer process test,
generated offer and full package check chain are retained.

Recovered unknown-offer behavior was genuinely missing in ViewGate: unread or
failed catalogues rendered children. The current gate now waits, reports read
or malformed-response errors with retry, and admits children after a successful
offer. It includes websocket operations in the same offer. The new browser
regression failed against the previous production build, then passed after the
repair; it exercises delayed response, 503, malformed payload and successful
retry. This uses a controlled public-response fixture, not a real-engine or
whole-UI qualification claim. Existing lifecycleState still handles tracked
starting/stopping/stopped/failed instances; an untracked remote connection is
assessed by its handshake and catalogue.

Read both registry implementations, recovered project view adapter, current
ViewGate, current store, both native offer tests, registry checker and affected
navigation/store merge hunks. pnpm check and pnpm build passed; the focused
browser regression passed. Full browser suite and hosted candidate/queue are
pending. No native Rust source delta remains; the pinned-engine process test
will still run in required CI. Native-client parity remains unmet.

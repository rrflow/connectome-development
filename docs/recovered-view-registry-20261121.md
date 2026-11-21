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

# Parking Lot 006 — Provider-agnostic host and API seams

**Status**: COMMITTED — Option B, cross-repository prerequisite  
**Date**: 2026-09-16  
**Source**: Operator restatement that OpenAI/ChatGPT/Codex and
Anthropic/Claude hooks and triggers must enter one provider-agnostic RRFlow
seam with explicit coverage of both providers' complete supported API catalogs  
**Decision authority**: This Connectome record preserves the product dependency.
RRFlow owns the contracts and implementation and must schedule them through its
canonical roadmap/change-authoring process.

## COSTAR profile

- **Context**: An earlier RRFlow revision contained Claude-shaped lifecycle
  hooks, a harness registry, and an engine-owned RRFlow tool catalogue. A later
  consolidation deleted them. Current RRFlow plans host-event adapters but has
  not created them; Connectome has only static display labels.
- **Objective**: Ensure Codex/ChatGPT and Claude host events, plus OpenAI and
  Anthropic API capabilities, enter typed provider-neutral RRFlow boundaries;
  expose installation, coverage, state, evidence, and failures coherently in
  Connectome.
- **Style**: Generated/catalogue-driven coverage, stateless provider adapters,
  canonical envelopes, provider-specific extensions preserved at the edge,
  engine-owned authorization/triggers/routines, and no duplicated lifecycle.
- **Tone**: Correctness first. Missing coverage fails visibly rather than
  degrading silently.
- **Audience**: RRFlow engine maintainers and Connectome operators/developers.
- **Response**: Preserve this as a blocking prerequisite, implement it in
  RRFlow under its owning gates, then project its generated catalogues and
  evidence in Connectome.

## What exists and what is missing

### Earlier implemented foundation

At RRFlow revision `4513c68048955efd3a55f80be685ed0d60203a2d`:

- `crates/rrd-engine/src/runtime/init.rs:160-190` generated Claude Code wiring
  for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, and
  PreCompact.
- `crates/rrd-engine/src/runtime/hook.rs:1-101` translated Claude-shaped JSON
  into one engine dispatcher.
- `crates/rrd-engine/src/runtime/registry/claude-code.toml:1-13` declared Claude
  hooks and MCP support.
- `crates/rrd-engine/src/runtime/registry/codex-cli.toml:1-13` explicitly
  declared that Codex had no hooks and degraded to AGENTS.md plus MCP.
- `crates/rrd-engine/src/runtime/tools.rs:55-72,594-667` owned a stable RRFlow
  runtime-tool catalogue for MCP and future provider adapters.

That foundation did not cover the complete current Codex or Claude hook event
sets, and its tool catalogue covered RRFlow operations—not the complete OpenAI
Responses/Realtime/Agents platform or Claude Messages/Batches/Files/Skills/
Agents/Sessions/Environments platform APIs.

### Deletion and present state

RRFlow commit `544872262f59d435def341f2c5317055afa75845`
(`refactor(rrd): consolidate context and persistence authority`) deleted the
hook dispatcher, installer, harness registry, lifecycle contracts, RRFlow tool
catalogue, provider fixtures, and their conformance tests.

At current RRFlow revision `676fe533366349dc7f3c2340129e1a3a332c7f30`:

- `docs/objectives/rrflow-1.0-alpha.md:56` says canonical engine events,
  persisted triggers, routines, skills, and host-event adapters do not exist.
- `docs/roadmap/rrflow-1.0/gate-i.md:13-19` leaves all seven automation packages
  open; I-04 requires equivalent Claude/OpenAI/reference adapter envelopes.
- `docs/roadmap/rrflow-1.0-file-plan.jsonl:55-62` plans but has not created
  `rrflow-host-events`, `claude.rs`, `codex.rs`, `reference.rs`, or conformance
  tests.
- `AGENTS.md` explicitly ships no provider-owned automatic hook and requires
  clients to avoid a parallel lifecycle authority.
- `docs/reference/client/connectome.md:299-300` classifies Connectome's static
  automation/provider-flight models as duplicated client authority to remove.

In Connectome, `src/rrflow/attunement.ts:106-124` contains display-only
definitions for Trigger, Routine, Hook adapter, and Skill. They invoke nothing,
translate nothing, and prove no provider integration.

## Options

### Option A — restore the deleted Claude-shaped implementation

- **Description**: Restore the old hook/registry/tool files and add current
  Codex wiring alongside them.
- **Pros**: Recovers substantial working code quickly.
- **Cons**: Reintroduces provider-shaped engine state, stale event coverage,
  removed contracts, and a catalogue that does not represent either provider's
  full API surface.
- **Impact**: Broad RRFlow authority regression and difficult later migration.
- **Effort**: Medium initially, large corrective work.

### Option B — three orthogonal generated seams (committed)

- **Description**: Implement:
  1. stateless host-event adapters for Codex and Claude that translate every
     supported installed hook event into one versioned canonical event envelope;
  2. OpenAI and Anthropic API adapters with generated, versioned capability
     manifests covering each provider's complete supported API catalogue,
     common semantic projections, and typed provider-specific extensions; and
  3. one RRFlow public operation catalogue projected consistently to MCP,
     generated SDKs, provider tools, and Connectome.
- **Pros**: Preserves full provider capability without a lowest-common-
  denominator union, keeps policy/state in `RrdEngine`, detects catalogue drift,
  and gives Connectome one truthful coverage/evidence model.
- **Cons**: Requires ordered RRFlow contract work, official-schema tracking,
  installation/uninstallation, credentials, and real-provider conformance.
- **Impact**: RRFlow Gate I, provider/inference adapters, generated catalogues,
  SDK/MCP projections, credentials, and Connectome integration views.
- **Effort**: Large, incremental by generated catalogue family.

### Option C — MCP-only integration

- **Description**: Expose RRFlow operations through MCP and rely on provider
  clients to call them voluntarily.
- **Pros**: Smallest implementation and naturally provider-neutral.
- **Cons**: Does not cover session/prompt/tool/permission/compaction lifecycle,
  cannot provide deterministic pre-effect gating, and does not cover either
  provider's platform API catalogue.
- **Impact**: Leaves the stated requirement unsatisfied.
- **Effort**: Small.

## Committed boundary

1. Host hooks, provider APIs, and RRFlow operations are separate catalogues and
   separate adapters; they converge only on canonical identities, events,
   authorization, traces, receipts, and capability evidence.
2. Adapters translate and advertise. They do not own trigger evaluation,
   routines, recall, persistence, policy, or completion.
3. A persisted RRFlow trigger matches an accepted canonical committed event;
   a provider hook cannot itself become a trigger or commit an effect.
4. Complete provider coverage is represented by versioned generated manifests
   with explicit supported/unsupported fields and drift tests. Unknown mutating
   payloads fail closed.
5. Provider-specific capabilities remain typed extensions at the adapter edge;
   the common seam does not erase tools, streaming events, multimodal content,
   batches, files, sessions, realtime behavior, or provider-specific controls.
6. Connectome configures installation and scope, displays catalogue coverage
   and drift, traces translated events into resulting triggers/routines, and
   shows denials/failures/receipts. It does not implement provider lifecycle or
   hold provider credentials in renderer state.
7. No Connectome feature may claim this integration is present until packaged
   RRFlow artifacts expose the catalogues and real Codex/Claude plus OpenAI/
   Anthropic conformance evidence exists.

## Immediate consequence

Sprint 010 must add Host & Provider Integrations to its reference crosswalk.
Actual implementation is blocked on RRFlow's canonical event, trigger, routine,
host-event adapter, provider-adapter, catalogue-generation, credential, and
installation packages. The existing Connectome labels remain non-authoritative
and must not be expanded into another implementation.

## Current official references

- [Codex hooks](https://developers.openai.com/codex/hooks)
- [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Claude API overview](https://platform.claude.com/docs/en/api/overview)

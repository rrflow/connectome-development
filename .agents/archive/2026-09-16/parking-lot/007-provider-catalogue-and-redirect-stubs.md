# Parking Lot 007 — Provider catalogue and redirect stubs

**Status**: DISCUSSING — implementation boundary requires operator review  
**Date**: 2026-09-16  
**Source**: Operator request to research the complete Codex/OpenAI and Claude/
Anthropic surfaces, identify exact overlap and provider-only behavior, and
author small redirect stubs into one provider-agnostic RRFlow seam without
rushing or creating another lifecycle authority  
**Prior decision**: [Parking Lot 006](006-provider-agnostic-host-and-api-seams.md)
committed separate host-event, provider-API, and RRFlow-operation seams.

## COSTAR profile

- **Context**: RRFlow plans a `rrflow-host-events` adapter but has not authored
  it. It has no planned provider-API adapter path. Connectome exposes only
  display labels for Trigger, Routine, Hook adapter, and Skill. Codex and
  Claude Code now expose different hook catalogues, while OpenAI and Anthropic
  expose much larger and independently changing API, tool, content, streaming,
  and administrative catalogues.
- **Objective**: Choose the smallest package boundary that lets one generic
  Codex redirect and one generic Claude Code redirect submit canonical events,
  while one generic OpenAI adapter and one generic Anthropic adapter advertise
  and route their complete supported API catalogues without lossy flattening.
- **Style**: Canonical RRFlow naming, one generated or mechanically checked
  catalogue owner, stateless translators, bounded typed envelopes, explicit
  provider extensions, and table-driven mappings rather than one handwritten
  function per endpoint.
- **Tone**: Methodical and correctness-first. Unsupported or drifted behavior
  is visible and fails closed at an effect boundary.
- **Audience**: RRFlow engine and adapter maintainers, Connectome maintainers,
  and operators who need a clear coverage/drift view without reading provider
  wire formats.
- **Response**: This researched decision record first. After an option is
  selected, author a source-grounded RRFlow change package and a separate
  Connectome projection sprint. Do not write implementation while this item is
  discussing.

## What

The missing decision is where the complete provider catalogue and its generic
redirect stubs live. A host hook is not an API endpoint, an API endpoint is not
an RRFlow operation, and a provider callback is not an RRFlow trigger. The
implementation needs small translations between those contracts without
making the translation code a second engine.

## Where

At RRFlow revision `676fe533366349dc7f3c2340129e1a3a332c7f30`:

- `docs/roadmap/rrflow-1.0/gate-i.md:13-18` requires the canonical event,
  persisted trigger, routine, host-event adapter, and installer in that order.
- `docs/roadmap/rrflow-1.0-file-plan.jsonl:55-62` plans only
  `crates/adapters/rrflow-host-events/{Cargo.toml,fixtures/host-event-v1.json,
  src/{claude,codex,gemini,lib,reference}.rs,tests/conformance.rs}`. Every path
  is marked `file does not exist; creation is gated`.
- `docs/reference/inference/embedding-and-model-bound-search.md:47-50` states
  that no built-in remote OpenAI or Anthropic provider adapter exists.
- `crates/kernel/rrd-core/src/runtime.rs:148-156` contains a generic
  `RuntimeEvent { kind, subject, properties }`, but Gate I-01 explicitly says
  that the canonical authenticated engine-event envelope does not yet exist.
- `docs/roadmap/rrflow-1.0-active-change.json:1-260` belongs to an unrelated
  active D-01/H-06 package. It cannot be silently replaced by this work.

In Connectome:

- `src/rrflow/attunement.ts:106-124` contains display-only automation
  definitions. They are not an installed adapter, provider catalogue, event
  submission, trigger, or conformance result.

## Why this requires a decision

The host-event paths already have a planned owner, but no current RRFlow file,
crate, file-plan entry, roadmap package, or active-change record owns provider
API catalogue generation and routing. Putting that work into the host-event
crate, `rrd-inference`, Connectome, or separate provider crates are all
technically possible and have different dependency and authority consequences.
Sprint authoring cannot invent one of those paths without review.

## Research basis and scope

This inventory was checked on 2026-09-16 against the official
[Codex hooks reference](https://developers.openai.com/codex/hooks),
[OpenAI API reference](https://developers.openai.com/api/reference/overview),
[OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create),
[Claude Code hooks reference](https://code.claude.com/docs/en/hooks),
[Claude API overview](https://platform.claude.com/docs/en/api/overview), and
[Claude tool reference](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference).

The tables below are the human review view. They are not a substitute for the
event-, endpoint-, tool-, content-, and stream-event-level manifest required
for executable coverage and drift checks.

## Host hook catalogue

### Direct overlap — 11 events

| Codex event | Claude Code event | Proposed canonical meaning | Important non-equivalence to retain |
|---|---|---|---|
| `SessionStart` | `SessionStart` | `rrflow.host.session.started` | Provider start-source values and context-output rules differ. |
| `SessionEnd` | `SessionEnd` | `rrflow.host.session.ended` | End reasons, timeout, blocking, and transcript availability differ. |
| `UserPromptSubmit` | `UserPromptSubmit` | `rrflow.host.prompt.submitted` | Blocking and context-injection output shapes differ. |
| `PreToolUse` | `PreToolUse` | `rrflow.host.tool.requested` | Tool names, coverage, rewrite fields, ask/defer support, and timeout behavior differ. |
| `PermissionRequest` | `PermissionRequest` | `rrflow.host.permission.requested` | Decision objects and approval persistence differ. |
| `PostToolUse` | `PostToolUse` | `rrflow.host.tool.succeeded` | The effect already occurred; result/context handling differs. |
| `SubagentStart` | `SubagentStart` | `rrflow.host.agent.started` | Agent identity/type and whether output can affect start differ. |
| `SubagentStop` | `SubagentStop` | `rrflow.host.agent.stop_requested` | Both can influence continuation, but output schemas differ. |
| `Stop` | `Stop` | `rrflow.host.turn.stop_requested` | Both can continue work, with provider-specific stop metadata. |
| `PreCompact` | `PreCompact` | `rrflow.host.context.compaction_requested` | Claude can block compaction; Codex response semantics are not identical. |
| `PostCompact` | `PostCompact` | `rrflow.host.context.compacted` | Trigger/source and injected-context behavior differ. |

Shared canonical meaning does not mean shared wire shape. Each envelope must
retain `host_adapter`, `source_event`, `source_schema_revision`, and a bounded
provider-extension value validated by the installed adapter revision.

### Codex-only — 1 event

| Event | Canonical meaning | Required stub behavior |
|---|---|---|
| `Interrupt` | `rrflow.host.execution.interrupted` | Submit an observation with session/turn coordinates; never invent a Claude equivalent. |

The Codex catalogue currently has 12 events total. Its tool hooks cover local
shell/unified execution, `apply_patch`, MCP, and most local function tools, but
hosted tools and specialized opt-out paths are not covered. RRFlow therefore
cannot treat successful hook installation as a complete authorization
boundary.

### Claude Code-only — 22 events

| Event | Proposed canonical meaning |
|---|---|
| `Setup` | `rrflow.host.setup.requested` |
| `InstructionsLoaded` | `rrflow.host.instructions.loaded` |
| `UserPromptExpansion` | `rrflow.host.prompt.expansion_requested` |
| `MessageDisplay` | `rrflow.host.message.displayed` |
| `PostToolUseFailure` | `rrflow.host.tool.failed` |
| `PostToolBatch` | `rrflow.host.tool_batch.completed` |
| `PermissionDenied` | `rrflow.host.permission.denied` |
| `Notification` | `rrflow.host.notification.emitted` |
| `TaskCreated` | `rrflow.host.task.create_requested` |
| `TaskCompleted` | `rrflow.host.task.complete_requested` |
| `StopFailure` | `rrflow.host.turn.stop_failed` |
| `TeammateIdle` | `rrflow.host.agent.idle_requested` |
| `ConfigChange` | `rrflow.host.configuration.change_requested` |
| `CwdChanged` | `rrflow.host.workspace.cwd_changed` |
| `DirectoryAdded` | `rrflow.host.workspace.directory_added` |
| `FileChanged` | `rrflow.host.workspace.file_changed` |
| `WorktreeCreate` | `rrflow.host.workspace.worktree_create_requested` |
| `WorktreeRemove` | `rrflow.host.workspace.worktree_remove_requested` |
| `PreModelSwitch` | `rrflow.host.model.switch_requested` |
| `PostModelSwitch` | `rrflow.host.model.switched` |
| `Elicitation` | `rrflow.host.elicitation.requested` |
| `ElicitationResult` | `rrflow.host.elicitation.responded` |

The Claude Code catalogue currently has 33 events total and multiple handler
kinds: command, HTTP, MCP tool, prompt, and agent. The RRFlow-installed default
stub should remain one local command path. HTTP, MCP, prompt, or agent handlers
must be separately installed capabilities rather than hidden alternate
transport or policy engines.

## Provider API catalogue

### Common semantic families

| Semantic family | OpenAI surface | Anthropic surface | Canonical treatment |
|---|---|---|---|
| Direct model invocation | Responses; Chat Completions | Messages | One invocation intent with provider-native request/response extensions. |
| Streaming | Responses SSE/WebSocket events | Messages SSE events | Common ordered stream observation plus exact provider event discriminator. |
| Input token counting | Responses input-token count | Messages token count | One read-only estimate operation; provider accounting remains distinct. |
| Asynchronous batches | Batches | Message Batches | Common batch lifecycle, provider-native item/result schemas. |
| Files | Files and Uploads | Files | Common file lifecycle; purpose, limits, and content semantics remain extensions. |
| Models | Models | Models | Common discovery projection, never an assertion that capabilities are equal. |
| Skills | Skills and versions | Skills and versions | Common package identity/digest projection with provider-native schema. |
| Agent definitions | Agents | Managed Agents | Common definition lifecycle; execution semantics remain provider-specific. |
| Sessions and events | Agent sessions/events/turns/items | Managed Agent sessions/event stream | Common session identity and ordered observation; item/turn shapes remain native. |
| Environments | Agent environments/templates | Managed Agent environments | Common environment capability with native sandbox/template fields. |
| Credentials/vaults | Agent vaults/credentials | Managed Agent vaults and external keys | RRFlow stores only credential references and authorization evidence. |
| Administrative identity | Projects, users, groups, roles, service accounts, keys | Organizations, workspaces, users, groups, roles, service accounts, keys | Common inventory concepts with no assumption that hierarchy or permissions match. |
| Usage and limits | Usage, costs, rate limits, spend alerts/limits | Usage, cost, analytics, rate limits, spend limits | Common observations with provider-native units and windows. |
| Custom tools and MCP | Function/custom tools, MCP/connectors | User tools, MCP connector/toolset | Common tool declaration/invocation envelope with native tool schemas. |
| Web and code tools | Web search, code interpreter/shell, tool search | Web search/fetch, code execution, tool search | Common capability classes; execution owner and event/result blocks remain native. |
| Computer interaction | Computer use | Computer/browser toolsets | Common effect class; exact action schemas and client/server execution remain native. |

### OpenAI-only or materially broader families

- Responses conversations/items, compaction, background execution, WebSocket
  steering, and beta multi-agent Responses.
- Managed webhooks and test/secret rotation.
- Live and Realtime calls, WebRTC/WebSocket/SIP, realtime transcription, and
  translation.
- Standalone speech, transcription, translation, custom voice, and voice
  consent resources.
- Standalone image generation/edit/variation and video/character/edit/extend/
  remix resources.
- Embeddings.
- Evals, eval runs/output items, graders, fine-tuning jobs/checkpoints, and
  checkpoint permissions.
- Moderation, safety alerts, and content-provenance checks.
- Vector stores, vector-store files, file batches, and search. These remain an
  optional provider capability; they never replace rrflowDB or RRFlow vectors.
- ChatKit sessions/threads, containers/files, and richer agent artifacts,
  subagents, turns, templates, and credential resources.
- Administration-specific audit logs, certificates, data retention, hosted-
  tool permissions, model permissions, project rate limits, and spend alerts.
- Responses tool types including file search, image generation, hosted/local
  shell, apply patch, code interpreter, skills, namespaces, and tool search.

### Anthropic-only or materially broader families

- Managed Agent deployments, deployment runs, memory stores, and dreams.
- External keys, workload federation details, MCP tunnels/tunnels, user
  profiles/enrollment, compliance settings, and Anthropic-specific compliance
  activities/organizations/groups/apps/code resources.
- Claude Code routine triggering as a distinct product API surface.
- Anthropic server tools with versioned types: web fetch, advisor, and its
  server-side tool-loop/pause semantics.
- Anthropic-schema client tools/toolsets: memory, Bash, text editor, computer,
  and browser, where the application rather than Anthropic executes effects.
- Required `anthropic-version`, optional beta headers, workspace selection, and
  materially different availability across the direct API and supported cloud
  platforms.

Both providers retain older completion surfaces. They must be catalogued with
their published stability/deprecation state and cannot be silently projected
as the preferred invocation operation.

## Small redirect-stub contract

The requested stubs do not require one implementation function per hook or API
endpoint.

### Host redirect

One installed command per host reads one bounded JSON object from standard
input and performs exactly four steps:

1. identify the configured adapter revision and exact source event;
2. validate and translate common coordinates into the canonical RRFlow event
   envelope while retaining a bounded provider extension;
3. submit the proposal through the authenticated public RRD operation; and
4. translate the returned engine directive into that host event's supported
   output shape.

All configured events for a host invoke the same command. The event name comes
from the provider payload; generated installation data supplies the provider
identity and adapter revision. The stub owns no trigger table, routine state,
recall, transcript parsing, credential, or completion decision.

### API redirect

One adapter per provider receives a canonical provider-operation request keyed
by the exact provider operation identity and catalogue digest. It performs
exactly four steps:

1. resolve the installed provider binding and schema-checked operation
   descriptor;
2. prepare the provider-native request using a credential reference supplied
   through the authorized secret boundary;
3. invoke only after `RrdEngine` has prepared the external effect; and
4. return a bounded provider observation and correlation identifiers for
   engine acceptance as a receipt.

The generic adapter is table-driven. Provider-only request/response fields are
validated extensions, not dropped fields and not new RRFlow state. Unknown
operations, unknown mutating fields, stale catalogue digests, missing scopes,
or missing effect classification fail before invocation.

### Catalogue record

Each checked-in provider manifest must identify:

- provider and catalogue revision/digest;
- official source identity and acquisition date;
- operation ID, method/path or protocol event, stability, and deprecation;
- read/write/external-effect classification and idempotency support;
- request, response, error, pagination, and streaming schema digests;
- modalities, content blocks, tools, and tool execution owner;
- required credential/scopes, network need, limits, and supported regions or
  platform variants where published;
- common semantic family, if one exists; and
- exact provider-extension schema when no lossless common projection exists.

Generation and drift checks run during repository development and CI against a
pinned input snapshot. Build, installation, and runtime remain offline and use
the reviewed manifest shipped in the signed RRFlow distribution.

## Trigger boundary

The redirect does not call a provider-specific trigger. The required flow is:

```text
provider host payload
  -> stateless host redirect
  -> authenticated canonical RRFlow event proposal
  -> RrdEngine validation and commit/decision
  -> persisted RRFlow trigger match
  -> optional authorized routine request
  -> engine directive/receipt
  -> provider-specific hook response
```

A pre-effect hook may require a synchronous directive, but the adapter still
does not own the policy. Timeouts, unavailable RRFlow, or directives unsupported
by a particular event must follow a declared per-event fail-open/fail-closed
installation policy; they may not silently downgrade.

## Canonical naming

| Concept | Canonical name |
|---|---|
| Codex host adapter | `openai.codex` |
| Claude Code host adapter | `anthropic.claude_code` |
| OpenAI provider API | `openai.api` |
| Anthropic provider API | `anthropic.api` |
| Host event contract | `HostEventEnvelope` with an explicit `contract_version` |
| Host response contract | `HostDirective` |
| Provider catalogue | `ProviderCapabilityManifest` |
| Provider operation | `ProviderOperationDescriptor` |
| Prepared provider effect | `ProviderOperationRequest` |
| Provider result | `ProviderObservation` accepted by `RrdEngine` as a receipt |

`ChatGPT`, `Claude`, `OpenAI`, and `Anthropic` must not be used interchangeably.
Host products and API providers have separate identities even when one vendor
owns both.

## Options

### Option A — put host hooks and API catalogues in `rrflow-host-events`

- **Description**: Extend the already planned host-events crate with OpenAI and
  Anthropic API manifests and routing stubs.
- **Pros**: One new crate and the fewest workspace/file-plan additions.
- **Cons**: Conflates local host callbacks with outbound provider APIs,
  credentials, streaming, admin operations, and prepared external effects.
- **Impact**: Gate I becomes coupled to provider invocation work across D/G/H.
- **Effort**: Medium initially; high corrective cost as API coverage grows.

### Option B — two thin adapter crates over shared contracts (recommended)

- **Description**: Keep the planned `rrflow-host-events` crate for Codex and
  Claude Code hook translation. Add one `rrflow-provider-api` crate containing
  table-driven OpenAI/Anthropic catalogue projections and generic outbound
  adapters. Put only stable shared envelope/manifest types in `rrd-contract`;
  `RrdEngine` remains the sole event, trigger, authorization, prepared-effect,
  and receipt authority.
- **Pros**: Matches Parking Lot 006, preserves host/API orthogonality, keeps the
  stubs small, permits complete provider-specific coverage, and gives
  Connectome two truthful coverage dimensions.
- **Cons**: Requires new roadmap/file-plan ownership for provider API work and
  ordered prerequisites outside Gate I-04.
- **Impact**: `rrd-contract`, `rrd-engine`, `rrflow-host-events`, new
  `rrflow-provider-api`, installer/public catalogue projections, and later
  Connectome reads.
- **Effort**: Medium for contracts and redirects; large only when real endpoint
  invocation and conformance are added incrementally.

### Option C — one crate per provider

- **Description**: Create separate OpenAI and Anthropic crates, each owning its
  host hooks, API catalogue, and outbound invocation.
- **Pros**: Strong provider isolation and independent dependency/version
  management.
- **Cons**: Duplicates the redirect framework, encourages semantic drift, and
  couples host and API behavior merely because they share a vendor.
- **Impact**: More workspace members, installers, fixtures, and conformance
  suites; Connectome must merge multiple provider-owned views.
- **Effort**: Large.

## Recommended staged acceptance if Option B is selected

### Package 1 — contracts and catalogue fixtures

- Add no network client and invoke no provider.
- Cover all 12 Codex and 33 Claude Code hook event names.
- Prove the 11 shared events lower to the same canonical meanings while
  retaining source identity and provider extensions.
- Inventory every pinned OpenAI and Anthropic API operation, tool type, content
  type, and streaming event with zero unclassified entries.
- Reject duplicate operation IDs, unknown effect classes, schema-digest drift,
  and unbounded extensions.

### Package 2 — local host redirects

- Install one command redirect for Codex and one for Claude Code.
- Prove exact generated configuration, explicit scope/consent, bounded input,
  correct directive rendering, timeout policy, idempotent re-install, and clean
  uninstall.
- Use a reference adapter fixture to prove common-envelope parity without
  requiring either provider binary in unit tests.

### Package 3 — provider API redirects

- Add one generic OpenAI and one generic Anthropic outbound adapter behind
  prepared external effects.
- Start with model invocation/streaming and token count, then add catalogue
  families without changing the common authority boundary.
- Prove credentials never enter renderer state, provider additions produce a
  catalogue diff, mutating operations require authorization/idempotency, and
  every result returns correlation, resource, and error evidence.

### Package 4 — Connectome projection

- Read generated coverage, installation, drift, and conformance operations
  from RRD.
- Show host hooks, provider APIs, and RRFlow public operations as separate
  drill-down dimensions.
- Permit preview/apply/uninstall only through typed RRFlow operations and show
  the resulting receipt; never infer success from local UI state.

## Decision requested

Choose **A**, **B**, or **C**. Option B is recommended because it implements the
already committed three-seam boundary with only two small table-driven adapter
crates and avoids a handwritten stub for every endpoint.

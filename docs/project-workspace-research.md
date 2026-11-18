# Project workspaces: research and product boundaries

Research reviewed 2026-10-24. This is Connectome design evidence, not an engine
capability catalogue, release claim or replacement for RRFlow's H-06 roadmap.

## Decisions supported by research

| Input | Evidence type | Application in Connectome |
|---|---|---|
| [NN/g: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Established usability guidance; not a new model benchmark | Show the project's purpose and common tasks first. Keep a clearly labelled advanced disclosure for identities, limits and raw evidence. Preserve the same data and authorization in both views. |
| [Microsoft: human-AI interaction guidelines](https://www.microsoft.com/en-us/research/articles/guidelines-for-human-ai-interaction-eighteen-best-practices-for-human-centered-ai-design/) | CHI 2019 research with expert validation | State capability limits, support correction and keep activation explicit. A discovery response cannot count as training progress or authorization. |
| [Phoenix tracing](https://arize.com/docs/phoenix/get-started/get-started-tracing) | Current product documentation | Organize execution evidence by project, session and run, then drill into tool/retrieval/model spans. Trace collection, evaluation and model improvement are distinct stages. |
| [Raindrop Signals](https://docs.raindrop.ai/signals/) | Current vendor-described workflow, not independent proof of accuracy | Let users define a behavior, inspect matching/nonmatching examples, correct labels and compare experiments. Retain links from summaries to actual events. Do not copy its UI or claim its classifiers exist in RRFlow. |
| [Qdrant multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/) and [Pinecone multitenancy](https://docs.pinecone.io/guides/index-data/implement-multitenancy) | Current database product contracts | Knowledge paths need an explicit source partition and credential scope. RRFlow keeps its own one-project/one-engram boundary; a remote namespace is not an RRFlow project identity or permission grant. |
| [Codex authentication](https://learn.chatgpt.com/docs/auth) and [Claude subscription/API distinction](https://support.claude.com/en/articles/9876003-i-subscribe-to-a-paid-claude-ai-plan-why-do-i-have-to-pay-separately-for-api-usage-on-console) | Provider-owned access/billing rules, subject to change | Distinguish supported subscription-client access, metered API credentials and local inference. Never infer API credit from a subscription or silently switch billing sources. |

These inputs support design choices, not a claim that the newest technique is
best. The proposed UI still needs task-based usability evaluation. Comparative
quality, recall, latency, cost and installation claims require frozen datasets,
same hardware/resources, named versions, raw failures and repeatable results.

## One project workspace

Use the verified project/engram/instance identity, with a client display label.
Keep navigation inside that project: Overview; Knowledge (models/rrflowDB,
relations, vectors, rrflowKV storage, knowledge paths); Activity and learning;
Services. A selected record can move between graph and vector lenses without
changing engram. URLs must restore the same project and section on reload.
Project switching resets record focus and query caches are session-scoped.

The overview explains one database: rrflowDB owns the project data, graph and
vectors are connected data views, rrflowQL asks bounded questions, rrflowKV
persists accepted effects. A visual cluster is a presentation aid, not a newly
learned fact. Advanced views retain cursors, scope, provenance and limits.

Parallel operation requires native ownership, not merely multiple cards. Each
profile must address its own native session; each local engine must be tracked
by its canonical project directory. Starting a second project must not return
the first project's process. Disconnect and stop target exactly one project;
exit reaps all owned children. Bound the number of native clients/processes and
report admission failures. Connections do not authorize cross-project context.

## Capability-dependent next stages

Knowledge paths should preview provider, endpoint, source partition, scope,
freshness, permissions, budget and source evidence before activation. A remote
record remains attributable; removal revokes future retrieval without silently
deleting project-owned facts. Qdrant, Pinecone and HydraDB adapters remain
unavailable until their actual contracts and acceptance evidence exist.

Activity should eventually show run outcomes, elapsed time, bounded budgets,
retrieved sources, evidence freshness, tool/model spans and failure categories.
Inspecting a recorded run is read-only; replay that invokes effects requires a
new authorized execution. Private model reasoning is not required or promised.

RROFLOW is a governed improvement layer, not a separate database. Supervised
mode uses explicitly labelled examples; unsupervised mode proposes patterns or
clusters for review. Neither promotes its own guesses into grounded facts.
Training consent, context sharing and cloud sync are separate permissions.
Dataset lineage, holdout evaluation, shadow comparison, explicit promotion and
rollback precede a changed live controller. SWAG controls routing only through
the engine's deployed policy. These controls stay unavailable until supported.

rrflow.ai is the intended remote engine access experience; rroflow.ai is the
intended learning/evaluation experience; shippin.cloud adds project devspaces.
They are planned product destinations, not configured endpoints, working
accounts or enabled synchronization. Provider identity, region, retention,
redaction and transfer scope must be previewed before an optional cloud link.
Local use continues without an account. Account entitlements never bypass
project authorization and cannot turn parallel operation into context sharing.

## Implementation and acceptance order

1. Project-scoped native ownership and navigable existing data lenses. Prove
   two independent engines/sessions, targeted stop and no cross-project reads.
2. Typed knowledge-path discovery and preview/activation with source lineage.
3. Session/run evidence and read-only inspection, then separately authorized
   replay, budget controls and regression datasets.
4. Provider/client entitlement discovery, measured usage and explicit billing
   selection; unsupported quota information stays unknown.
5. RROFLOW collection consent, labelled/unsupervised experiments, held-out
   evaluation and governed model promotion/rollback.
6. Optional account binding and resumable, scope-bound cloud synchronization.

This order maps UI work to existing RRFlow owners (H-06, connector/data,
G controller learning, H improvement and DevPulse/cloud contracts). It does not
reorder the engine dependency spine or mark its C-07 qualification complete.

## Competitive acceptance, not a feature-name comparison

The useful comparison is an end-to-end task on the same authorized corpus:
source import and change/delete propagation; bounded hybrid retrieval; relationship
and provenance inspection; a supported model/client handoff; and a corrected run
whose evaluation can be repeated. Report retrieval recall/precision against a
labelled set, answer citation correctness, stale-source rate, p50/p95 latency,
resource use, provider cost and failure recovery. Publish configuration, corpus,
model version and limits with results. A vendor's marketing claim or a drawn
graph is not comparative performance evidence. No superiority, successful
learning or frontier-model cost reduction is established by this UI package.

The native two-project test intentionally permits identical deterministic engine
instance IDs for identical source inventories. Local process ownership uses the
canonical directory; session ownership uses a saved profile with a verified
endpoint and native credential. An instance label alone is not a globally unique
project selector or an authorization boundary.

## Implementation sequence: one project and its evidence

This is supporting Connectome design work, not a replacement for RRFlow's
objective, roadmap, or capability status. The engine remains the authority;
Connectome presents engine responses and client-side discovery profiles. The
following packages need their own source-grounded briefs, implementation,
candidate CI and acceptance evidence before being called complete.

1. **Remember and re-prove an instance.** The existing local profile is saved
   through `src/shared/util/config.tsx` and the native config writer; the native
   lifecycle registry in `src-tauri/src/rrd/estate/lifecycle.rs` proves an
   instance again rather than trusting `.rrflow/serving.json`. Save the profile
   before acknowledging open, retain the previous config on a failed write,
   and report the actual outcome. Lifecycle diagnostics are redacted and are not
   an engine audit log. Acceptance must include an actual desktop restart, a
   stopped process, a changed endpoint, an identity mismatch, save failure, and
   independently started processes. Cross-process profile-write ordering and
   power-loss durability must be tested before claiming them.
2. **Show source-grounded relationships and coverage.** The existing
   `src-tauri/src/rrd/client.rs::database` presents `diagnostic_snapshot`, and
   `src-tauri/src/rrd/view.rs` derives a display graph from the returned records
   and relations. Missing endpoints can suppress edges. Retain the honest
   snapshot label until an engine-owned, authorized, bounded traversal contract
   supplies paging, source/provenance, freshness, limits and explicit coverage.
   Exercise a project with known cross-file relationships, deletions and edits;
   compare returned endpoints and edges with a separately constructed fixture.
   User-visible clusters are a display computation, not learned facts.
3. **Index progressively and repair missed changes.** The engine should serve
   admitted project information as it becomes available, with durable progress,
   source identity, configurable CPU/memory/I/O budgets, and visible errors.
   The indexer must reconcile after restart, missed events and watcher overflow;
   notification events alone cannot establish completeness. Windows documents
   [overflow and re-enumeration](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesexw),
   and Linux documents [inotify queue overflow](https://man7.org/linux/man-pages/man7/inotify.7.html).
   Test a large project, concurrent edit/rename/delete, interruption, restart,
   overflow and permission denial against an independently enumerated baseline.
   Respect inherited permissions and do not move or change project files.
4. **Capability-backed multimodal retrieval.** Expose text, documents, vectors,
   relationships and configured knowledge paths through existing engine-owned,
   typed contracts with provenance and source boundaries; unavailable providers
   remain unavailable. Qdrant documents [payload and text indexing](https://qdrant.tech/documentation/manage-data/indexing/)
   and [hybrid retrieval](https://qdrant.tech/documentation/hybrid-queries/);
   these are research inputs, not claims of RRFlow parity. Measure latency,
   throughput, indexing resources, retrieval quality and failure behavior on
   equivalent datasets and hardware. No universal competitor claim follows from
   a UI rendering or a microbenchmark.
5. **Configurable controller and learning.** Bind effort, budgets, routing and
   adapters to engine-advertised capabilities. SWAG, LFG and other endpoints
   are configured contracts, not hardwired dependencies. Enable supervised
   labels and unsupervised proposals only when engine operations actually exist;
   capture consent, dataset provenance, evaluation, promotion and rollback.
   An external chat or SDK can use permitted public operations, but discovery
   does not authorize training or external effects. Training UI must distinguish
   proposals from verified project facts. [MLflow's tracking model](https://www.mlflow.org/docs/latest/tracking/)
   illustrates recording run configuration, metrics and artifacts; it does not
   establish that RRFlow already has those facilities.
6. **Observability and dogfooding.** Correlate project/instance, request,
   selected capabilities, input identities, bounded resource use, indexing
   progress, effects and errors; present source and trace freshness in the
   workbench. Keep authoritative engine receipts separate from diagnostic
   traces: [OpenTelemetry sampling](https://opentelemetry.io/docs/concepts/sampling/)
   can omit spans. Prove the whole path by starting a project, observing its
   index and relationships, making an ordinary edit, reopening the desktop,
   re-proving the engine, and reading the resulting change and receipts. Record
   exact source and binary identities, commands, timings, omissions and failures.

Nothing in this sequence changes the RRFlow gate status. In particular, a saved
client profile and a bounded graph do not prove full indexing, a learning system,
or a comparison with other graph or vector engines.

[Local instance-history and relationship-snapshot change evidence](evidence/change-journals/instance-history-and-relationship-snapshot-2026-11-06.md) records the candidate and its verification limits.

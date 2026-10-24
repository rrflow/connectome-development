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
| [Qdrant multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/) and [Pinecone multitenancy](https://docs.pinecone.io/guides/index-data/implement-multitenancy) | Current database product contracts | Knowledge paths need an explicit source partition and credential scope. RRFlow keeps its own one-project/one-estate boundary; a remote namespace is not an RRFlow project identity or permission grant. |
| [Codex authentication](https://learn.chatgpt.com/docs/auth) and [Claude subscription/API distinction](https://support.claude.com/en/articles/9876003-i-subscribe-to-a-paid-claude-ai-plan-why-do-i-have-to-pay-separately-for-api-usage-on-console) | Provider-owned access/billing rules, subject to change | Distinguish supported subscription-client access, metered API credentials and local inference. Never infer API credit from a subscription or silently switch billing sources. |

These inputs support design choices, not a claim that the newest technique is
best. The proposed UI still needs task-based usability evaluation. Comparative
quality, recall, latency, cost and installation claims require frozen datasets,
same hardware/resources, named versions, raw failures and repeatable results.

## One project workspace

Use the verified project/estate/instance identity, with a client display label.
Keep navigation inside that project: Overview; Knowledge (models/rrflowDB,
relations, vectors, rrflowKV storage, knowledge paths); Activity and learning;
Services. A selected record can move between graph and vector lenses without
changing estate. URLs must restore the same project and section on reload.
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

# Sprint 009 — Connectome ownership

Status: active

## Goal

Make Connectome Connectome's: one GitHub home, an honest license and notice,
no inherited vendor name or product surface anywhere a user or a reader of
feature code can see it, and a gate that fails the moment any of it returns.

## Source

Owner instruction, 2026-10-18 13:00 PDT: the naming has to be rewritten from
the inherited vendor to RRFlow/Connectome, the repository has to belong to
`github.com/rrflow/`, and the code has to be properly the owner's. The owner
also raised licensing exposure.

Owner instruction, 2026-10-24: the inherited vendor's database, client,
query language, editor, engine and branding come out of Connectome
completely. They were never meant to stay; they arrived while the owner was
working with the vendor, who is fine with the change. RRFlow's own rrflowDB
and rrflowQL, with TurboQuant vector search, are the engine. The owner asked
for the conversion to be researched and done methodically and properly,
not by renaming or by deleting work without a researched destination.

## Baseline captured 2026-10-18 (main `29c9a14`)

Facts, from the tree and the remote, not from memory:

- Remote: `https://github.com/rrflow/connectome-development` (fetch and push).
  32 commits; the first (2026-09-04, the owner) imported the inherited client
  as a snapshot. Its upstream history is not in this repository.
- `LICENSE` was the inherited vendor's MIT text, copyright SurrealDB Ltd, with
  no Connectome copyright line. `package.json` declared no `license` and no
  `repository`; its `version` was the inherited `3.7.3`; `src-tauri/Cargo.toml`
  pointed `repository` at `github.com/EonsofStupid/rrflow-connectome`;
  `tauri.conf.json` identifier is `dev.eonsofstupid.connectome`.
- 120 URLs in 61 files pointed at `github.com/EonsofStupid/connectome` or
  `.../rrflow-connectome`: sprint 006 had replaced the vendor's documentation
  links with a GitHub home that is not this repository's.
- Sprint 006 was a textual find-and-replace of the inherited product name with
  "Connectome". Its own record now reads "rename Connectome to Connectome". It
  renamed the word, not the product: 73 inherited release changelogs under
  `src/shared/assets/changelogs/` (2.0.0 through 3.7.3) describe the vendor's
  releases under the title "Connectome <version>" and are shown by the
  "Release changelogs" command.
- The literal vendor name appears in 256 authored files. 240 of them only in
  `import … from "@surrealdb/ui"` (149 symbols: 127 icons, 13 pictograms,
  `Icon`, `CodeBlock`, `Markdown`, `Spacer`, `FontLinks`, `MANTINE_THEME`,
  `EditorStateSnapshot`, `useStable`). The rest: dependency declarations in
  `package.json` and `vite.config.ts`, a stale `bun.lock` whose package name
  is the inherited one, two unreferenced vendor logo PNGs, `LICENSE`, one
  README sentence, one REVIEW.md sentence.
- `src/vendor/rrflow-client.ts` re-exports the vendor's JavaScript client as
  `RRFlow` and its query template tag as `rrflowql`; `src/vendor/rrflowql-editor.ts`
  re-exports the vendor's CodeMirror language as `rrflowql`. 76 files import
  them. Feature code that says `new RRFlow()` is running the inherited engine.
  This is the code-level form of the alias impersonation that sprint 007
  decision 3 and `scripts/check-dependency-authority.mjs` forbid for npm
  names; nothing checked it at the symbol level.
- Beyond the literal word, the inherited product surface is most of the
  application: `src/cloud/` (51 files) and the Organizations, OrganizationManage
  (billing, invoices, support, team), OrganizationDeploy, CreateOrganization,
  Referral, Signin, Support, SupportPlans pages, the auth-callback screen, the
  Sidekick assistant (43 files) and the authentication view — 105 files that
  `src/screens/GOVERNANCE.md` already marks STRIP — plus the query, explorer,
  designer, graphql, functions, migration, monitor, parameters and sandbox views,
  which run on `surrealdb`, `@surrealdb/wasm`, `@surrealdb/ql-wasm-v2/v3`,
  `@surrealdb/codemirror` and `@surrealdb/lezer`, not on RRD.
- Dependency licenses as published: `surrealdb` and `@surrealdb/wasm` declare
  Apache-2.0; `@surrealdb/ql-wasm` ships an Apache-2.0 LICENSE file;
  `@surrealdb/ui`, `@surrealdb/codemirror` and `@surrealdb/lezer` declare no
  license and no repository in their published `package.json`, and the bundled
  license report shows them as `n/a`. The license report on disk was stale and
  its generator script wrote to a path that no longer exists.

## Authority decisions

Decisions 1, 6, 7 and 8 are the owner's answers of 2026-10-18 13:05 PDT; the
rest are engineering decisions recorded here for review.

1. The repository's home is `github.com/rrflow/connectome-development`, a
   sibling of `rrflow/rrflow-development` under the `rrflow` organization,
   bound by the one pinned engine revision. No Git submodule in either
   direction: RRFlow's `AGENTS.md` forbids submodules, and sprint 007's "parent
   engine submodule pointer" step is retired by this decision.
   **Corrected 2026-10-24.** The submodule prohibition was an agent-written
   rule, not the owner's. On 2026-10-19 the owner permitted Git submodules,
   and RRFlow now pins this repository as the declared `connectome/`
   submodule at a credential-free HTTPS URL (RRFlow `AGENTS.md`). Connectome
   still builds from no engine source: its one engine association remains the
   pinned `rrd-client`/`rrd-contract` revision and the digest-verified
   sidecar.
2. The MIT License stays, with Connectome's own copyright line in `LICENSE`.
   The inherited vendor's copyright and permission notice is preserved,
   unchanged, in `NOTICE` for the portions still derived from its work, as
   the license requires. Renaming identifiers does not discharge that
   obligation; deleting the derived code does.
3. The inherited vendor's name may appear only as the identifier of a
   dependency `package.json` still declares, inside the `src/vendor/` seam
   (whose files must say in words whose code they re-export), or in the
   notices. `scripts/check-retired-identities.mjs` enforces this and derives
   the allowed set from `package.json`, so it shrinks to nothing as the
   dependencies leave. Nothing else — prose, UI text, symbols, assets,
   configuration — may carry it.
4. No inherited vendor product surface ships. Cloud/organization pages, the
   inherited assistant, inherited release notes, and inherited branding are
   deleted, not renamed. Views that run on the inherited engine move onto the
   generated RRD SDK or are removed; none is kept as a fallback.
5. Each slice is one pull request against `main`, gated by `pnpm check`, the
   production build, the render smoke, the native checks, and the RRD process
   tests. A rename is not progress; a deleted dependency is.
6. The copyright holder is AngryVibes LLC, the legal entity, in `LICENSE`,
   the Tauri bundle copyright, the Cargo and npm author fields, `index.html`
   and the About tab. A trade name (the owner is considering WiredFront as a
   DBA) is not put in a legal notice before it is filed; when it is, the line
   becomes "AngryVibes LLC (d/b/a <name>)" in one commit.
7. The Tauri bundle identifier is `dev.rrflow.connectome`. It names the
   application-data directory that holds Connectome's default estate, so it is
   set before anyone installs and not changed afterwards.
8. Versioning is contracted. `package.json` owns `version` and
   `connectome.channel`; `src-tauri/Cargo.toml`, the `connectome` entry of
   `src-tauri/Cargo.lock`, `tauri.conf.json` (by reference) and the Vite
   defines are derived copies; `scripts/version.mjs --check` fails `pnpm check`
   when any copy disagrees and `scripts/version.mjs <version> [channel]` is the
   only way to move them. The version is a plain semver core and the maturity
   channel rides beside it, because Tauri's NSIS bundler drops a pre-release
   suffix, its MSI bundler accepts only a numeric one, and its RPM bundler
   passes it into a header field that forbids `-`. The owner's ".05 alpha" is
   read as version `0.0.5`, channel `alpha`; it does not move until the product
   works end to end, then versioning starts.
9. The 73 inherited release changelogs are deleted and Connectome's own
   `0.0.5.md` is authored in their place; the in-application changelog shows
   only Connectome's releases.

Decisions 10 (Connectome theme now, ColdLight tokens later) and 11 (pause
Slice D until Actions billing was fixed and Slice C2 was checked on the
owner's desktop) were recorded on the unmerged `agent/connectome-theme` branch
(PR #9) and land with Slice C2. Decisions 12 to 15 are the owner's answers of
2026-10-24; decision 16 is the engineering decision those answers asked for.

12. The inherited vendor leaves Connectome completely: every package, alias,
    type, query language, editor language, engine and asset. rrflowDB is the
    only database, rrflowQL the only query language, and Connectome is a
    projection client of RRFlow's public operations. Decision 11's pause
    ends: Actions run green on this public repository again (since
    2026-10-19), and the desktop check of the theme becomes part of Slice
    C2's acceptance.
13. The application icon is the Connectome mark already drawn in the
    application (`src/shared/assets/pictograms/connectome.svg`, shown in the
    sidebar and on the Overview), converted to every platform format. The
    hub icon generated on PR #9 is not used. The owner also allowed a mark
    inspired by nomen; the in-application mark is chosen because it is
    already Connectome's.
14. PR #10 (`agent/rrflow-native-connectome`) is salvaged and closed. It
    branched before PRs #1 to #8 and overlaps 279 files changed since. Its
    rrflowQL lexer and parser, dependency gate and knowledge-tree work are
    rebuilt inside the matching Slice D increments on current `main`, with
    credit; the commit is not merged.
15. `main` carries the same ruleset as `rrflow/rrflow-development`: pull
    request required, `ci-gate` required, no force push or deletion, merge
    queue (merge commits, all-green groups), and administrator bypass only
    while merging a pull request.
16. Fold, then delete. Each inherited screen's useful components move into
    the RRFlow runtime workbench lens that owns the same subject, and the
    inherited screen and its vendor code are deleted in that same increment.
    A subject RRFlow does not yet serve through a public operation is deleted
    with no stand-in client, placeholder or dual path, and is rebuilt when
    its RRFlow operation lands (the rebuild table below). This follows
    decision 4 and RRFlow's Connectome contract (direct-convergence step 4).
    **Amended by decision 17:** "deleted with no stand-in" no longer applies
    to anything visual. **Superseded by decision 18:** decision 16 was an
    engineering decision, and the owner rejected it on 2026-10-27.
17. No visual regression, only improvements (owner, 2026-10-24: "I better
    not lose one visual regression but only improvements"). Every inherited
    screen, graph and visual is captured first (`tests/visual/`, baseline at
    `main` `38142b7`, both themes) and listed in `tests/visual/PARITY.md`. Its
    RRFlow lens must reproduce or improve every listed item, shown by a
    before/after capture, before the inherited screen and its vendor code are
    deleted. A subject RRFlow does not yet serve keeps its inherited screen
    until its RRFlow lens exists; that lens may be authored ahead of its
    RRFlow operation and show the engine's capability state, with no vendor
    code behind it. A refactor that moves code without changing a screen
    (such as Slice D0) is compared pixel by pixel against the build before
    it.
18. Re-author in place, organised by RRFlow's own model. The owner's
    correction came on 2026-10-27, after D1a landed: "you are rushing this
    and you did not convert the existing view properly to rrflow … a project
    may have different internal domains, so you can truly have it all
    organized … make it effortless to interact with rrflowKV rrflowQL and
    rrflowDB … I do not want you excluding surreal code but getting it
    authored properly." It means:
    - **Re-author, don't replace.** Each inherited view (Query, Explorer and
      inspector, Designer, Documentation, Functions, Parameters, Access,
      GraphQL, the import/export dialogs) is re-authored in place onto RRFlow's
      public operations and keeps its layout and components. A thin parallel
      lens beside an untouched inherited screen is not a conversion.
    - **The inherited code goes, the screens stay.** The vendor engine, client,
      query language, editor grammar and value types still leave
      (decision 12), but the screens do not.
    - **The labels were a rename, not a conversion.** The views have carried
      "RRFlowQL" labels since 2026-08-26 while still running SurrealQL. Each
      label is corrected when its view moves onto rrflowQL.
    - **Organisation comes from the engine.** Inside a project the scope is
      Project ▸ Estate ▸ Domain. Domains, categories and tags come from
      RRFlow's [estate organisation](https://github.com/rrflow/rrflow-development/blob/main/docs/reference/data/estate-organisation.md)
      (ADR-0003, roadmap H-11). Connectome keeps no grouping of its own.
      Before the engine serves domains, the breadcrumb shows the estate alone
      and marks domains unavailable.
    - **Navigation follows RRFlow's Connectome contract.** The areas are
      Overview, Knowledge, Activity, Learning and Services. The re-authored
      inherited views are the Knowledge tools: Query, Records, Graph, Vectors,
      Schema, Storage and the API reference. One view registry derives
      navigation from the operations and capabilities each view needs.
    - **Foundations first.** Each step is reviewed before the next. D1a's API
      tab moves into the documentation view when that view is re-authored.
19. A view is available when its project's instance runs. This is the
    owner's answer of 2026-10-28 to F4's question of what makes a view
    available. An instance gets running in one of two ways:
    - the user starts `rrflow` in the project folder, and its hooks lead the
      AI to ask about indexing;
    - the user starts that instance from Connectome, one or several in turn.

    Connectome shows each instance's real startup status. Startup is fast,
    so the status is never padded. It means:
    - **Availability starts from the instance lifecycle.** Each project's
      instance is stopped, starting (at the stage it has actually reached),
      ready, stopping or failed, whichever way it was started.
    - **An instance started elsewhere is found and proved.** RRFlow's served
      endpoint record (`.rrflow/serving.json`, RRFlow H-07h) says where an
      instance listens, and `rrflow ready --project` proves it. The record
      is only a hint. The authenticated challenge grants readiness, and a
      failed liveness check can only take it away.
    - **Connectome stops only what it started.** It never stops an instance
      started elsewhere, and closing Connectome leaves that instance running.
    - **Inside a ready instance,** a view whose operation the instance does
      not serve shows the engine's stated reason. The product capability
      catalogue's static Connectome binding ("planned") does not gate a view.
      This was recommended with the question and not contradicted.

## Ordered implementation slices

### Slice A — home, license, notice, gate

Files: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`,
`LICENSE`, `NOTICE`, `README.md`, `REVIEW.md`, `index.html`,
`src/shell/components/App/settings/tabs/About.tsx`,
`scripts/check-retired-identities.mjs`, `src/vendor/*`, the 61 files carrying
the old GitHub home, `bun.lock`, the two vendor logo PNGs, the 73 inherited
changelogs.

Work:

1. Point every repository reference at `rrflow/connectome-development`.
2. Declare `license`, `repository` and version `0.0.0` in `package.json`; fix
   the license-report script path; regenerate the report.
3. Write Connectome's `LICENSE` and the `NOTICE`; set the copyright holder in
   `LICENSE`, `Cargo.toml` authors, `package.json` authors, `index.html` and
   the About tab from the owner's answer.
4. Set the Tauri bundle identifier from the owner's answer (it names the
   application's data directory; changing it later orphans installed estates).
5. Delete `bun.lock`, the vendor logos, and the inherited changelogs.
6. Extend the identity gate (decision 3) and prove it against synthetic
   violations: prose, a path, a seam file that hides its vendor.

### Slice B — delete the inherited cloud product surface

Files: `src/cloud/`, the eight STRIP pages, `src/screens/auth-callback/`,
`src/components/Sidekick/`, `src/screens/connectome/views/sidekick/`,
`src/screens/connectome/views/authentication/`, their routes, stores, commands,
settings and tests.

Work: delete, then remove every dangling import, route and command until
`pnpm check`, the build and the render smoke pass. Nothing is kept behind a
flag.

### Slice C — replace the inherited UI kit

Files: the 240 importers of `@surrealdb/ui`, a Connectome icon module.

Work: a codemod maps the 127 `icon*` constants and 13 pictograms to a
Connectome-owned icon module (Tabler Icons, MIT, Mantine's own pairing, or
Connectome SVGs), and the eight components to Connectome components; the
package leaves `package.json`; the gate's allowed set shrinks by one.

### Slice D — replace the inherited engine, client and editor

Files: `src/vendor/`, the 76 importers, the views that run on them,
`package.json`, `vite.config.ts`.

Work: each inherited view either moves onto `@rrflow/rrd-client` and RRD
operations (estates and graph drill-down first, then prompt → frontier AI →
rrflowKV memory, per the owner's staircase) or is deleted. `src/vendor/` is
deleted with the last importer, together with `surrealdb`, `@surrealdb/wasm`,
`@surrealdb/ql-wasm-v2`, `@surrealdb/ql-wasm-v3`, `@surrealdb/codemirror` and
`@surrealdb/lezer`. The gate's allowed set reaches zero and the `src/vendor/`
exemption is removed from it.

#### Researched disposition (2026-10-24, `main` `38142b7`)

Inventory: 66 source files run on the inherited client (60 through the two
`src/vendor/` re-export files, 6 importing the packages directly), plus 12
documentation topics of client snippets and `vite.config.ts`. Seventy-one
files reach the inherited engine through the wrappers in
`src/screens/connectome/connection/connection.tsx`. The RRFlow-native pages
(the runtime workbench, diagnostics, serving) still load that module through
`~/types`, `~/stores/database`, `~/modals/edit-connection` and the globally
mounted `useConnectionSwitch`. The RRFlow side was read at
`rrflow-development` `4dc93b7f`: 44 catalogued HTTP operations, all
dispatched; the Rust `rrd-client` already wraps transactions, query
execution and export, changefeed and subscriptions over `/v1/ws`, backups,
audit, context, vectors and schema reads; WebSocket request execution,
GraphQL, governed functions, the quantization lifecycle and principal
administration have no public route yet.

| Inherited subject | What it did | RRFlow destination | Public operation today | Increment |
|---|---|---|---|---|
| Connection, namespace and database pickers, node status | connect, sign in, select a namespace and database, server info | Project ▸ Estate ▸ Domain from the engine's identity and estate organisation (RRFlow H-11); native session; capabilities, readiness | yes; domains after H-11a | D0, S1, final cut |
| Sandbox | in-browser engine on `mem://` | a scratch project estate served by the bundled sidecar (sprints 011 and 012) | yes | V8 |
| Mini runner and embed generator | in-browser engine inside an iframe | RRFlow's browser deployment (planned, not built) | no | kept until RRFlow serves a browser deployment |
| Record-access sign-up and sign-in | vendor access methods | native API-key session; human login follows RRFlow's identity package | machine keys only | V7 |
| Users and access view | vendor users and access definitions | RRFlow principals, grants (including domain grants, H-11d) and credential revisions | no | V7, capability state until served |
| GraphQL view (already unreachable) | vendor `/graphql` endpoint | RRFlow's GraphQL lowering (B-05), served by H-04 | no | V7, capability state until served |
| Functions view and model upload | vendor functions and ML models | RRFlow governed functions and admitted model manifests | no | V7, capability state until served |
| Parameters view | vendor global parameters | rrflowQL `$name` parameters bound per query; estate configuration owns lasting settings | yes | V1, V7 |
| 2.x to 3.0 migration view | vendor version migration | an upgrade-and-restore check on RRFlow backup and restore (design open) | yes | V7 |
| Query view | vendor query execution, live results, graph preview, formatting | `query-execute` with `EXPLAIN`, `traverse:` sources, `query-export`, live results through a native `/v1/ws` subscription | yes | V1 |
| Editor language, highlighting, linting, formatting | vendor CodeMirror and Lezer language and WASM parser | a Connectome rrflowQL language: RRFlow's tokenizer (`rrd-query/src/syntax.rs`) ported exactly, held to golden engine responses for RRFlow's `query-vectors.json` and a corpus; the engine validates when a query runs, and the native layer locates its parse refusal; the client only highlights; no formatter | yes | F3, then each V step |
| Explorer, record inspector, data table, relation graph, map | vendor reads, creates, relates, updates and deletes; binary value types | `record:`, `relation:`, `geo:` and `traverse:` queries; transaction preview then commit with `PutRecord`, `PutRelation`, `PutGeo`, `RetireData`; one engine query per graph expansion | yes | F2, V2 |
| Designer | vendor schema definitions and introspection | `data-schema-read` with the estate organisation; next registry revision through `PutSchema` with preview; `query-index-ensure` | yes (instance-level grant) | V3 |
| Import and export | vendor statement import and export | `query-export` (Parquet), `backup-create`, `backup-list`, `restore-create`; typed record batches for import | yes, import as batches | V5 |
| Documentation topics | vendor client snippets | the RRFlow API reference generated from the operation catalogue, in the inherited documentation view | yes | D1a (tab), V6 (view) |
| Shared types and stores | vendor record identifiers, durations, decimals, geometry | RRFlow value model from the generated OpenAPI types | yes | D0, F2 |

#### Ordered increments

Each increment is one pull request through the merge queue with `pnpm check`,
the production build, the render smoke, the native checks and the RRD
process tests, plus the tests named. RRFlow moves its `connectome/` pin after
each one lands.

- **D0: cut the RRFlow pages loose.** The runtime workbench, diagnostics and
  serving stop loading `connection.tsx`. Add the RRFlow value model; scope
  `useConnectionSwitch` to the inherited routes. Oracle: a module-graph test
  shows no RRFlow page reaches `src/vendor/`.
- **D1: re-scoped by decision 17.** The Sandbox's entry points move to
  Connectome's default local estate on the sidecar, which already exists;
  its reset returns with RRFlow's uninstall (D-11). The subjects RRFlow does
  not serve (record-access sign-up, users and access, GraphQL, functions and
  model upload, migration, the documentation topics, the mini runner and
  embed) keep their inherited screens until their RRFlow lenses exist; the
  API reference is rebuilt first, from RRFlow's public operation catalogue,
  which RRFlow already serves. `@surrealdb/wasm` leaves with the last screen
  that needs it. Split on 2026-10-27: **D1a** builds the API reference on an
  engine whose catalogue owns each operation's family, summary and
  description (the owner's decision of 2026-10-26; RRFlow PR #147), which
  moves the engine pin; **D1b** moves the Sandbox entry points, which in the
  shipped app do nothing visible ("Open the Sandbox" lands back on the
  overview).
- **Re-sequenced by decision 18 (2026-10-27).** D0 and D1a landed as
  described above. D2 to D8 are replaced by the order below. Every step
  re-authors in place and deletes the vendor code it replaces in the same
  pull request. Every visible step carries before/after captures
  (decision 17), real-engine process tests, and a large-estate check:
  - cursor-paginated tables;
  - bounded graph neighbourhoods;
  - virtualised lists;
  - no lookups per item.
- **R0: this plan.** Decision 18 and this order. Documentation only.
- **F1: native surface** (formerly D2). Tauri commands over the existing
  `rrd-client` methods for transactions, query export, changefeed, `/v1/ws`
  subscriptions, backups and audit. The renderer gets opaque handles and never
  holds a credential. Oracle: the RRD process tests drive each command against
  a real engine, including restart and denial. Split on 2026-10-27, as D1
  was:
  - **F1a: request and response effects.** A data change is previewed inside
    a transaction and committed by its handle and the approved digest,
    exactly as previewed. Parquet query exports and audit exports are held
    natively until the native save dialog writes them. Also: changefeed read
    and follow, audit pages, and the backup catalogue, creation and verified
    restore.
  - **F1b: live results.** Durable subscriptions over `/v1/ws`, with
    acknowledgement, resume after reconnect and session renewal, streamed to
    the renderer through a channel.
- **F2: RRFlow value model.** Cell, record-reference, value and schema types
  are generated from the pinned engine's OpenAPI, replacing the inherited
  record identifiers, durations, decimals and geometry classes. Oracle: type
  tests over golden engine responses.
- **F3: rrflowQL language** (formerly D3). The engine's tokenizer, ported
  exactly; a classifier that names each token by its place in the engine's
  grammar; and a CodeMirror language built on them. Oracle: golden engine
  responses for RRFlow's own query vectors and for a corpus of accepted and
  refused queries. The engine validates: its parse refusal comes back with the
  command that ran the query, and the native layer locates it in the editor.
  The client only highlights. Amended on 2026-10-27 from reading the engine:
  - At the pin, `EXPLAIN CONTRACT` does not stop a query from executing, and
    no operation parses without executing. Validation therefore happens when
    a query runs, not as the operator types.
  - PR #10's scanner is not salvaged. It accepted comments, single quotes,
    backticks and decimals that the engine refuses.
  - The inherited views still run the inherited language. So the runtime
    console adopts rrflowQL in F3, with captures, and each inherited view
    adopts it in its own V step. The inherited grammar, linter and WASM value
    parser leave with the last of those views.
- **F4: view registry.** One registry of views. Each view names the
  operations and capabilities it needs, and navigation is derived from the
  engine's catalogue and capabilities. A view whose operation is unserved
  shows that capability state. Oracle: registry tests against the pinned
  catalogue. Amended by decision 19 on 2026-10-28 and split, as F1 was:
  - **F4a: instance lifecycle.** The native process keeps one lifecycle per
    project, whichever way the instance was started.
    - Opening a project whose instance already runs attaches to it, instead
      of failing with "already open in another process".
    - A known project started from its folder appears once it is proved.
    - The project engines panel shows each instance's lifecycle, with
      before/after captures.
    - The engine pin moves to an RRFlow revision with H-07h.

    Oracle: native tests over every lifecycle transition, and RRD process
    tests that start an instance outside Connectome with `rrflow serve`.
    Connectome attaches to it, refuses to stop it, sees it stop, and attaches
    again after a restart on a new port.
  - **F4b: view registry.** The registry described above. A view's
    availability comes first from its instance's lifecycle, then from that
    instance's endpoint catalogue and capability states.
- **F5: characterisation.** Tests that pin the engine-neutral inherited
  components before they are re-pointed: the data table, the tables pane, the
  schema graph, the relation graph, the code editor, the inspector and
  creator drawers, and the tab and saved-query panes.
- **S1: navigation model, then shell.** A written navigation model, mocked up
  from real captures and reviewed by the owner, comes first. Then the shell:
  - the Project ▸ Estate ▸ Domain breadcrumb, with domains read from the
    engine (RRFlow H-11a; scoping arrives with H-11c);
  - the areas Overview, Knowledge, Activity, Learning and Services;
  - Knowledge tools served by the registry.

  An inherited route becomes reachable only once its view runs on RRFlow.
- **V1: Query.** The inherited query view runs rrflowQL, in F3's language.
  That covers tabs, saved queries and history; variables (which replace
  global parameters); combined, single, table and graph results; `EXPLAIN`
  plans; live results; and Parquet export.
- **V2: Records.** The explorer, inspector and creator: records by kind from
  the schema registry, an rrflowQL filter, typed cells, `traverse:`
  relations, and edits through transaction preview then commit. The relation
  graph and the map come too.
- **V3: Schema.** The designer graph on the schema registry, with kinds
  grouped by domain. Edits go through `PutSchema` preview then commit.
- **V4: Graph and Vectors.** The existing records-and-relations graph and the
  vector map become Knowledge tools, with the selection shared across tools.
- **V5: Storage.** The rrflowKV pipeline and counters, backup, restore,
  Parquet export and typed import. These replace the inherited import and
  export dialogs.
- **V6: API reference.** The inherited documentation view (topic tree,
  articles, language switch) is fed from the engine's operation catalogue.
  D1a's workbench tab moves into it.
- **V7: capability views.** Functions, Access and GraphQL are re-authored to
  show RRFlow's capability state until their operations land (table below).
  Parameters become query variables plus estate configuration. Migration
  becomes an upgrade-and-restore check on backup and restore; that design is
  still open and is decided before V7.
- **V8: Sandbox** (formerly D1b). A scratch project estate on the sidecar.
- **Final cut** (formerly D8). Delete the inherited `/c/:id/:view` routes,
  `connection.tsx`, `src/vendor/`, `surrealdb`, the vendor chunks and aliases
  in `vite.config.ts`, and the vendor fields of the connection model (with a
  configuration migration). The identity gate reaches zero and loses its
  `src/vendor/` exemption.

#### Rebuilt when RRFlow serves them

| Subject | RRFlow operation needed | RRFlow owner |
|---|---|---|
| GraphQL lens | GraphQL over HTTP | H-04 |
| Functions lens | governed function catalogue, install and execute | H-04, I-06 |
| AI models lens (the workbench's existing Models tab covers data models) | model manifest admission | Gate G |
| Principals and access lens | principal, grant and credential administration | POAM-016 |
| Vector index lens (TurboQuant build, activate and retire) | quantization lifecycle and HNSW build | OBJ-13, E-04 |
| Live operations beyond subscriptions | WebSocket request execution | H-04 |
| Browser runner and embed | browser deployment | RRFlow deployment profiles |

These follow RRFlow's dependency order, which the owner kept strict on
2026-10-24.

## Definition of done

- `pnpm check:identity` reports zero inherited vendor dependencies and has no
  seam exemption.
- No file, symbol, UI string, asset or configuration value names the inherited
  vendor outside `NOTICE` and the license report.
- Every repository reference resolves to `github.com/rrflow/connectome-development`.
- The application ships no cloud/organization pages, inherited assistant,
  inherited release notes or inherited branding.
- Every remaining view reads and writes through `@rrflow/rrd-client` or the
  native `rrd-client`.

## Execution journal

### 2026-10-18 — Slice A

Branch `agent/connectome-ownership` from `main` `29c9a14`.

- Repointed 120 URLs in 61 files at `rrflow/connectome-development`.
- `package.json`: `license: MIT`, `repository`, `version: 0.0.0` (matching
  `Cargo.toml`; the inherited `3.7.3` line is gone), license-report path fixed.
- README: repository boundary states the sibling-repository decision; the
  "Origin and license" section says what the project is and points at
  `NOTICE`; the alpha paragraph no longer calls the inherited client
  "compatible" with anything.
- REVIEW.md: no new imports from the inherited UI kit.
- `NOTICE` written; `src/vendor/*` doc comments now say exactly whose code they
  re-export and that importing them runs the inherited engine.
- Identity gate extended (decision 3); proven to fail on a prose mention, a
  vendor-named path and a seam file that hides its vendor, and to pass a
  declared import. `pnpm check` green.
- Deleted `bun.lock` and the two vendor logo PNGs (no references).
- Owner's answers applied (decisions 1, 6, 7, 8, 9): `LICENSE` rewritten
  with Connectome's MIT and the AngryVibes LLC copyright; Tauri bundle
  copyright, Cargo and npm authors, `index.html` and the About tab name the
  holder; identifier `dev.rrflow.connectome`; version `0.0.5`, channel
  `alpha`, `scripts/version.mjs` in `pnpm check` (round-trip to 0.0.6 beta and
  back leaves no diff; a suffixed version and an unknown channel are
  rejected); the About tab shows "0.0.5 alpha" and links the engine
  repository correctly; the 73 inherited changelogs are removed and
  `0.0.5.md` authored; `CHANGELOG.md` rewritten. Sprint 007's submodule steps
  retired.

### 2026-10-18 — Slice B

Branch `agent/connectome-cloud-strip` from `main` `a3e00ee` (Slice A merged
as PR #6).

Scope grew from "the 105 STRIP files" to the whole inherited hosted-service
surface once the dependency map was drawn: the vendor's cloud account,
organization, billing, invoice, support, support-plan and referral pages; the
`src/cloud/` API, queries, mutations, hooks and modals; the auth-callback
screen and the cloud OAuth session-storage keys; the dashboard and monitor
views (gated to cloud connections) and the metrics charts; the Sidekick
assistant (component, view, store, hook, modal, command, intents); the
newsfeed (hook, action-bar item, modal, Overview block, command, intent); the
Intercom support chat and its ticket/conversation types; the help-centre and
create-message modals; the `Context` provider (a WebSocket to the vendor's
hosted "context" instance, renamed by sprint 006 to a `rrflow.cloud` host that
does not exist); the cloud `deploy` store and the toolbar's "Deploy to Cloud"
flow; the cloud sign-in button; cloud referral/invitation/AWS-marketplace
query-parameter capture; the `"cloud"` authentication mode and
`cloudInstance` field of the connection model; the `cloud` and `gtm` settings
categories and their preference sections; eleven cloud-era feature flags; 63
cloud/Intercom/observer types; the analytics module and its 49 `tagEvent`
call sites, which posted a visitor cookie, the page URL and title and, on
sign-in, the account email to a tracking endpoint (sprint 006 had rewritten
the host to `127.0.0.1:8000`); the native `track_event` command, which sent
`document.cookie` and the user agent to any URL the renderer named, and its
`src-tauri/src/analytics.rs`. Dependencies removed with their last importer:
`@intercom/messenger-js-sdk`, `flag-icons`, `react-window`,
`react-virtualized-auto-sizer`, plus eight that no file imported any more
(`@mdi/js`, `@tauri-apps/plugin-deep-link`, `react-markdown`, `remark-gfm`,
`remark-github-blockquote-alert`, `rss-parser`, `turndown`,
`@types/turndown`, `@types/react-window`). Net: 221 files deleted, 60
changed, about 25,700 lines removed; `src/types.tsx` 1189 → 678 lines; the
toolbar 658 → 298; the Overview 608 → 377.

Kept, on purpose: the `connectome://` deep-link scheme registration in the
native shell (nothing handles it yet; removing an OS registration is a
packaging decision for the release workflow); the Docker adapter minus its
cloud and telemetry fields; the `migrations`, `documentation` and the seven
engine-backed views (Slice D).

Found while deleting, not fixed here (pre-existing on `main`):
`src/shell/components/App/modals/changelog.tsx` and `modals/documentation.tsx`
are imported by nothing, so the "View release changelogs" command and the
documentation search intent open nothing. Recorded for Slice D, which owns
the documentation view.

Verification: `pnpm check` green (Biome, identity gate — 7 inherited vendor
dependencies still declared, unchanged by this slice — dependency authority,
version contract, tsc); production build green; render smoke 2/2 against the
production bundle; `cargo fmt --check`, `cargo check --locked`,
`cargo clippy --all-targets -- -D warnings` green; `cargo test --all-targets`:
27 passed, 3 ignored (the RRD process tests, which CI runs with a real
engine). Stored configurations that still carry `settings.cloud` or
`settings.gtm` merge harmlessly (extra keys are assigned, never read); a
config-version migration is not needed.

### 2026-10-18 — Slice C1: icons, pictograms, code block

Branch `agent/connectome-icons` from `main` `1f34a3d` (Slice B merged as PR #7).

- `src/icons.ts` names the 119 icons the interface draws and resolves each to
  a 24×24 path from Material Design Icons (`@mdi/js`, Apache-2.0, in the
  license report). `src/components/Icon` draws them (same props the kit's
  `Icon` took: `path`, `size`, `color`, `spin`, `flip`, Box props).
- `src/pictograms.ts` exports four original Connectome SVG illustrations
  (connected nodes, terminal prompt, stacked layers, shield) in place of the
  vendor's pictograms.
- `src/components/CodeBlock` is a read-only block on Connectome's own
  `CodeEditor` (RRFlowQL and JSON highlighted — JSON via
  `@codemirror/lang-json`, MIT — copy button, optional title and line
  numbers); the editor snapshot type is `CodeEditor`'s own.
- A codemod rewrote 139 files' kit imports to `~/icons`, `~/pictograms`,
  `~/components/Icon`, `~/components/Spacer`, `~/components/CodeBlock`.
  The kit is now imported by three files only: `src/shared/util/mantine.tsx`
  (`MANTINE_THEME`), `src/shared/util/head.tsx` (`FontLinks`, which loads
  Inter and JetBrains Mono from Google Fonts at runtime) and the two startup
  entrypoints (`styles.css`). Those are the visual identity (Slice C2, a
  decision: the current look is the vendor's — its brand gradient as
  `defaultGradient`, 117 `[data-variant=surreal]` rules, its palette names).
- Verification: `pnpm check` green (identity gate still 7 inherited vendor
  dependencies — the kit stays declared until C2); production build green;
  render smoke 2/2; screenshots of the Overview and the connection page show
  the new icons and pictograms with zero page errors.

### 2026-10-18 — Slice C2: Connectome's own look (Decision 10 = A)

Branch `agent/connectome-theme` from `main` `ce08e2f` (Slice C1 merged as PR #8).

- Decision 10 (owner, 2026-10-18): Connectome theme now, ColdLight tokens
  later. `src/shared/util/mantine.tsx` is Connectome's theme — type (Inter
  Variable, JetBrains Mono Variable, self-hosted from `@fontsource-variable/*`,
  OFL-1.1; no runtime fetch from Google Fonts), sizes, spacing, radii, the
  `obsidian` and `slate` neutral scales, the `rrflow` accent scale (also
  bound to `violet`), the violet → cyan gradient, and component defaults on
  Mantine's built-in variants. `src/shared/assets/styles/theme.scss` carries
  the same identity as `--connectome-*` custom properties (the previous
  `--rrflow-energy`/`--rrflow-passion`/`--Connectome-*` names — the vendor's
  token vocabulary, inconsistently renamed — are gone; `--Connectome-gradient`
  was referenced in four places and defined nowhere). The dead
  `coldlight.scss` (a neon palette nothing imported) is removed; ColdLight
  arrives as generated tokens mapped in `mantine.tsx`.
- Found while replacing the theme: the tree still shipped the vendor's
  bowler-hat logo as **the application icon on every platform**
  (`src-tauri/icons/*`, `public/favicon.ico`), its wordmark as the settings
  and mini-view logo, its "Sandbox" screenshot, its referral-program art,
  its glow images, its SurrealQL/SurrealML logos renamed, its social-link and
  README imagery under `.github/images`, and `CODEOWNERS` naming its
  maintainers as owners of this repository. All deleted or replaced: an
  original application icon (`src/shared/assets/brand/app-icon.svg`,
  rendered to every platform format by `tauri icon`), a text `Wordmark`
  component, a CSS `TopGlow`, `CODEOWNERS` = the owner. The unmounted
  `new-domain` screen (the vendor's domain-move notice) is deleted.
- `@surrealdb/ui` removed from `package.json`; identity gate 7 → 6. The six
  that remain are the engine, client and editor packages Slice D removes.
- Verification: `pnpm check` green; production build green; render smoke
  2/2; screenshots of the Overview, the connection page and the settings
  modal under the new theme with zero page errors; fonts verified loaded
  from the bundle (`document.fonts.check`).

### 2026-10-18 — Slice C2 CI blocked; Slice D paused (Decision 11)

- PR #9's CI did not start: every job failed in four seconds with the
  GitHub annotation "The job was not started because recent account
  payments have failed or your spending limit needs to be increased"
  (the `rrflow` organization's Actions billing). The workflow is unchanged
  and was green on `main` twelve minutes earlier. The owner clears it under
  the organization's Billing & plans; CI is then re-run and PR #9 merges on
  green.
- Decision 11 (owner, 2026-10-18): pause Slice D until billing is fixed and
  the Slice C2 build is verified on the owner's desktop. The two orders
  considered for the first D increment stay recorded for that moment:
  delete the inherited engine surface first (recommended: the RRD runtime
  page already carries the graph lens with scope/depth/direction drill-down,
  an RRFlowQL console, vector and storage lenses; the nine SurrealDB views,
  the Sandbox, the datasets, `src/vendor` and the six remaining vendor
  packages would go, the connection model would lose its SurrealDB
  authentication fields with a config migration, and the identity gate
  would reach zero), or build the RRFlowQL studio on RRD first and delete
  afterwards.
- Desktop verification of `agent/connectome-theme` (PR #9): check out the
  branch, `pnpm install`, `pnpm engine:stage` (or `--from <path to a built
  rrflow>`), `pnpm tauri:dev`; expect the Connectome application icon, the
  text wordmark in Settings, the violet → cyan theme, Start serving →
  engine/install/serve/ready stage cards → the runtime lenses.

### 2026-10-24 — Slice D researched; `main` protected

Branch `docs/sprint-009-rrflow-conversion` from `main` `38142b7`.

- Owner instruction and decisions 12 to 15 recorded; decision 1's
  submodule prohibition corrected; decision 16 records fold-then-delete.
- Three read-only inventories, of `main` `38142b7`, the unmerged branches and
  `rrflow-development` `4dc93b7f`, produced the disposition and increment
  tables above. The seven `agent/*` branches squash-merged as PRs #2 to #8
  are identical to their merge commits. `agent/connectome-rrd-only` is an
  unverified deletion draft whose committed tree leaves 15 imports pointing
  at deleted modules; its deletion list informs D1 and D8, and it is not
  merged.
- PR #14 adds the `merge_group` trigger and one stable `ci-gate` check.
  Ruleset 25803168 now protects `main` (decision 15): the effective rules
  read back as deletion, non_fast_forward, pull_request,
  required_status_checks (`ci-gate`, GitHub Actions) and merge_queue (merge
  commits, all-green groups, five entries, 120-minute check timeout against
  observed 8- to 13-minute runs). PR #14 is the first merge-queue candidate.
- Next: Slice C2 (rebase PR #9, application icon from decision 13), then D0.

### 2026-10-24 — Slice C2 completed on current `main` (decisions 12 and 13)

Branch `agent/connectome-theme` (PR #9), with `main` `38142b7` merged in
(clean; the lockfile installs frozen).

- Application icon (owner decision 13): `src/shared/assets/brand/app-icon.svg`
  is now the Connectome mark already shown in the sidebar and on the Overview
  (`src/shared/assets/pictograms/connectome.svg`), with its own geometry,
  stroke and gradient, on a dark tile on the 824-unit macOS grid. It replaces
  the redrawn hub of 2026-10-18, which used other proportions and the theme
  gradient. `tauri icon` re-rendered all 50 platform files; `public/favicon.ico`
  is the rendered `icon.ico` (16 to 256 pixels).
- Found while converting: the mark's gradient uses each element's bounding
  box, so its two horizontal links (zero-height boxes) never painted in
  Chromium or in the icon renderer. The mark users know is four links and
  five nodes; the two dead links are removed from both files.
- Installer art: `src-tauri/res/dmg-background.png` (the inherited hat and
  wordmark) is re-rendered from the mark, the bundled Inter font and the
  `Wordmark` gradient by `scripts/brand/render-installer-art.mjs`, at Tauri's
  default disk-image layout. The unreferenced `dmg-background-original.png`,
  `nsis-header.bmp` and `nsis-sidebar.bmp` are deleted.
- Biome fixes left by the theme change: the unused `Image` import in the
  settings dialog and the single-child fragments left in both startup
  entrypoints after `FontLinks` was removed.
- Verification: `pnpm check` green (identity gate across 508 files, six
  inherited vendor dependencies still declared, dependency authority,
  version contract 0.0.5 alpha, `tsc`); `pnpm build` green; `pnpm test:smoke`
  4 passed; production-bundle screenshots of the Overview and the settings
  dialog show the mark and the text wordmark with zero page errors. Native
  checks and the RRD process tests run in CI. The desktop check of decision 11
  is the owner's on the built bundle.

### 2026-10-24 — Slice D0: RRFlow pages load no inherited client

Branch `agent/slice-d0-rrflow-isolation` from `main` `38142b7`. Plan and
decisions 12 to 16: PR #15.

- Oracle first: `scripts/check-rrflow-isolation.mjs` walks the runtime import
  graph from the nine RRFlow entry modules (`src/rrflow/*`, the Overview,
  Create Connection, Control Plane, runtime workbench and diagnostics pages)
  and fails, naming a shortest path, when one reaches `src/vendor/`,
  `connection/connection.tsx` or an inherited vendor package. Dynamic
  `import()` and statement-level `import type` edges are not followed; they
  load nothing with the page. On `main` it failed for every page. It is now
  part of `pnpm check` (`pnpm check:isolation`) and is proven to fail on an
  injected value import, re-export and side-effect import, and to pass a
  type-only and a lazy import. The identity gate exempts it, like itself,
  because it must name the packages it forbids.
- The chains it found, and the cut for each:
  - every page → `shell/stores/config` → `shared/util/helpers` →
    `connection.tsx` (one value parser): `tryParseParams` moves into
    `connection.tsx`, which also ends a module cycle;
  - helpers → `adapter/index` → the mini adapter → the in-browser engine,
    the client, both WASM parsers and the embed message channel: the mini
    adapter now loads them on demand inside the methods that run on the mini
    page, so the selector imports only the class. The mini runner and its
    embed generator stay, by the owner's 2026-10-24 rule that no visual is
    removed before its RRFlow replacement exists (decision 17, recorded with
    the visual baseline). The nginx routes left over from Slice B's deleted
    cloud pages are removed;
  - the error dialog → `CodeBlock` → the inherited editor language: the
    RRFlowQL language is loaded on demand until D3 replaces it;
  - `CodeEditor` → the `~/editor` barrel → editor extensions on the
    inherited language: it imports `base`, `folding` and `theme` directly,
    and the query and GraphQL keymaps move to `editor/query-keymaps.tsx`;
  - `stores/database` imported a type as a value: now `import type`;
  - Create Connection → `useConnectionLabels` → the connection hooks →
    the namespace and database modal: `useRequireDatabase` moves into
    `modals/require-database.tsx`;
  - the Overview → the connection editor → `openConnection` and the address
    probe's client: both load on demand; the probe moves to RRFlow
    readiness in D2.
- Dead code removed on the way: the `GraphqlQuery`, `SidekickChat` and
  `SidekickChatMessage` types.
- Not in D0: the application shell still loads the inherited client at
  startup through the Designer and Inspector providers, two application
  modals, the inherited views and the inherited UI kit (Slice C2, PR #9).
  They leave with their lenses in D4 to D6 and in D8, where the startup entry
  joins this gate. Decision 17 re-scopes D1: nothing is deleted before its RRFlow lens exists.
- Visual proof (decision 17), with the `tests/visual/` harness of Slice V0
  run on PR #9 (C2) and on this branch: the first capture found every
  RRFlowQL `CodeBlock` empty (the empty-state examples of the explorer,
  functions and parameters views and the query-history previews, 3.4 to 9.6
  percent of each image). `CodeEditor` rebuilds its state without the
  document when its extensions change, and the on-demand language changed
  them after mount. `CodeBlock` now remounts the editor once the language
  arrives and keeps the loaded language for later blocks. The recapture
  compares 46 identical, 48 negligible and 0 changed against PR #9; the 4
  dynamic captures show the same 5 records, 6 edges and legend in the result
  graph and the same map contents.
- Verification, with Slice C2 and the plan merged in: `pnpm check` green
  (identity gate across 510 files with 6 vendor dependencies, isolation gate
  9 entries, dependency authority, version contract, `tsc`); `pnpm build`
  green with the `mini/run` output kept; `pnpm test:smoke` 4 passed. A first
  smoke run lost one test to a timeout while two stray preview servers from
  the visual-baseline captures were still running; with them stopped, all
  four pass. Native and RRD process checks run in CI.

### 2026-10-24 — Slice V0: inherited visual baseline (decision 17)

Branch `agent/slice-v0-visual-baseline` from `main` `83804c3` (#14 and #15
merged). After the owner's rule, the uncommitted D1a deletion of five
inherited views was discarded and PR #16 (D0) was revised to keep the mini
runner and embed generator.

- `tests/visual/` captures every reachable inherited screen and state from a
  production build of `main` `38142b7` (the UI is unchanged through
  `83804c3`): 49 states per theme, dark and light, at 1440x900, with the
  in-browser Sandbox seeded from `seed.surql`. `PARITY.md` lists, per screen
  and graph, the visual elements and interactions its RRFlow lens must keep
  or improve.
- Found while capturing, recorded in `tests/visual/README.md`: the inherited
  screens are unreachable in the shipped app (the Sandbox defaults to an
  RRFlow runtime profile) and broken when reached (a renamed version prefix
  fails every inherited connection; the mini page lost its adapter meta tag;
  the embed generator builds its URLs without the serving port).
  `capture-only.mjs` undoes the first three in a working tree for capture
  and restores the files byte for byte.
- Determinism: two captures of one build first differed in 18 of 98 images
  (random relation ids and their row order, query timings, animations still
  running, random force-layout starts). The seed now uses fixed relation
  ids, the capture masks timings, turns on the application's "Disable
  animations" preference with reduced motion, and seeds `Math.random`.
- After those fixes two captures of one build compare 51 identical, 47
  negligible (the largest 0.044 percent, the About tab's build time) and 0
  changed. The result graph and the map are reported as dynamic and reviewed
  by eye. The committed baseline is the second of those runs: 98 lossless
  WebP images (5.4 MB) with a manifest of revision, seed digest, capture-only
  patches and per-image SHA-256.
- First use: comparing PR #9 with PR #16 caught D0 emptying every RRFlowQL
  code block (recorded under Slice D0); after its fix the two compare with 0
  changed screens. PR #9 against this baseline changes all 98 images by
  design (theme, wordmark, icon); its before/after is for the owner's review.

### 2026-10-25 — Slice V0b: RRFlow-native desktop baseline (decision 17)

Same branch, from `aaa5436f`. The owner restated the rule for graphs: every
graph is authored and captured as RRFlow, and no visual may regress, only
improve. The RRFlow-native screens had not been captured, because they need
the desktop application and a running engine.

- `tests/visual/capture-native.mjs` drives a preview desktop build through
  WebView2's remote debugging port: it installs a fresh estate through the
  application's own installation preview, serves it, seeds it, and captures
  36 states per theme at 1440x1800. These cover the overview, project
  engines, installation preview and serving; every workbench tab and lens;
  the records graph selected, around the selection and coloured by kind; the
  RRFlowQL console query and traversal; the vector map, stored points and a
  selected point; every storage counter and the history and indexes; a
  native table's rows; every panel; and all seven settings tabs.
- `seed_served_estate_for_visual_capture` (an ignored test in
  `src-tauri/src/rrd/client/process.rs`) seeds the served estate with the
  existing lens fixture: 12 records, 14 relations, one collection of 8
  vectors. It reads the operator credential inside the native process, and
  the capture passes only its path. Without the capture's variables it
  returns at once, so CI's `--ignored` run of `rrd::client::process::`
  passes over it.
- Isolation incident and fix. The first preview launch used the user's real
  `RRFlow/Connectome` data folder, not `RRFlow/ConnectomePreview`.
  `src-tauri/build.rs` did not rerun when `VITE_CONNECTOME_PREVIEW` changed,
  so the rebuilt preview binary kept the release data directory. That launch
  showed the user's saved profiles, rewrote `config.json` (same 7,763 bytes,
  new modification time) and appended to `connectome.log`. No content copy
  existed before it, so whether `config.json`'s bytes changed is unknown. A
  full copy of the folder was then taken, `build.rs` now declares
  `rerun-if-env-changed=VITE_CONNECTOME_PREVIEW`, and after every later run
  the real folder was compared file by file (SHA-256) with that copy. It was
  identical each time.
- Determinism. Times render in UTC, and only the characters that change
  between runs are painted magenta (instance identity, port, dates and
  times, a query's pinned clock reading, durations, the capture folder), so
  the surrounding words stay visible. No motion or randomness override was
  needed. Two captures of one build compared, dark: 2 identical, 25
  negligible (at most 0.02 percent), 9 dynamic, 0 changed; light: 2
  identical, 25 negligible (at most 0.051 percent), 9 dynamic, 0 changed.
  `compare.mjs` now reports the records graph states and the storage
  engine's live counters as dynamic. One light run read 12 more versions and
  6 more keys than the other three runs, most likely an automatic session
  renewal landing earlier in a slower run.
- Baseline: `tests/visual/baseline/native/83804c3/{dark,light}/`, 72 lossless
  WebP images (13.3 MB), the second run of each pair, with a manifest of
  revision, viewport, engine revision `4860a253`, estate, determinism
  measures and per-image SHA-256. Each image decodes pixel-identical to its
  PNG capture. `PARITY.md` lists, per native screen and graph, what each
  later slice must keep or improve.
- Found while capturing: the desktop Settings dialog still showed the
  inherited "Surrealist" wordmark at `83804c3`. Slice C2 (PR #9) replaces it;
  on the owner's approval it landed in `main` as `942b76bf` on 2026-10-25, and
  that `main` is merged into this branch. The installation preview
  shows the project path with a raw `\\?\` prefix, recorded in `PARITY.md`
  as an improvement target.
- Verified locally: `pnpm check` (Biome, identity, dependency authority,
  version and TypeScript), `cargo fmt --check`, `cargo clippy --all-targets
  --locked -- -D warnings`, and four full desktop captures (two per theme)
  with no failed step. The native and RRD process test suites run in CI.

### 2026-10-27 — Slice D1a: the API reference from RRFlow's catalogue (decision 17)

Branch `agent/slice-d1a-api-reference` from `main` `62b46094`. On
2026-10-26 the owner chose the engine's operation catalogue as the owner of
the API reference's prose. RRFlow PR #147 added it, and merged as
rrflow-development `86adada6` on 2026-10-27.

- Engine pin. `rrd-client`, `rrd-contract` and `@rrflow/rrd-client` move
  from `4860a253` to `86adada6` (OpenAPI SHA-256 `b0b7a624…`), and the
  sidecar is rebuilt from it (SHA-256 `56a512cf…`). The catalogue now gives
  every operation a family, summary and description, and lists ten families
  with their titles and descriptions. A first trial pin, `ebdcb33d` (the
  first commit of #147), differs from `86adada6` only in RRFlow documentation
  and evaluation fixtures. Three other engine changes in the range needed
  Connectome changes:
  - Installation identity. `install plan` now requires `--identity`, a
    64-digit hexadecimal identity from `rrflow install identity`. The native
    preview allocates one and returns it with the preview, serve sends the
    previewed identity back, and an install without one is refused ("Review
    the installation preview again; its identity is missing").
  - Executable link count. The engine refuses to start from an executable
    with more than one hard link (`file link count denied: expected=1
    observed=2`). Cargo's `target/release/rrflow.exe` is a hard link into
    `deps/`, so local runs use a copy; the staged sidecar is already one.
  - Storage counters. Segment I/O gains open files, peak open files and
    handle evictions, reopens and denials. A new Admission group shows
    checkpoint entries, native transactions and their bytes, read views,
    retained bytes and source pages, and outstanding and queued requests,
    with the engine's caveats and a "Fenced" note when a transaction failed
    while holding the permit.
- The API reference (`RuntimeConnection/api/`). A new workbench tab reads
  the catalogue at `/v1/schema/endpoints` without a session. The native
  transport allows that one public read-only path, not the OpenAPI document,
  and a test proves every allowed public path is a public read-only engine
  operation. Each of the 56 operations (55 over HTTP, 1 WebSocket) shows its
  summary, method and path, description, authentication, mutation and action
  badges, its operation, request and response types, and a titled example
  in the saved language. Examples cover CLI (curl), TypeScript, Python, Go,
  Java and .NET, generated from the catalogue's method, path,
  authentication, mutation and request type with each SDK's own naming. The
  inherited PHP and C settings fall back to CLI.
- The topic list follows the article in view: the last article whose top
  has reached the sticky list, or the first. The first capture used an
  IntersectionObserver, which reports only changed entries, and it
  highlighted the operation after a jump's target and never updated at the
  top of the page. A jump now holds its topic until the reader scrolls, and
  the list scrolls itself, never the page, to keep the active topic in view.
  The capture asserts the highlight after a jump, at the top, and after a
  4,000-pixel wheel scroll (all four runs stop on "Apply a previewed endpoint
  configuration plan").
- Examples verified. `pnpm check` type-checks all 55 TypeScript examples
  against the pinned SDK (`scripts/check-api-examples.mjs`). Once, locally,
  against the SDKs at `86adada6`: the 55 Python examples run against the SDK
  with `call` replaced by a check of operation, body, credentials and
  idempotency key; the 55 Go examples pass `go vet` and `go build`; the 55
  C# examples build with no warning. The Java examples were not compiled:
  this machine has no JDK.
- `CodeEditor` fix. `EditorView.scrollIntoView`, on mount and on every value
  change, scrolled each scrollable ancestor, so the API reference jumped to
  the last code block rendered. The editor now resets only its own scroll
  position. The inherited documentation view had the same jump and now opens
  at its top.
- Real-folder incident and fix. A test build resolved the release data
  folder, as it does on `main`, so running the real-engine process tests on
  this workstation wrote six installation plans into the owner's real
  `RRFlow/Connectome/plans` (2026-10-27, 00:27:35 to 00:27:40). They were
  additions only; the owner's own plan was untouched. They were removed, and
  the folder then matched its SHA-256 snapshot. Test builds now use a
  per-process temporary folder (`paths.rs`, with a test that it never
  resolves a user directory). Every later test and capture run left the real
  folder identical to the snapshot.
- Desktop capture, final build. The capture adds the API reference tab and
  its states: 39 per theme. Two captures per theme compared: dark 10
  identical, 20 negligible (at most 0.051 percent), 9 dynamic, 0 changed;
  light 10 identical, 20 negligible (at most 0.053 percent), 9 dynamic, 0
  changed.
- Before and after, against `main` `62b46094` captured with the same harness
  (engine `4860a253`): per theme 8 identical, 16 negligible, 9 dynamic and 3
  changed, plus the 3 new API reference captures. Reviewed by eye, every
  difference is the new tab or the engine's own report:
  - advanced details (7.9 percent dark, 11.3 light): the engine reports 20
    capabilities, not 18 (`knowledge-tree-catalogue`, `rrflow-parquet-1`),
    and the extra row moves the rest of the panel down;
  - a native table's rows read 106 storage keys, not 72, and the nearest
    vectors 43, not 72, with the same rows and scores;
  - storage counters gain the new rows and the Admission group, so the
    history section below them sits lower in its capture;
  - every other screen differs only by the new tab.
- Inherited screens, with the browser harness of Slice V0, `main`
  `62b46094` against the final tree, 49 states per theme: 42 identical, 49
  negligible (at most 0.096 percent, the light About tab), 4 dynamic and 3
  changed. The documentation view changes in both themes (11 percent):
  `main` opens it scrolled to "Deleting records", and this branch opens it
  at its introduction. The dark About tab changes by its build time and the
  engine revision it names (`4860a25` to `86adada`).
- Verified locally: `pnpm check`, `cargo fmt --check`, `cargo clippy
  --all-targets --locked -- -D warnings`, the native tests (31 passed, 6
  ignored), the six real-engine process tests on the `86adada6` engine, and
  four desktop captures with no failed step.

### 2026-10-27 — Owner correction: re-author in place (decision 18)

After D1a landed, the owner said the conversion was being rushed and was not
a conversion. Checked on `main` `d706d360` before writing decision 18:

- **The inherited views can't be reached in the desktop app.** Every
  connection the app creates, the Sandbox included, has
  `target: "runtime"`, and `/c/:connection/:view` redirects such targets to
  `/runtime/:id`:
  - `src/shared/util/defaults.tsx` (`createBaseConnection`,
    `createSandboxConnection`);
  - `src/screens/connectome/index.tsx` (lines 194-205);
  - `src/hooks/routing.ts` (lines 55-62).

  The Query editor, Explorer and inspector, Designer, Documentation,
  Functions, Parameters and Access views therefore render only in the browser
  harness.
- **They still run SurrealDB under new names.**
  - `src/vendor/rrflow-client.ts` re-exports `Surreal as RRFlow`, and
    `src/vendor/rrflowql-editor.ts` re-exports the vendor's grammar.
  - Value parsing runs in `@surrealdb/ql-wasm-v3`.
  - Every view sends SurrealQL: `INFO FOR DB STRUCTURE`, `DEFINE TABLE`,
    `RELATE`, `SELECT … FROM … START`.
  - The "RRFlowQL" labels date from the 2026-08-26 rename "establish RRFlowQL
    native baseline".
- **D1a repeated the pattern.** It added an API tab to the workbench and left
  the documentation view in place.
- **The engine had no organisation for a project's internal domains.** At
  development `86adada6` the registry carried only an inert
  `namespace`/`database` label.
  - The owner then directed configurable domains: a default setup each
    project tunes, kind grouping, categories and tags, optional isolation,
    and per-domain drill-down, all informed by current research.
  - RRFlow PR #156 records this as ADR-0003, the estate organisation
    contract, OBJ-15, roadmap item H-11 and POAM-042.
  - RRFlow PR #159 (H-11a) adds domains, categories, memberships and kind
    tags to the schema registry.

Decision 18 supersedes decision 16. The ordered increments are re-sequenced
as R0, F1-F5, S1, V1-V8 and the final cut. Each view is re-authored in place
and goes live only once it runs on RRFlow, and each Surreal package leaves
with the last view that uses it.

### 2026-10-27 — Step F1a: governed effects through the native client (decision 18)

Branch `agent/f1a-native-effects` from the decision-18 plan branch `076ca26e`
(PR #19), on engine pin `86adada6`. F1 was split into F1a (request and
response effects) and F1b (live `/v1/ws` subscriptions), as D1 was; F1b's
connection, acknowledgement and session-renewal design is its own review.

- **Read first:**
  - the native client (`rrd.rs`, `client.rs`, `client/process.rs`, `view.rs`,
    `error.rs`) and `src/rrflow/session.ts`;
  - at `86adada6`:
    - `rrd-client` (`operation.rs`, `session.rs`, `subscription.rs`) and its
      `tests/real_server.rs`;
    - the contract's transaction, changefeed, audit, backup, export and
      WebSocket types;
    - the engine's `transaction.rs`, `backup.rs` and `changefeed.rs`.
- **Twelve commands** (`src-tauri/src/rrd.rs`), with views in `view/effect.rs`
  and `view/history.rs` and methods on `RrdSessionClient`:
  - Changes: `rrd_change_preview`, `rrd_change_commit`, `rrd_change_discard`.
    - A preview begins a transaction in the `data` scope and returns an opaque
      handle.
    - A commit names the handle and the digest the operator approved; the
      native process commits the previewed mutations it holds.
    - One change is pending per connection, matching the session's one
      transaction; a newer preview discards the older.
    - A replaced session fails the commit closed.
    - A commit whose outcome is unknown keeps its idempotency key, so a retry
      replays it.
    - A refused commit aborts its transaction.
  - History: `rrd_changes`, `rrd_changes_follow`, `rrd_audit`.
  - Exports: `rrd_query_export`, `rrd_audit_export` and `rrd_artifact_save`.
    - The SDK verifies the file, and the native process holds it, four per
      connection at most.
    - The native save dialog writes it whole: a sibling file, then a rename.
  - Backups: `rrd_backups`, `rrd_backup_create`, `rrd_backup_restore`.
    - A restore stages a verified root beside the estate.
    - Each backup has one restore id, `restore-<16 digest characters>`.
- **Engine behaviour the tests found, all at `86adada6`:**
  - **Commit deadline.** A commit without `deadline_unix_ms` is refused ("commit
    requires deadline_unix_ms"). Each attempt now carries a fresh deadline.
  - **Required properties.** A preview does not check a strict kind's required
    properties; the commit refuses the record. The denial test pins this.
  - **Audit sequences.** They increase but are not contiguous. The chain links
    record to record by digest, across an engine restart too.
  - **The install's own commits.** A fresh estate's audit already holds
    commits from installation, so the test measures the commits and aborts it
    adds.
  - **Prospective snapshot.** A preview reads the whole data scope within its
    storage-key budget (`rrd-store` `preview_data_snapshot`). An estate with
    more than the contract's default of 10,000 keys cannot be previewed. This
    was read in the code, not run; it is to be raised as an RRFlow POA&M item.
- **First runs:**
  - A test helper read the audit chain until an empty page. Every read is
    itself audited, so the chain never ends. It now stops at the first page
    that is not full. That run was stopped, and its engine and test processes
    were ended.
  - The restart helper used the fresh-install helper; it now reopens with the
    previewed installation identity.
- **Verified locally:**
  - `pnpm check`;
  - `cargo fmt --check`, and `cargo clippy --all-targets --locked -- -D warnings`;
  - the native tests (37 passed, 10 ignored);
  - all ten real-engine process tests on the `86adada6` engine: the six earlier
    tests, the verified sidecar included, and the four new tests in
    `client/process/effects.rs`.
  - The owner's real `RRFlow/Connectome` folder had no change in the window of
    these runs.
- **Not done:**
  - No screen uses the new commands yet, so there are no captures; V1–V8 adopt
    them.
  - Authorization denial for a limited principal is not testable on an
    installed estate until RRFlow serves principal administration (POAM-016).
    The denial test covers the refusals that exist: a forged credential, a
    refused commit, another connection's handle, and a closed session.

### 2026-10-27 — Step F1b: live results over `/v1/ws` (decision 18)

Branch `agent/f1b-live-results` from F1a (`b9963eea`, PR #20), on engine pin
`86adada6`.

- **Read first, at `86adada6`:**
  - the engine's `subscription.rs`, in full;
  - the server's `/v1/ws` loop (`rrd-server/src/http/websocket.rs`);
  - the WebSocket contract, and the subscription half of the SDK's
    `real_server.rs`.
- **What the engine requires:**
  - **Ownership.** A durable subscription belongs to the session that opened
    it.
  - **Authorization.** The server authorizes every poll, ACK and heartbeat on
    a socket with the bearer it connected with. A session renewal rotates that
    bearer.
  - **Leases.** A subscription's lease is kept alive by client heartbeats and
    ACKs.
  - **Resume.** A resume must match the durable generation and the
    acknowledged cursor.
  - **Replaying an open.** It returns the current durable state.
- **Two commands:** `rrd_live_open` and `rrd_live_close`. Events go to a
  channel. `RrdSessionClient.openLive` and `closeLive` wrap them.
  - Each live subscription has its own task and socket, and at most eight are
    open per connection.
  - A delivery is handed over before it is acknowledged. After a reconnect,
    whatever was already handed over is skipped.
  - When the lease changes, the task reconnects:
    - after a renewal, it resumes the same subscription;
    - after a replacement, it opens a new subscription after the last cursor
      handed over.
  - The heartbeat also keeps the session fresh.
  - Three consecutive failed connections end the subscription with a
    retryable reason. Closing it, or disconnecting, closes the durable
    subscription on the engine.
  - The concurrency uses `std::future::poll_fn`. Tokio's `select!` would need
    the `macros` feature, a new crate in the lockfile.
- **Engine behaviour the tests found:** the engine parses a live query only
  when a change arrives. An invalid query therefore opens and sits idle until
  the next commit.
  - A live query opened without a cursor now runs once first. Its result is
    returned with the handle, and the subscription delivers what follows that
    cursor, so an invalid query is refused at open.
  - A query opened with a cursor of its own keeps the engine's behaviour, and
    the bounds test pins it.
- **First run.** The bounds test waited for that refusal and timed out; this is
  how the behaviour was found.
- **Known limit.** Reattaching replays the original open, which the engine
  checks against the retention window of one million cursors. A subscription
  that falls further behind than that ends, and is reopened from its last
  cursor.
- **Verified locally:**
  - `pnpm check`, `cargo fmt --check`, and `cargo clippy --all-targets --locked
    -- -D warnings`;
  - native tests: 39 passed, 14 ignored;
  - all fourteen real-engine process tests on the `86adada6` engine, including
    the four new ones in `client/process/live.rs`:
    - **Renewal and replacement:** changes arrive in cursor order across both,
      with no repeat.
    - **Live query:** it reports added, updated and removed rows.
    - **Restart:** across an engine restart the subscription ends retryably,
      and resumes from its cursor on a new connection.
    - **Bounds and refusals:** they hold, and disconnecting ends every
      subscription.
- **Not done:** no screen uses live results yet; V1 (Query) and the Activity
  area adopt them.

### 2026-10-27 — Step F2: the RRFlow value model (decision 18)

Branch `agent/f2-value-model` from F1b (`fd8f2daf`, PR #21), on engine pin
`86adada6`.

- **Read first:**
  - the pinned `@rrflow/rrd-client`: `operation.ts`, `index.ts` and the
    generated `rrd-openapi.ts`;
  - the contract's `QueryValue`, `CanonicalId` and mutation types;
  - the kernel's value rules (`rrd-core/src/data.rs`);
  - Connectome's own value renderer (`view.rs` `plain_value` and `bounded`);
  - every importer of `src/vendor/rrflow-client`. There are 40 files, all
    inherited views or their stores and modals, which V1–V3 re-author.
- **Decisions:**
  - **Types are derived, not generated again.** The SDK's generated OpenAPI
    types name only three schemas. Everything else is inline per operation.
    `src/rrflow/model.ts` therefore derives each named type from the SDK's
    `RequestPayload` and `SuccessPayload`: values, references, every mutation,
    geo, series and vector values, targets, logical models, and the schema
    registry. A pin move moves them, and `tsc` reports any use that no longer
    fits.
  - **Reads stay native.** The native process decodes every value at full
    64-bit precision and sends display text. The value model is for values the
    webview builds itself. JavaScript cannot carry an integer past 2^53 − 1
    through `invoke`, so the builders refuse one instead of rounding it.
  - **Typed read cells come with V1 and V2,** which change those screens with
    before and after captures. F2 changes no screen.
- **The model:**
  - builders for every value type: decimals and digests follow the kernel's
    rules, and integers must be exact;
  - typed text parsing for forms;
  - canonical identifiers and `kind:id` references;
  - an exactness check;
  - display that matches the native views: a UTF-8 byte bound, whole
    characters, and map keys in byte order rather than JavaScript's
    integer-first order.
- **Inherited value classes** map to RRFlow types as listed in the model's
  header. The contract has no duration value, and `escapeIdent` has no
  counterpart.
- **Golden engine values.** The new RRD process test `rrd::client::process::values`
  writes one record holding every value type to a real engine, including:
  - integers past what JavaScript holds exactly;
  - text past the display bound;
  - map keys whose byte order differs from JavaScript's key order.

  It reads the record back and requires `src/rrflow/fixtures/engine-values.json`
  to equal what the engine returned, with the native display of each value.
  `CONNECTOME_WRITE_GOLDEN=1` rewrites the file after a pin move. Two kernel
  rules turned up while writing it:
  - a relational kind is queryable as `record:` only with a record schema;
  - a schemaless kind may not declare one.
- **The check.** `scripts/check-value-model.mjs`, run by `pnpm check`, holds the
  model to the golden file. Every exact value displays as the native views
  display it; the two rounded integers are reported as inexact. It also checks
  the builders' refusals. Two deliberate breakages each failed at the expected
  value: removing the byte-order key sort, and a 2,047-byte bound.
- **Verified locally:**
  - `pnpm check`, which now includes the value-model check (12 engine values,
    18 checks);
  - `cargo fmt --check` and `cargo clippy --all-targets --locked -- -D warnings`;
  - the golden test, in write mode and in compare mode after formatting.

### 2026-10-27 — Step F3: the rrflowQL editor language (decision 18)

Branch `agent/f3-rrflowql-language` from F2 (`179d32e5`, PR #22), on engine
pin `86adada6`.

- **Read first:**
  - the engine's `rrd-query/src/syntax.rs` (the grammar, the tokenizer and
    the parser) and `fixtures/query-vectors.json`, at the pin;
  - how a refusal reaches a client: `engine/error.rs` (a service error's
    display is its debug form), `http/response.rs` (the error body carries
    that display), the SDK's `error.rs`, and Connectome's `rrd/error.rs`;
  - every use of `EXPLAIN CONTRACT` in the engine, and the operation
    catalogue's query operations;
  - PR #10's scanner (`src/rrflow/editor/lexical.ts`);
  - every importer of `src/vendor/rrflowql-editor.ts` and `@surrealdb/lezer`,
    and the inherited `CodeEditor`, editor base, theme and highlight tags.
- **Findings that changed the plan:**
  - **`EXPLAIN CONTRACT` does not stop execution.** At the pin it is carried
    into the bound query and its canonical text, and nothing reads it after
    that. No operation parses or binds without executing. The plan's "the
    engine validates through `EXPLAIN CONTRACT`" would have run the whole query
    on every keystroke. The engine validates when the query runs instead.
  - **The parse location arrives only as debug text.** A refusal's error body
    reads `Query("query parse error at byte N: …")`, with no structured details.
    The parser reports its validation refusals (`LIMIT 0`, `PROJECT` with no
    fields) at byte 0. It reports "end of query" one byte past the start of
    the last token, which can fall inside a character.
  - **PR #10's scanner is not salvaged.** It accepted comments, single quotes,
    backticks and decimals that the engine refuses.
  - **The inherited views still run the inherited language** over the
    inherited client. Switching their editor now would mis-highlight and
    mis-lint every query they run. F3 therefore supplies the language, and the
    runtime console, which already runs rrflowQL against the engine, adopts it.
    Each inherited view adopts it in its own V step.
  - **Linking `rrd-query` natively is out.** It would bring DataFusion, Parquet
    and `rrd-store` into Connectome, and it is a new dependency.
- **The language:**
  - **`src/rrflow/rrflowql.ts`:**
    - `scan`, the engine's tokenizer ported exactly. It records the engine's
      first lexical refusal and keeps going, so the rest of the query is still
      drawn.
    - `classify`, which names each token by its place in the engine's grammar.
      It never refuses anything.
    - `refusalRange`, which places an engine refusal on the token it names.
  - **`src/rrflow/editor.ts`.** A CodeMirror language whose syntax tree comes
    from `classify`. It uses the inherited grammar's highlight tags for the
    same things.
- **The refusal location.** `RrdError` gains `query: { offset, reason }` for
  `rrd_query`, `rrd_query_export` and `rrd_live_open`.
  - The native layer reads it from the engine's own error body: an
    `invalid_argument` refusal in the pinned debug form, with the escapes
    reversed.
  - It converts the byte offset to UTF-16 units against the query it sent. An
    offset inside a character counts that character.
  - The webview's `RrdCommandError.query` carries it.
- **The console.** The Records tab's RRFlowQL console moves from a text area
  to the inherited `CodeEditor` with the new language.
  - It is framed like the filled inputs around it, keeps at least the text
    area's two lines, and starts its text where the text area did.
  - Ctrl/⌘ + Enter still runs the query, above the base keymap's blank line.
  - A refusal shows on the word the engine names, for as long as the editor
    holds that query.
  - The alert gives the parser's reason instead of the SDK's whole error
    string. It quotes no character number: the engine puts "end of query" one
    byte into the last token, so a number would point into a word.
- **The golden.** The new RRD process test `rrd::client::process::language`:
  - reads RRFlow's query vectors from the engine source Cargo checked out at
    the pin, through `cargo metadata`, and requires each one to run and return
    its canonical form;
  - writes until the head reaches every cursor a vector names;
  - runs 45 queries through the console's command, and requires
    `src/rrflow/fixtures/engine-queries.json` to equal what the engine said.

  The corpus covers every lexical refusal, the parser's refusals, binding
  refusals that stay unlocated, offsets after characters wider than one UTF-16
  unit, and `u64::MAX`.
- **The check.** `scripts/check-rrflowql.mjs`, run by `pnpm check`, holds the
  tokenizer and the classifier to the golden:
  - every lexical refusal, at the engine's offset;
  - no refusal where the engine tokenized;
  - the token each quoted parse refusal names;
  - each vector's family, kind, fields and parameters read where the engine's
    parse put them.

  Eight deliberate breakages each fail it. Two of them first passed, which
  added the token-boundary check and `u64::MAX` to the corpus.
- **Engine findings for RRFlow's POA&M,** raised after RRFlow PR #156 lands:
  - transaction previews read the whole data scope and do not check objects;
  - rrflowQL refusals carry no structure, and queries cannot be checked
    without running.
- **Verified locally:**
  - `pnpm check`, which now includes the rrflowQL check (45 engine queries, 3
    RRFlow vectors, 100 checks);
  - `cargo fmt --check` and `cargo clippy --all-targets --locked -- -D warnings`;
  - 43 native unit tests, and all 16 real-engine process tests;
  - the editor language in a real CodeMirror state: every token tagged as
    intended, refusals tagged invalid, and a reparse after an edit.
- **Captures (decision 17).** The native desktop captures compare F2's head
  (`179d32e5`) with F3 in both themes, with the same harness for both sides.
  The first run found two real problems, both now fixed:
  - the console's box was one line tall where the text area showed two, and
    its text started 9 px further in;
  - the clock reading in `AT VALID` was unmasked, because the harness matched
    its patterns within single text nodes and the editor splits a line into
    one node per token.

  The harness changed with F3:
  - it matches the masks over each editor line;
  - it waits for the overview's own content, after a first launch painted a
    blank window;
  - it adds the step the console changes most: a query the engine refuses,
    typed where the console takes text and run (`records-refused`).

  Runs three and four found two more, both fixed:
  - the new step clicked the autosizing text area's hidden copy;
  - the alert quoted a character number that pointed into a word.

  The final compare covers 40 pairs per theme. In dark: 9 identical, 21
  negligible, none changed and 10 dynamic. In light: 9 identical, 21
  negligible, none changed and 10 dynamic. The dynamic screens were reviewed
  by eye:
  - the console's query and traversal show the same query and rows,
    highlighted;
  - the refused query shows the engine's reason with `KNOWN` underlined, where
    F2 showed the SDK's whole error string.

  Across the runs, three screens F3 does not touch each changed once, every
  time from capture timing:
  - the serving progress, taken three seconds into an installation, which
    flipped direction between runs;
  - the vector map's node labels, drawn late;
  - the vector map's scroll and zoom.

  A follow-up for the harness: those three screens should wait for a settled
  state or be classed as dynamic.

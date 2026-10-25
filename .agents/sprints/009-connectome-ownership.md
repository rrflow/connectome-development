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
| Connection, namespace and database pickers, node status | connect, sign in, select a namespace and database, server info | project, estate and instance; native session; capabilities, readiness, `estate-read` | yes | D0, D8 |
| Sandbox | in-browser engine on `mem://` | a scratch project estate served by the bundled sidecar (sprints 011 and 012) | yes | D1 |
| Mini runner and embed generator | in-browser engine inside an iframe | RRFlow's browser deployment (planned, not built) | no | D1 removes; rebuild later |
| Record-access sign-up and sign-in | vendor access methods | native API-key session; human login follows RRFlow's identity package | machine keys only | D1 removes |
| Users and access view | vendor users and access definitions | RRFlow principals, grants and credential revisions | no | D1 removes; rebuild later |
| GraphQL view (already unreachable) | vendor `/graphql` endpoint | RRFlow's GraphQL lowering (B-05), served by H-04 | no | D1 removes; rebuild later |
| Functions view and model upload | vendor functions and ML models | RRFlow governed functions and admitted model manifests | no | D1 removes; rebuild later |
| Parameters view | vendor global parameters | rrflowQL `$name` parameters bound per query; estate configuration owns lasting settings | yes | D4 (query variables) |
| 2.x to 3.0 migration view | vendor version migration | none needed; RRFlow backup and restore | yes | D1 removes; D7 |
| Query view | vendor query execution, live results, graph preview, formatting | `query-execute` with `EXPLAIN`, `traverse:` sources, `query-export`, live results through a native `/v1/ws` subscription | yes | D4 |
| Editor language, highlighting, linting, formatting | vendor CodeMirror and Lezer language and WASM parser | a Connectome rrflowQL language built from RRFlow's lexer (`rrd-query/src/syntax.rs`) and tested against RRFlow's `query-vectors.json`; the engine (`EXPLAIN CONTRACT`) validates, the client only highlights; no formatter | yes | D3 |
| Explorer, record inspector, data table, relation graph, map | vendor reads, creates, relates, updates and deletes; binary value types | `record:`, `relation:`, `geo:` and `traverse:` queries; transaction preview then commit with `PutRecord`, `PutRelation`, `PutGeo`, `RetireData`; one engine query per graph expansion | yes | D5 |
| Designer | vendor schema definitions and introspection | `data-schema-read`; next registry revision through `PutSchema` with preview; `query-index-ensure` | yes (instance-level grant) | D6 |
| Import and export | vendor statement import and export | `query-export` (Parquet), `backup-create`, `backup-list`, `restore-create`; typed record batches for import | yes, import as batches | D7 |
| Documentation topics | vendor client snippets | RRFlow SDK reference | — | D1 removes |
| Shared types and stores | vendor record identifiers, durations, decimals, geometry | RRFlow value model from the generated OpenAPI types | yes | D0 |

#### Ordered increments

Each increment is one pull request through the merge queue with `pnpm check`,
the production build, the render smoke, the native checks and the RRD
process tests, plus the tests named. RRFlow moves its `connectome/` pin after
each one lands.

- **D0: cut the RRFlow pages loose.** The runtime workbench, diagnostics and
  serving stop loading `connection.tsx`. Add the RRFlow value model; scope
  `useConnectionSwitch` to the inherited routes. Oracle: a module-graph test
  shows no RRFlow page reaches `src/vendor/`.
- **D1: remove the subjects RRFlow does not serve, and replace the Sandbox.**
  Remove the mini runner and embed, record-access sign-up, users and access,
  GraphQL, functions and model upload, the migration view and the
  documentation topics. The Sandbox becomes a scratch project estate on the
  sidecar. Removes `@surrealdb/wasm`.
- **D2: native surface.** Tauri commands over the existing `rrd-client`
  methods for transactions, query export, changefeed, `/v1/ws` subscriptions,
  backups and audit. The renderer gets opaque handles and never holds a
  credential. Oracle: the RRD process tests drive each command against a real
  engine, including restart and denial.
- **D3: rrflowQL language.** A CodeMirror language from RRFlow's token set
  (salvaged from PR #10), with golden tests against RRFlow's query vectors.
  It replaces highlighting everywhere and removes `@surrealdb/codemirror`,
  `@surrealdb/lezer`, `@surrealdb/ql-wasm-v2` and `@surrealdb/ql-wasm-v3`.
- **D4: Query lens.** Fold the editor, variables (which replace global
  parameters), result table and JSON, `EXPLAIN` plan, graph preview,
  Parquet export and live results into the workbench; delete the inherited
  query view.
- **D5: Records and graph lens.** Fold the explorer, inspector, data table,
  relation graph and map; edits go through preview then commit; delete the
  inherited explorer.
- **D6: Schema lens.** Fold the designer onto the schema registry and
  `PutSchema`; delete the inherited designer.
- **D7: Storage lens.** Backup, restore and Parquet export; typed import.
- **D8: final cut.** Delete the inherited `/c/:id/:view` routes,
  `connection.tsx`, `src/vendor/`, `surrealdb`, the vendor chunks and
  aliases in `vite.config.ts`, and the vendor fields of the connection model
  (with a configuration migration). The identity gate reaches zero and loses
  its `src/vendor/` exemption.

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
    the client and both WASM parsers: the mini runner and its embed
    generator are deleted here instead of in D1, because they sat on every
    page's load path (adapter, startup entry, `tools/mini-embed.html`, the
    screen, the `/mini/new` page, route, command, navigation entry, the
    `isMini` branches, the Vite entry and rename plugin, and the nginx
    routes, with the leftover cloud routes from Slice B);
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
  `SidekickChatMessage` types and `MiniAppearance`.
- Not in D0: the application shell still loads the inherited client at
  startup through the Designer and Inspector providers, two application
  modals, the inherited views and the inherited UI kit (Slice C2, PR #9).
  They leave with their lenses in D4 to D6 and in D8, where the startup entry
  joins this gate. D1 keeps the remaining removals and the Sandbox.
- Verification: `pnpm check` green (identity gate across 503 files with 7
  vendor dependencies on this `main`-based branch, isolation gate 9 entries,
  dependency authority, version contract, `tsc`); `pnpm build` green with no
  `mini/` output; `pnpm test:smoke` 4 passed. Native and RRD process checks
  run in CI.

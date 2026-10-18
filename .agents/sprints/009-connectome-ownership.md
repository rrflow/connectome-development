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


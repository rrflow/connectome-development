# Sprint 009 — Architecture boundary foundation

**Status**: IMPLEMENTED AND VERIFIED — uncommitted worktree, 2026-09-16  
**Source**: Parking Lot 004 (committed 1B / 2B / 3B / 4B / 5B / 6B / 7B),
Parking Lot 003 Decisions 1C/6B, and Parking Lot 005 Option B  
**Related**: Parking Lot 003 Decisions 2C/3C/4B/5B remain committed; their
diagnostics/build implementation is not part of this sprint  
**Priority**: P0  
**Audited base**: `38f68ce7adda9d03501f3591165f0e14996899ec`, with the
current Sprint 008 C0 worktree

## Goal

Declare one scalable dependency and naming model and add one deterministic gate
that prevents new boundary debt. Record RRFlow's UI as reference input for one
cohesive Connectome experience. Do not move product source yet.

## Start condition

Sprint 008 must be reviewed and committed first because it currently changes
`GOVERNANCE.md`, `package.json`, and CI. Refresh the line anchors below after
that commit; stop if their meaning changed.

**Execution note**: The operator subsequently instructed implementation against
the current reviewed C0 worktree. That direct instruction waived the commit
ordering precondition for local execution only. Nothing was committed or pushed.

## Non-regression contract

The smaller sprint does not discard any committed requirement. It changes only
delivery order. Sprint 009 must preserve:

- every C0 label, route, renderer-fixture distinction, and evidence disclaimer;
- all current production and native test behavior;
- package/Cargo dependencies, lockfiles, protocol models, and runtime source;
- all Git remotes and both repository targets; and
- every deferred requirement through the traceability table below.

The initial baseline is captured only after Sprint 008 is committed. Entries are
keyed by category plus repository-relative source/import signature—not mutable
line numbers or aggregate totals. A finding may disappear or decrease, but it
may not move, appear under a new path, or grow.

## In scope

- correct the active repository and architecture authority;
- state that RRFlow's workbench is reference input, never a second UI or source
  dependency;
- mark the four conflicting frontend governance files as superseded;
- add one concise architecture contract;
- baseline current boundary/cycle debt by exact signature;
- reject new debt and enforce zero-debt rules in future target directories; and
- run the new gate locally and in CI.

## Out of scope

- source moves or new empty architecture directories;
- runtime, UI, RRD, credential, database, vector, DataFusion, or multimodal work;
- diagnostics/events, build modes, release workflows, publishers, CODEOWNERS,
  contribution templates, or broad historical-document cleanup;
- package-manager migration or dependency changes; and
- treating the browser fixture as conformance.

## Requirement traceability

| Committed requirement | Delivery owner |
|---|---|
| Active module model, canonical structural names, import direction, debt gate | Sprint 009 |
| First vertical Runtime Overview slice | Package A1 / next implementation sprint |
| Strict TypeScript semantic flags and first target unit harness | Package A1 with the first real target modules |
| Thin native `main.rs` plus `lib.rs` composition seam | Package A2 |
| Feature-owned connection/profile state | Package A3 coordinated with Parking Lot 002 |
| Presentation primitives and app chrome | Package A4 |
| Unsupported-surface disposition and publisher/tooling cleanup | Package A5 |
| Canonical client event/error vocabulary and typed diagnostics | Parking Lot 003 E3/E4 |
| Release-derived diagnostic modes and build identity | Parking Lot 003 E2 |
| Generated RRD client, credentials, and causal tracing | C1/C2 prerequisite, then E5 |
| Layman-facing prompt/evidence trail | E6 after durable RRFlow evidence exists |

This table is an ordering contract. Removing an item requires a new parking-lot
decision; it cannot disappear because a sprint was made smaller.

## Task 1 — Establish the active boundary authority

**Priority**: P0  
**Boundary**: Governance

### `GOVERNANCE.md`

**Current anchors**: lines 13, 26, 41–43, and 117–125 currently say:

```md
| **Parent** | RRFlow engine repository (`apps/connectome` submodule) |
| **Connectome** | Separate Tauri desktop client, mounted as `apps/connectome` in RRFlow |

### Boundary Rule

Connectome must remain a separately buildable Windows/macOS/Linux application. The RRFlow repository owns it through a git submodule; Connectome communicates with deployed RRFlow instances through versioned protocols and capability negotiation. An embedded diagnostic page may exist in the engine, but it is not a replacement for Connectome.

## Terminology

This project uses **platform-aligned terminology**. See `docs/roadmap/clyffy/terminology-engine.md` for the full glossary and progressive disclosure system.
```

**Target**:

- identify `rrflow/connectome-development` as the private development repository
  and `rrflow/connectome` as an uncreated promotion target;
- state that Connectome is an independent Tauri desktop product consuming pinned
  RRFlow candidates and packaged generated RRD artifacts, never a submodule or
  sibling source dependency;
- declare the feature-oriented modular monolith and one layered Cargo package as
  the target;
- link `docs/reference/engineering/architecture.md` as the active boundary
  contract; and
- preserve the workflow protocol, acknowledged rules, false-positive registry,
  and C0 `.chat/` resolution.

**Rationale**: The root record must agree with the README and the committed
repository decision before any folder migration begins.

### Superseded frontend governance files

**Current anchors**:

```text
src/GOVERNANCE.md:9                    Phase 1 shell/shared/spokes migration
src/shared/GOVERNANCE.md:9-15          shared imports nothing outside shared
src/shell/GOVERNANCE.md:9-14           shell/hub and spoke isolation
src/spokes/rrflow/GOVERNANCE.md:9-24   implemented 80% RRFlow spoke
```

**Target**: Add this banner immediately below each title; preserve all historical
body text:

```md
> [!IMPORTANT]
> **Status: HISTORICAL — superseded 2026-09-16.** This records the inherited
> hub/spoke plan and is not an active import or ownership rule. The active
> contract is `docs/reference/engineering/architecture.md`.
```

**Rationale**: A developer opening the nearest governance file must not enforce
rules the current graph and approved target both contradict.

## Task 2 — Add the concise architecture contract

**Priority**: P0  
**Boundary**: Documentation

### `docs/reference/engineering/architecture.md`

**Current**: File and parent directory do not exist.

**Target contents**:

1. Authority order:
   generated RRFlow artifacts → active Connectome governance → executable gates
   → historical records.
2. Supported surfaces:
   Tauri desktop is the product; browser is a non-authoritative render/fixture
   harness; mini, Docker, Netlify, cloud, direct-browser database, and handwritten
   control/diagnostics remain unsupported pending separate disposition.
3. Product experience:
   one authored Connectome UI with senior-developer quality of life and
   progressive summary → detail → raw-evidence drill-down. RRFlow's
   `crates/connectome-ui` workbench and migration inventory are reference input,
   not copied/embedded code or a build/runtime dependency. Configuration writes
   must cross typed native/application boundaries and show the real result.
4. Frontend target, created only as real code moves:

   ```text
   entrypoints/   app/   features/   platform/
   contracts/     ui/    foundation/
   ```

5. Frontend direction:

   ```text
   entrypoints -> app -> feature public APIs
   feature UI -> application -> domain
   platform implementations -> application ports
   app/features/platform -> contracts + ui + foundation
   ```

6. Native target: one package with thin `main.rs`, composition in `lib.rs`, then
   `commands`, `application`, `adapters`, `contracts`, and `support`.
7. Rules: one change axis, one-way dependencies, feature-owned state, public
   feature APIs, generated artifacts read-only, effects behind ports, `.tsx`
   only for JSX, and separately named evidence levels.
8. Migration: exact shrinking current-source baseline plus zero exceptions in
   target code; migrate one vertical slice at a time beginning with Runtime
   Overview. The baseline is not a separate product, UI, or ownership tier.
9. Canonical structural naming:
   - directories and TypeScript filenames use lowercase kebab-case;
   - React components and exported types use PascalCase; functions and values
     use camelCase; Rust modules/functions use snake_case and types use PascalCase;
   - pure/domain/application/port files use `.ts`; `.tsx` is reserved for JSX;
   - every feature exposes only `public.ts`; no deep cross-feature imports;
   - consumer-owned interfaces use the `<Capability>Port` suffix and concrete
     platform implementations use `<Technology><Capability>Adapter`;
   - use cases use verb-noun names such as `load-runtime-overview.ts` /
     `loadRuntimeOverview`;
   - `Dto` is reserved for IPC or wire boundaries, and generated RRFlow names
     remain byte-for-byte unchanged;
   - do not create catch-all `utils`, `helpers`, `common`, `misc`, `manager`,
     `service`, global `types`, or global `constants` buckets; and
   - use `Connectome`, `RRFlow`, `RRD`, `rrflowDB`, `rrflowKV`, `rrflowQL`, and
     `DataFusion` consistently. Connectome never invents an `rrflow.*` operation.
10. Scale threshold: remain a modular monolith until a module has an independent
   reuse, release, security, ownership, or compilation boundary. Folder count
   alone never justifies a workspace package or Cargo crate.

**Rationale**: One short contract is sufficient. It must not duplicate the
parking-lot research or prescribe implementation code.

## Task 3 — Add one tested architecture gate

**Priority**: P0  
**Boundary**: Tooling

### `scripts/architecture/policy.json`

**Current**: File does not exist.

**Target**: Machine-readable schema version `1` containing only stable policy:
excluded paths, target roots, allowed layer edges, the cross-feature `public.ts`
rule, the Tauri adapter exception, canonical target path-name patterns, forbidden
catch-all names, and the `.ts`/`.tsx` content rule. Generated contract trees are
exempt from local filename rewriting and retain upstream names exactly. The
policy contains no current-debt exceptions.

### `scripts/architecture/analyze.mjs`

**Current**: File does not exist.

**Target**: A pure analyzer. Given normalized source records plus the policy, it
returns sorted findings without reading the filesystem, spawning processes,
printing, exiting, or updating a baseline. It owns import resolution,
classification, dependency-direction checks, feature-public checks, and target
path-name checks.

### `scripts/architecture/check.mjs`

**Current**: File does not exist.

**Target**: A thin CLI responsible only for filesystem collection, invoking
pinned Biome JSON diagnostics, loading policy/baseline, comparing findings, and
formatting the result. It must:

- use Node built-ins and the already installed TypeScript/Biome tooling;
- never read `.chat`, `.git`, dependencies, build outputs, or report folders;
- resolve static alias and relative imports deterministically;
- compare exact path/signature maxima, not only aggregate counts;
- characterize the current 287 baselined shared/shell boundary edges;
- consume Biome JSON for the current 106 `noImportCycles` and 245
  `noExplicitAny` diagnostics;
- characterize imports of `~/types`, `~/constants`, and `~/schemas`, plus direct
  `@tauri-apps/*` imports;
- enforce zero cycles and zero pre-boundary-source imports under future
  `entrypoints`, `app`, `features`, `platform`, `contracts`, `ui`, and
  `foundation` roots;
- allow Tauri imports only under `platform/tauri`;
- allow cross-feature imports only through the other feature's `public.ts`;
- enforce the canonical target directory/file names defined in `policy.json`;
- reject explicit `any`, catch-all module names, and `.tsx` without JSX in target
  code while leaving their inherited occurrences as exact shrinking debt;
- allow an entry to disappear or decrease, but reject a new signature or larger
  per-signature count; and
- support `--write-baseline` only for the reviewed initial capture. Default mode
  is read-only.

### `scripts/architecture/baseline.json`

**Current**: File does not exist.

**Target**: Deterministically generated, sorted per-signature maxima with schema
version `1`. It contains repository-relative paths only—no source text, absolute
paths, usernames, timestamps, environment data, or secrets.

### `scripts/architecture/analyze.test.mjs`

**Current**: File does not exist.

**Required tests**:

- accepts a removed or reduced baseline entry;
- rejects a new baselined edge and growth of an existing signature;
- rejects a target-to-pre-boundary-source import;
- rejects a target import cycle;
- rejects a cross-feature internal import but accepts `public.ts`;
- rejects Tauri imports outside `platform/tauri`;
- rejects noncanonical target paths and accepts the documented naming patterns;
- rejects target explicit `any`, forbidden catch-all names, and `.tsx` without JSX;
- preserves upstream filenames under generated contract roots;
- serializes the same fixture identically twice; and
- proves excluded directories, especially `.chat`, are never traversed.

Tests use only resolved temporary fixture directories and clean up only those
fixtures.

**Rationale**: Policy, pure analysis, baseline data, CLI effects, and tests
change for different reasons. Keeping them separate prevents the architecture
gate from becoming the next repository monolith. Structural naming belongs here;
diagnostic vocabulary, logging, file-size, typing, and publisher gates remain
separate work.

## Task 4 — Wire the gate without disturbing C0 evidence

**Priority**: P0  
**Boundary**: Package scripts and CI

### `package.json`

**Current anchor**: lines 17–21:

```json
"test:smoke": "playwright test tests/smoke",
"test:renderer-fixture": "playwright test tests/renderer-fixture",
"check": "biome check . && node scripts/check-retired-identities.mjs && node scripts/check-c0-truth-boundary.mjs && tsc --noEmit",
"check:identity": "node scripts/check-retired-identities.mjs",
"check:truth": "node scripts/check-c0-truth-boundary.mjs"
```

**Target**: Add:

```json
"test:architecture": "node --test scripts/architecture/*.test.mjs",
"check:architecture": "pnpm test:architecture && node scripts/architecture/check.mjs"
```

Prepend `pnpm check:architecture &&` to the existing `check` command. Preserve
all existing C0 and renderer-fixture commands, metadata, dependencies, and
lockfiles.

### `.github/workflows/connectome-ci.yml`

**Current anchor**: lines 37–41:

```yaml
      - name: Check frontend source
        run: pnpm check

      - name: Build frontend
        run: pnpm build
```

**Target**: Rename the first step to `Check architecture and frontend source`;
keep `run: pnpm check`. Do not change any C0 disclaimer, evidence lane, artifact
name, or native matrix.

**Rationale**: The aggregate local and CI gate stays simple while the dedicated
command remains available for diagnosis.

## Task 5 — Verify only the boundary foundation

Run and record:

```bash
pnpm check:architecture
pnpm check
pnpm build
pnpm test:smoke
pnpm test:renderer-fixture
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked
cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
git diff --check
git diff --exit-code -- pnpm-lock.yaml src-tauri/Cargo.lock
```

Also add temporary negative fixtures proving one new baselined edge, one
target-to-pre-boundary-source import, one target cycle, and one private
cross-feature import each fail.
Remove only the temporary fixture directory afterward.

Review `git diff --name-only` against this allowlist: root/nested governance,
`docs/reference/engineering/architecture.md`, `scripts/architecture/**`,
`package.json`, and `.github/workflows/connectome-ci.yml`. No `.ts`, `.tsx`,
`.rs`, route, style, fixture, or product configuration file may change.

## Definition of done

- one active architecture document replaces the false hub/spoke authority;
- the four nearest conflicting governance files are visibly historical;
- canonical target path, symbol, port, adapter, use-case, DTO, generated-name,
  and product-term conventions are explicit and enforced where mechanical;
- the current boundary and cycle debt is captured by exact shrinking signatures;
- future target code has zero-debt import rules from its first file;
- policy, pure analysis, baseline data, CLI effects, and tests are separate files;
- the gate has focused unit and negative-fixture evidence locally and in CI;
- C0 behavior, labels, tests, and evidence names are unchanged;
- no product source is moved, no dependency/lockfile changes, and no publisher,
  remote, repository, or official target is touched; and
- every deferred requirement remains assigned in the traceability table.

## Stop conditions

Stop and return to the parking lot if the gate requires source changes, unstable
line-number baselines, source-content snapshots, new dependencies, or exceptions
inside target directories. Stop if Sprint 008 is not committed or if its accepted
meaning differs from the anchors above.

## Verification report — 2026-09-16

- **Architecture**: PASS — 13 focused tests; zero target violations; 932
  current-source findings captured as exact shrinking signatures (287 boundary
  edges, 24 direct Tauri imports, 270 global-barrel imports, 245 explicit-any
  diagnostics, and 106 import-cycle diagnostics).
- **Baseline determinism**: PASS — regeneration retained SHA-256
  `b7410e0925eeb2a2ce05afe4f430c0099732ef5c8373e4f37ef2eb42b659ba3e`;
  no timestamp, host path, username, source body, or mutable line key is stored.
- **Biome and TypeScript**: PASS — `pnpm check` checked 576 files with no fixes;
  `tsc --noEmit`, identity, and C0 truth gates passed.
- **Frontend evidence**: PASS — production build, one production-render smoke
  test, and one mocked renderer-fixture test passed. The build retains its
  already documented vendor Wasm/externalization and bundle-size warnings; none
  was introduced or reclassified as conformance.
- **Native evidence**: PASS — Cargo formatting, locked all-target checking,
  five Rust tests, and Clippy with warnings denied passed.
- **Repository invariants**: PASS — `git diff --check` passed; `pnpm-lock.yaml`
  and `src-tauri/Cargo.lock` are unchanged; no dependency, remote, repository,
  publisher, or official promotion target changed.
- **Scope review**: Sprint 009 changed governance, active reference docs,
  architecture policy/analyzer/baseline/tests, package scripts, and one CI step
  label. Pre-existing Sprint 008 route/style/fixture changes remain visible in
  the same uncommitted worktree and were neither attributed to nor expanded by
  this sprint.
- **Product clarification**: Parking Lot 005 supersedes the separate-source-tier
  framing. Connectome has one authored UI; RRFlow revision
  `4513c68048955efd3a55f80be685ed0d60203a2d` was inspected read-only as a
  workflow/evidence reference. Sprint 010 carries the reference crosswalk and
  information-architecture work; Sprint 009 copied or embedded no RRFlow UI.

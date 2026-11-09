# Parking Lot 004 — Orthogonal repository boundaries and migration

**Status**: AMENDED BY PARKING LOT 005 — 1B / 2B / 3B / 4B / 5B / 6B / 7B remain committed  
**Date**: 2026-09-16  
**Source**: Operator request to review the existing Connectome checkout and
align it to strict, real-world code boundaries before further product work
**Committed**: 2026-09-16  
**Rationale**: The operator approved the feature-oriented modular-monolith
target, a single layered native package, executable clean-zone rules, and an
incremental vertical migration. Package A0 is combined with Parking Lot 003
Package E1; no source relocation or runtime change is authorized by this
decision alone.
**Initial transfer**: Sprint 009 implements Package A0 only. Packages A1–A6+
remain separately staged and require their own reviewed sprints.
**Terminology amendment**: Parking Lot 005 rejects a separate compatibility
layer, facade, application, or user experience. Existing source is the current
Connectome product and its exceptions are migration-baseline data. Unsupported
execution surfaces remain named pending-disposition inputs. Every occurrence
below is amended to that model.

## COSTAR profile

- **Context**: Connectome compiles and the C0 runtime bootstrap is honest, but
  most renderer code is inherited from a different product architecture. The
  partially migrated `shell/shared/spokes` layout is governed as if it were
  isolated while the actual import graph remains cyclic and cross-boundary.
  Desktop, browser, Docker, mini-embed, cloud, direct database, client-authored
  diagnostics/control-plane, and RRD paths coexist without an authoritative
  product-surface decision.
- **Objective**: Define a directory and dependency model in which every module
  has one reason to change, effects cross explicit ports, product features own
  their state, generated contracts have one location, renderer/native authority
  is unmistakable, and architecture rules can be checked mechanically.
- **Style**: Feature-oriented modular monolith, dependency inversion at effect
  boundaries, explicit public module APIs, no catch-all `utils` or global type
  barrel, and incremental strangler migration. Create structure only when real
  code moves into it; do not manufacture an empty architecture tree.
- **Tone**: Strict but evidence-driven. Existing debt is characterized and
  ratcheted rather than hidden by a mass rename or punished with thousands of
  unrelated cleanup edits.
- **Audience**: Current operators and maintainers, future senior and junior
  developers, reviewers, and agents that need unambiguous ownership and import
  rules.
- **Response**: Commit one choice for each of the seven decisions below. Then
  author only Package A0 against refreshed source. This item performs no source
  moves, dependency additions, deletions, or runtime changes.

## Verdict

The current checkout is buildable but not structurally clean or orthogonal.
Folder names describe an intended architecture that the code does not yet
implement.

The next step should be an architecture-characterization and enforcement
package, not a source relocation package. The repository first needs:

1. one supported-surface decision;
2. one target dependency graph;
3. a machine-readable baseline of inherited exceptions;
4. a rule that all new modules satisfy the target immediately; and
5. one real vertical slice migrated end to end before any broad directory move.

The existing C0 `RuntimeConnectionPage` is the best first slice because it is
small, tested at the renderer boundary, and already distinguishes public
bootstrap evidence from authenticated product state. The inherited query,
cloud, and diagnostic surfaces should not define the target architecture.

## Audit method and measured baseline

The audit read the active governance, entrypoints, build/release files,
TypeScript and Rust module roots, all static internal imports, current test
entrypoints, and the two new RRD-facing code paths. It intentionally did not
inspect ignored local `.chat` content.

Current measured baseline:

| Measure | Current result | Meaning |
|---|---:|---|
| TypeScript/TSX source | 545 files / 75,274 lines | Large inherited renderer monolith. |
| Rust source | 15 files / 2,122 lines | Small enough to enforce module boundaries without a workspace split. |
| Renderer files under `screens` | 214 TS/TSX files | Routing, UI, business operations, query execution, and feature state are colocated. |
| Current `spokes` implementation | 0 TS/TSX files | The governed spoke boundary is an empty scaffold. |
| Static imports violating current `shared`/`shell` rules | 287 edges | Governance does not describe executable reality. |
| Biome `noImportCycles` diagnostics | 106 warnings | Six strongly connected file groups were found; the largest spans 25 files. |
| Biome `noExplicitAny` diagnostics | 245 warnings | Type strictness cannot safely be switched on repository-wide in one patch. |
| `.tsx` files containing no JSX | 152 of 506 | File extensions do not reliably identify UI versus pure/application code. |
| Files importing global `~/types` | 216 | One 1,152-line type barrel couples unrelated domains. |
| TS/TSX files at least 400 lines | 34 | Several modules carry multiple responsibilities. |
| TS/TSX files at least 700 lines | 8 | Large change surfaces include config/import/query/router UI. |
| Direct `@tauri-apps/*` consumers | 12 TS/TSX files | Native effects are not confined to one platform adapter boundary. |
| TypeScript unit test files | 0 | Pure/application behavior has no fast isolated test seam. |
| Playwright specifications | 2 | Current renderer smoke and mocked fixture evidence only. |
| Rust test functions | 5 | Native transport characterization exists but most boundaries lack unit tests. |

The import counts came from a read-only resolver over alias and relative
TypeScript imports. Biome's own project scanner independently confirmed the
cycle problem:

```text
pnpm exec biome lint --only=lint/suspicious/noImportCycles src
Checked 556 files ... Found 106 warnings.
```

These counts are a characterization baseline, not quality scores. Package A0
must reproduce them with a checked-in deterministic gate before they become
acceptance numbers.

## What must be decided

Seven connected choices control the target:

1. which renderer/build surfaces are supported products;
2. whether to finish the existing hub/spoke design or adopt vertical features;
3. how the Tauri/Rust half is partitioned;
4. how import direction and debt are enforced;
5. where application state and cross-feature coordination live;
6. how source is migrated without a destabilizing rewrite; and
7. how strict typing and tests converge with the new boundaries.

## Where the structure currently breaks down

### 1. Governance describes boundaries that do not exist

`src/GOVERNANCE.md:7-35` says Phase 1 restructures into `shell`, `shared`, and
`spokes`, and says all source imports should use `~/` aliases.

`src/shared/GOVERNANCE.md:7-15` says shared code imports nothing outside
`src/shared`, while the current graph contains imports from `shared` into root
types, adapters, stores, shell, screens, vendor code, components, hooks, and
editor modules. Examples include:

```ts
// src/shared/util/config.tsx:5-8
import { adapter } from "~/adapter";
import { DesktopAdapter } from "~/adapter/desktop";
import { useConfigStore } from "~/shell/stores/config";
import type { ConnectomeConfig } from "~/types";
```

`src/shell/GOVERNANCE.md:7-14` says the shell imports only shared foundations
and does not import spoke internals. The current shell has 89 imports into
global hooks, 66 into global components, 23 into root barrels, 16 into
adapters, and additional imports into providers, screens, cloud, stores,
vendor, and modals.

`src/spokes/rrflow/GOVERNANCE.md:7-24` claims the spoke contains 80% of the
earlier product, exposes `Root.tsx`, and executes a direct `rrflow_query` IPC
command. In reality the directory contains only that governance file. The
direct-query ownership also conflicts with the generated public RRD boundary
recorded in `README.md:70-73,92-104` and Parking Lots 002–003.

`src/stores/GOVERNANCE.md:7-44` proposes a shared Zustand store for cross-spoke
coordination. That permits feature internals to become a global integration
bus and conflicts with strict feature ownership.

The structure came from `.agents/sprints/003-architecture-scaffolding.md` and
`.agents/sprints/004-core-shell-migration.md`, which were based on the now
superseded Cortex/Clyffy hub-and-spokes roadmap. This new parking-lot item is
required to reverse or refine that committed direction rather than silently
editing its governance.

### 2. The current graph is cyclic, not layered

The largest strongly connected component contains 25 files across:

- `adapter` implementations and selector;
- cloud API endpoint selection;
- connection and RRD compatibility code;
- config/default/error/message/schema helpers;
- shell config state; and
- database state.

Biome shows the cycle directly at `src/adapter/desktop.tsx:14-27`: the desktop
adapter imports shared/config/store modules which eventually import the adapter
selector again. `src/adapter/mini.tsx:4-16` imports screen-level query execution,
shared defaults/messages, and the vendor database client, while the connection
screen imports the selected adapter.

Five more cycle groups cover database selection hooks/modals, inspector
components/providers, designer graph nodes, monitoring metrics, and cloud auth
onboarding. Moving any one directory preserves or worsens those cycles unless
the dependency seam is changed first.

### 3. Composition, navigation, and feature internals are fused

`src/startup/connectome.tsx:15-55` performs environment adapter selection side
effects, config synchronization, editor initialization, app mounting, and asset
preloading in one entrypoint.

`src/shell/components/App/index.tsx:1-53` is nominally the shell, but statically
imports global components, feature providers, the full screen router, business
modals, data import/export, database table creation, registration, a console,
and updater behavior.

`src/screens/connectome/index.tsx:1-242` owns window chrome, global layout,
sidebar state, routing, profile redirects, eleven inherited feature views, the
new runtime page, client-owned diagnostics, and client-owned control plane.
There is no feature public API: the router imports concrete internals directly.

The result is a “horizontal technical folders” layout where a single feature
change routinely crosses `screens`, `hooks`, `providers`, `components`,
`shared`, `stores`, and `adapter`.

### 4. Catch-all roots erase domain ownership

`src/types.tsx:6-1144` contains UI preferences, connections, query responses,
database schema, cloud billing, Intercom support, observer metrics, migrations,
and Tauri menu types. It is imported by 216 source files.

`src/constants.tsx:83-539` combines history limits, feature values, cloud roles,
themes, result modes, pages, database drivers, schema/designer options, file
filters, region flags, icons, monitors, and support states. It is imported by 51
files.

`src/shared/util/` contains 40 broadly named modules, but many are application
services or UI effects rather than leaf utilities. For example:

- `config.tsx` calls platform adapters and shell stores;
- `connection.tsx` calls adapters and shell state;
- `databases.tsx` invokes screen-owned query execution;
- `errors.tsx` opens a React modal and external URL;
- `helpers.tsx` imports adapters, components, screens, and product types; and
- `schema.tsx` executes live queries and mutates database state.

The name `shared` currently means “widely depended on,” not “independent.”

### 5. Platform effects escape the platform boundary

Twelve renderer files import Tauri packages directly. Six invoke native
commands directly. Calls appear in adapters, hooks, providers, new RRFlow
clients, shared config/downgrade utilities, titlebar, menus, and shell stores.

`src/adapter/base.tsx:8-135` is not a narrow platform port. It combines window
behavior, config persistence, local database lifecycle, files, logging,
analytics, update support, product feature flags, and debug output. Each
implementation therefore knows application features and participates in
cycles.

The desired rule is the inverse: use cases own small port interfaces; platform
modules implement those ports; the application composition root selects the
implementations.

### 6. Supported renderer surfaces are unresolved

`README.md:3-12,92-104` defines Connectome as an independent native Tauri
client. The repository still contains four environment adapters and multiple
delivery paths:

- `src/adapter/index.tsx:1-33` selects desktop, Docker, mini, or browser at
  runtime;
- `tools/mini-embed.html:12-31` and `src/startup/mini-embed.tsx:1-48` create a
  second application entrypoint;
- `src/adapter/mini.tsx:1-229` creates an in-browser database/query runtime;
- `src/adapter/docker.tsx:1-119`, `docker/Dockerfile:1-38`, and
  `.github/workflows/docker.yml:1-38` maintain a static Docker product;
- `netlify.toml:1-8` and `netlify.sh:1-15` maintain a Netlify/cloud callback
  build; and
- `src/cloud/` contains 50 TS/TSX files, including tokens persisted in browser
  storage at `src/cloud/api/auth.tsx:74-220`.

The browser renderer is valuable for current Playwright smoke/fixture tests,
but that does not automatically make it a supported network-capable product.
This distinction must be explicit before the platform interface can shrink.

### 7. Active and latent features are mixed

A static reachability pass from both renderer entrypoints found 100 of 545
TypeScript files unreachable from either entrypoint. They still compile because
`tsconfig.json:23` includes all of `src`. The unreachable set contains cloud
organization/deployment/support flows, dormant components, old documentation,
`rrflow/attunement.ts`, and shell cloud/intercom/newsfeed modals.

Unreachable does not mean safe to delete: dynamic registries, unfinished work,
and future contracts require individual evidence. It does mean these files
must not silently define the new architecture.

`src/rrflow/` also mixes four authority levels:

- `runtime.ts` — C0 public bootstrap plus an unwired handwritten authenticated
  client;
- `diagnostics.ts` — client-authored Vyrm flight/prompt/reasoning models;
- `control-plane.ts` — renderer-held bearer token and client-authored protocol;
  and
- `attunement.ts` — static lifecycle phases, currently unreachable.

Parking Lots 002–003 and `README.md:30-42` already state that these client-owned
models are not RRFlow authority. A directory named `rrflow` cannot make them
canonical.

### 8. Native commands mix transport, application, and infrastructure

`src-tauri/src/main.rs:7-154` is simultaneously the binary entrypoint,
composition root, plugin configuration, logging configuration, state registry,
command registry, startup workflow, global handle owner, event handler, and
process cleanup owner. There is no `src-tauri/src/lib.rs`, although Tauri's
current project structure uses a thin desktop `main.rs` calling a library
`run()` composition function.

Native modules commonly expose Tauri commands directly over infrastructure:

- `config.rs:11-76` mixes JSON parsing, filesystem writes, backup policy, Tauri
  commands, and panicking error handling;
- `rrd.rs:14-111` mixes managed session state, Tauri commands, HTTP transport,
  response bounds, JSON parsing, and public error strings;
- `diagnostics.rs:9-79` duplicates HTTP/bounds/JSON behavior behind another
  generic `Value` command;
- `database/mod.rs:13-212` mixes command DTOs, child-process lifecycle,
  credentials, renderer events, shell construction, raw process output, and an
  `--allow-all` launch; and
- `open.rs:14-169` mixes OS-open parsing, state, canonical paths, a persisted
  whitelist, dialogs, filesystem IO, and renderer events.

This is still small enough for one Rust package. Splitting into multiple crates
now would add package APIs without first establishing internal module APIs.

### 9. Root tooling has more than one authority

`package.json:13-30,156-159`, `README.md:108-128`, and current CI use pnpm
11.24. `Makefile:20-30`, `netlify.sh:15`, `docker/Dockerfile:1-14`,
`REVIEW.md:12-14`, and the tracked `bun.lock` still use Bun. The Makefile also
contains direct S3 deployment targets at `Makefile:32-48`, while the corrected
repository boundary has no approved publishing target.

`.github/CODEOWNERS:1-5` still assigns an inherited external owner and a stale
path. `CONTRIBUTING.md:17` links a personal repository. These are authority and
release-boundary problems, not harmless formatting debt.

### 10. Tests do not mirror architectural layers

Current automated evidence is intentionally limited to:

- `tests/smoke/overview.spec.ts` — production renderer bundle, no RRD transport;
- `tests/renderer-fixture/runtime-bootstrap.spec.ts` — mocked public bootstrap;
  and
- five native test functions in RRD/diagnostic transport modules.

There is no TypeScript unit runner or test file for pure parsers, state
transitions, use cases, error mapping, redaction, or boundary wiring. A folder
move can remain green while dependency direction and domain behavior regress.

## Orthogonality rules for the target

The target is not “more folders.” It satisfies these rules:

1. **One change axis**: a module changes for one product capability or one
   infrastructure concern, not because it is a generic helper bucket.
2. **One-way dependencies**: imports follow a declared directed graph. Cycles
   are defects in new code.
3. **Effects behind consumer-owned ports**: network, IPC, filesystem, clock,
   IDs, persistence, update, and telemetry implementations sit outside the use
   cases that consume them.
4. **Feature-owned state**: feature state stays with the feature. App state is
   limited to composition/navigation/window concerns. A global store is not a
   cross-feature service locator.
5. **Public APIs only**: another feature or the app imports a feature through a
   small explicit `public.ts`, never an internal component/store path.
6. **Generated means read-only**: generated RRD contracts are isolated,
   identified, and replaced only by the generator/package. Local view models
   never masquerade as generated wire models.
7. **UI is not authority**: components render application state and dispatch
   typed intents; they do not create protocol truth, credentials, filesystem
   grants, or receipts.
8. **The migration baseline is explicit**: existing code remains part of the
   one product, but new target features cannot add arbitrary imports into
   pre-boundary internals.
9. **Naming reveals runtime**: `.tsx` means the file contains JSX; pure models,
   services, schemas, stores, and ports use `.ts`; Rust command modules are
   adapters, not use-case owners.
10. **Tests follow evidence level**: pure/unit, contract, native integration,
    renderer fixture, and installed-process conformance are separately named.

## Recommended frontend target

The exact folders are created only when their first real module is migrated.
The target topology is:

```text
src/
├── entrypoints/               # minimal mount files only
├── app/                       # composition, routing, global chrome
├── features/
│   ├── runtime-overview/      # first clean vertical slice
│   │   ├── domain/            # pure states/evidence rules
│   │   ├── application/       # use cases + consumer-owned ports
│   │   ├── ui/                # React projection
│   │   └── public.ts          # only external import surface
│   ├── connection-profiles/
│   ├── configuration-access/
│   └── evidence-trail/
├── platform/
│   ├── tauri/                 # invoke/window/dialog/update implementations
│   └── browser-test/          # explicit fixture/preview implementations
├── contracts/
│   ├── generated/             # pinned generated artifacts; never hand edited
│   └── connectome-ipc/        # typed client/native DTO boundary
├── ui/
│   ├── primitives/            # presentation-only reusable components
│   └── theme/                 # tokens/styles/assets
└── foundation/                # proven pure cross-feature values only
```

`foundation` is not a renamed `shared/util`. A module enters it only after it
is pure, has at least two real feature consumers, and needs no React, browser,
Tauri, store, network, or feature import.

The dependency direction is:

```text
entrypoints -> app -> feature public APIs
                    |       |
                    |       +-> feature UI -> application -> domain
                    |
                    +-> platform implementations --implements--> application ports

feature/application -> contracts/generated (through typed adapters where required)
app/features/platform -> ui + foundation
new target modules -X-> arbitrary pre-boundary internals
```

A migration moves one complete vertical behavior into the target. It does not
create a catch-all compatibility facade or let target features import current
screen/store internals directly.

## Recommended native target

Keep one Cargo package until a module has an independently useful API,
independent tests, or a real reuse/release boundary:

```text
src-tauri/src/
├── main.rs                    # desktop entrypoint; calls connectome_lib::run()
├── lib.rs                     # Tauri composition root and command registration
├── commands/                  # typed IPC adapters only
├── application/              # native use cases and consumer-owned ports
├── adapters/
│   ├── rrd/                   # packaged generated client integration
│   ├── config/                # atomic local presentation-state persistence
│   ├── filesystem/            # bounded grants and file operations
│   ├── process/               # installed-runtime lifecycle, if authorized
│   └── diagnostics/           # structured local diagnostic projection
├── contracts/
│   ├── generated/             # packaged/generated RRFlow inputs
│   └── ipc/                   # serializable non-secret command DTOs
└── support/                   # narrow platform helpers; no application policy
```

Commands deserialize/validate IPC, call one use case, and map one typed error.
They do not build HTTP clients, parse arbitrary JSON, choose paths, or manage
child-process policy. Port traits live beside the consuming application use
case, not in a global interface warehouse. `lib.rs` wires implementations;
libraries never install global diagnostics or reach for a global app handle.

## Decision 1 — supported execution surfaces

### Option A — desktop, browser, Docker, and mini as equal products

- **Description**: Preserve all current entrypoints/adapters and make every
  feature work across all four environments.
- **Pros**: Retains inherited distribution flexibility and embedded query use.
- **Cons**: Forces lowest-common-denominator APIs, keeps browser credential and
  storage paths alive, multiplies testing/security matrices, and conflicts with
  the native credential/grant boundary.
- **Impact**: Every application port requires multiple production adapters;
  cloud/Netlify/Docker publishing needs renewed ownership.
- **Effort**: Very large and ongoing.

### Option B — desktop product, browser test harness, unsupported surfaces retained pending disposition (recommended)

- **Description**: Connectome is a Windows/macOS/Linux Tauri product. Browser
  execution exists only as an explicitly non-conformant renderer smoke/fixture
  harness. Docker, Netlify, mini-embed, inherited cloud, and direct browser
  database execution are retained but unsupported pending a separate product
  decision.
- **Pros**: Matches the README and secure native handoff, sharply reduces effect
  surfaces, preserves fast Playwright rendering, and avoids premature deletion.
- **Cons**: Inherited web/mini consumers stop receiving features; quarantine
  must be clearly labelled and gated.
- **Impact**: Platform contracts can be native-first; browser-test adapters are
  guaranteed non-authoritative.
- **Effort**: Medium foundation, then shrinking migration.

### Option C — desktop only; delete all other surfaces immediately

- **Description**: Remove browser, Docker, mini, cloud, Netlify, and associated
  source in one cleanup.
- **Pros**: Smallest final tree and security surface.
- **Cons**: Reachability is not proof of safe deletion, current Playwright
  harnesses depend on browser rendering, and unfinished/imported behavior may
  be lost without characterization.
- **Impact**: Large destructive change and test redesign.
- **Effort**: Large, high risk.

## Decision 2 — frontend module model

### Option A — complete the existing shell/shared/spokes migration

- **Description**: Move inherited screens/components/hooks/stores into the
  existing hub and RRFlow spoke until governance matches the tree.
- **Pros**: Reuses prior work and familiar terminology.
- **Cons**: A single RRFlow spoke would still contain most of the product;
  `shared` remains a likely dumping ground; shared-store cross-spoke messaging
  preserves coupling; the model comes from superseded product plans.
- **Impact**: Many file moves with weak feature-level ownership.
- **Effort**: Large.

### Option B — feature-oriented modular monolith with ports/adapters (recommended)

- **Description**: Use `app`, vertical `features`, `platform`, `contracts`,
  presentation-only `ui`, and proven-pure `foundation`.
  Each feature exposes one public API and owns domain/application/UI code.
- **Pros**: Change locality, enforceable dependency direction, feature-owned
  state, easy vertical tests, and a clear path to generated RRD contracts.
- **Cons**: Requires superseding the current spoke governance and careful
  incremental facades around inherited code.
- **Impact**: New code adopts the target immediately; old horizontal folders
  shrink slice by slice.
- **Effort**: Medium foundation, large incremental migration.

### Option C — split renderer features into workspace packages now

- **Description**: Create independent pnpm/TypeScript packages for app, UI,
  contracts, platform, and each feature.
- **Pros**: Strong package exports and compiler-visible APIs; potentially
  smaller builds.
- **Cons**: Adds manifests, build outputs, versioning, Vite resolution, and test
  orchestration before internal seams exist; cycles become package cycles.
- **Impact**: Repository becomes a monorepo during active product convergence.
- **Effort**: Very large.

## Decision 3 — native module model

### Option A — retain command-per-file modules under `main.rs`

- **Description**: Continue adding Tauri commands beside their transport and IO
  implementations.
- **Pros**: Minimal movement and easy command discovery.
- **Cons**: Preserves string errors, global state, duplicated HTTP behavior,
  panics, and command/infrastructure coupling.
- **Impact**: Every new feature enlarges the native composition file and IPC
  authority.
- **Effort**: Small now, high maintenance cost.

### Option B — one package, thin binary, library composition, internal layers (recommended)

- **Description**: Add Tauri's standard thin `main.rs`/`lib.rs` split; keep one
  Cargo package; separate typed commands, application use cases, generated/IPC
  contracts, and infrastructure adapters with Rust privacy enforcing internals.
- **Pros**: Strong seams without package overhead, testable use cases, mobile-
  compatible Tauri shape, and a clear future crate-extraction threshold.
- **Cons**: Requires careful state/error migration and temporary adapters around
  current commands.
- **Impact**: Native code becomes an application boundary instead of a bag of
  privileged commands.
- **Effort**: Medium, incremental.

### Option C — create a Cargo workspace with multiple crates now

- **Description**: Split IPC, application, platform, RRD, and diagnostics into
  workspace crates immediately.
- **Pros**: Compiler-enforced crate APIs and independent test units.
- **Cons**: Premature public APIs, more manifests/features, longer builds, and
  generated-client packaging is still unresolved.
- **Impact**: Significant build/release complexity.
- **Effort**: Large.

## Decision 4 — dependency enforcement

### Option A — governance and review only

- **Description**: Update documents and rely on reviewers to maintain import
  direction.
- **Pros**: No tooling work or baseline exceptions.
- **Cons**: This is the current approach and already permits 287 contradictory
  edges and 106 cycle diagnostics.
- **Impact**: Boundaries remain aspirational.
- **Effort**: Small, ineffective.

### Option B — baseline ratchet plus strict clean-zone rules (recommended)

- **Description**: Check in a deterministic architecture inventory. Existing
  boundary edges/cycles receive exact shrinking baseline entries. New target
  zones use Biome import restrictions/no-cycle checks plus a repository script
  for allowed direction and public API imports. CI rejects new exceptions.
- **Pros**: Immediate no-new-debt rule, small reviewable migrations, measurable
  progress, and no new architecture dependency required.
- **Cons**: Baselined exceptions remain temporarily and the custom gate needs unit
  fixtures to avoid false confidence.
- **Impact**: Makes governance executable from Package A0 onward.
- **Effort**: Medium.

### Option C — enable zero-tolerance repository-wide rules immediately

- **Description**: Turn every cycle/restricted-import/strictness warning into an
  error and repair all failures before feature work.
- **Pros**: Clean result if completed.
- **Cons**: Hundreds of coupled edits, poor review locality, likely behavior
  changes, and no prioritization by product risk.
- **Impact**: Freezes product work for a broad refactor.
- **Effort**: Very large and high risk.

## Decision 5 — state and cross-feature coordination

### Option A — shared global Zustand stores

- **Description**: Move stores into `shared/stores` and let features coordinate
  by reading/writing them.
- **Pros**: Familiar and quick for UI development.
- **Cons**: State shape becomes an implicit API, cross-feature dependencies are
  invisible, tests require global setup, and sensitive/session data can leak
  into renderer-global state.
- **Impact**: Recreates current coupling inside a cleaner folder name.
- **Effort**: Small initially.

### Option B — feature-owned state and typed application interactions (recommended)

- **Description**: Each feature owns its view/application state. App state is
  limited to navigation, window chrome, theme, and composition. Cross-feature
  work calls a typed use case or dispatches a closed application event; native
  connection/credential state remains native and renderer references are
  opaque.
- **Pros**: Explicit ownership, isolated tests, smaller rerender surfaces, and
  safe credential/session boundaries.
- **Cons**: Requires extracting selectors/use cases from current stores and
  designing a small event vocabulary.
- **Impact**: Zustand may remain as an implementation detail, not architecture.
- **Effort**: Medium per slice.

### Option C — replace state management globally

- **Description**: Introduce a new state/event framework and rewrite current
  stores.
- **Pros**: Opportunity for uniform APIs.
- **Cons**: New dependency and migration risk without solving ownership by
  itself.
- **Impact**: Sweeping renderer rewrite.
- **Effort**: Large; no current evidence justifies it.

## Decision 6 — migration strategy

### Option A — mass directory move and import rewrite

- **Description**: Create the target tree, move all files by category, and fix
  imports until the build passes.
- **Pros**: Rapid visual conformity.
- **Cons**: Cycles and mixed responsibilities survive under new paths; Git
  history/review become noisy; green compilation does not prove behavior.
- **Impact**: High-regression refactor with weak architectural gain.
- **Effort**: Very large.

### Option B — vertical strangler beginning with runtime overview (recommended)

- **Description**: Freeze growth in baselined imports, create the minimum target folders for
  one feature, define its ports/public API, wrap existing transport temporarily,
  preserve behavior/tests, then repeat by product priority.
- **Pros**: Proves the model on real code, produces small reversible diffs, and
  aligns structure with actual RRFlow delivery order.
- **Cons**: Old and new structures coexist for a while; compatibility facades
  need explicit deletion criteria.
- **Impact**: `RuntimeConnectionPage` becomes the reference slice; inherited
  screens remain operational but cannot be copied into new features.
- **Effort**: Medium per slice.

### Option C — clean horizontal layers one at a time

- **Description**: First fix all components, then hooks, then stores, then
  screens.
- **Pros**: Repetitive work can be batched.
- **Cons**: Each layer serves many features, so intermediate states remain
  coupled and changes cannot be validated as complete product behavior.
- **Impact**: Long-running refactor branches and broad regressions.
- **Effort**: Large.

## Decision 7 — typing and test convergence

### Option A — enable every strict flag and lint rule immediately

- **Description**: Turn `noExplicitAny`, `noImportCycles`, additional TypeScript
  safety flags, and all unused checks into repository-wide errors now.
- **Pros**: Maximum nominal strictness.
- **Cons**: At least 351 known cycle/`any` warnings plus optional/indexed-access
  fallout; encourages casts and suppressions just to regain green CI.
- **Impact**: Obscures architectural work under mechanical churn.
- **Effort**: Very large.

### Option B — strict new zones, shrinking migration baselines, layered tests (recommended)

- **Description**: New target modules enable no explicit `any`, no cycles,
  consumer-safe indexed/optional/error handling, and `.ts` unless JSX exists.
  Existing debt is ratcheted and removed when touched. Add a pinned unit runner
  only through an approved dependency change; organize evidence as pure unit,
  contract, native integration, renderer fixture, and installed conformance.
- **Pros**: Strong guarantees where new architecture begins, honest incremental
  progress, and tests aligned to boundaries.
- **Cons**: Two temporary strictness levels and baseline maintenance.
- **Impact**: Every migrated slice must leave its old exceptions behind.
- **Effort**: Medium foundation, ongoing per slice.

### Option C — keep current type/test policy until migration completes

- **Description**: Rely on existing `strict`, Biome recommendations, Playwright,
  and Rust tests during the restructure.
- **Pros**: No immediate test-tool work.
- **Cons**: Boundaries can regress without fast tests; explicit `any`, cycles,
  and incorrect file types continue growing.
- **Impact**: Migration completion becomes unverifiable.
- **Effort**: Small now, high later.

## Recommended decision stack

Commit **1B / 2B / 3B / 4B / 5B / 6B / 7B**.

This yields:

- one desktop product and one explicitly non-authoritative browser test harness;
- a feature-oriented modular monolith rather than a hub/spoke megamodule;
- one well-layered native Cargo package rather than premature crates;
- executable architecture rules with shrinking baseline exceptions;
- feature-owned state and typed coordination;
- vertical strangler migration starting from honest C0 code; and
- strict new code plus evidence-layered tests.

## Proposed implementation sequence after commitment

These are package boundaries, not sprint tasks. Exact files and current code
must be refreshed before each sprint is authored.

### Package A0 — active architecture contract and ratchets

**Goal**: Make the target and current debt mechanically visible without moving
runtime source.

**Scope**:

- supersede stale shell/shared/spoke governance with one active dependency
  contract and clear historical markers;
- classify every current top-level directory as target, compatibility,
  generated, test-only, or pending decision;
- establish desktop as product and browser as renderer-test evidence; mark
  mini/Docker/Netlify/cloud/direct-browser database surfaces retained rather than
  deleting them;
- make pnpm the only active package-manager authority and classify Bun paths as
  unsupported pending surface disposition;
- add a deterministic architecture check with exact baseline entries for
  forbidden edges, cycles, global barrels, direct Tauri imports, raw console,
  `.tsx` without JSX, and size thresholds;
- apply strict clean-zone rules only to target directories;
- correct CODEOWNERS/contribution/review authority without configuring a new
  publisher; and
- keep all C0 evidence names and lanes unchanged.

**Acceptance**:

- running one documented command reproduces the checked-in dependency counts;
- adding a new forbidden edge, cycle, direct Tauri import, global type-barrel
  import, raw console call, explicit `any`, or non-JSX `.tsx` in a target zone
  fails CI;
- existing debt is not reformatted, moved, or deleted;
- no runtime, route, wire, config, or capability behavior changes; and
- current frontend/native/C0 verification remains green.

This package overlaps the authority/ratchet foundation in Parking Lot 003
Package E1. If both parking-lot items are committed, author one combined
foundation sprint with one goal instead of two competing governance sprints.

### Package A1 — first clean vertical slice: runtime overview

**Goal**: Prove the target feature/application/platform/UI boundaries using the
current honest public-bootstrap behavior.

**Constraints**:

- preserve the exact C0 labels and evidence standing;
- do not expand the handwritten authenticated client;
- do not duplicate RRD wire models into a new canonical location;
- define a temporary public-bootstrap port whose transitional adapter wraps
  current code and has an explicit C1 deletion condition;
- expose the feature only through `public.ts`;
- inject effects at app composition; feature UI imports no Tauri APIs; and
- retain both production-render smoke and mocked renderer-fixture evidence.

### Package A2 — native composition seam

**Goal**: Introduce a thin binary/library composition root and typed command
adapters without changing native behavior.

**Constraints**:

- `main.rs` calls `run()` and contains no feature policy;
- command registration and plugin/state composition live in `lib.rs`;
- one existing command family is wrapped at a time;
- use-case logic returns a typed internal error before IPC projection;
- global app handle access does not enter new modules; and
- do not create a Cargo workspace or add dependencies merely for folder shape.

### Package A3 — connection-profile ownership

**Goal**: Separate non-secret renderer presentation profiles from native
connection/session authority.

This package coordinates with Parking Lot 002 and C1/C2. It cannot complete
secure connection ownership before the packaged generated client and installed
credential handoff exist.

### Package A4 — presentation primitives and app chrome

**Goal**: Triage components by actual ownership.

- presentation-only, multi-feature primitives move to `ui` only after their
  imports are pure;
- app chrome stays in `app`;
- feature-aware components move with their feature;
- no component enters `ui` while importing a store, adapter, screen, protocol
  client, network API, or feature model; and
- CSS/assets follow the owning component/theme rather than a generic asset
  warehouse.

### Package A5 — unsupported-surface disposition

**Goal**: Put explicit facades and freeze gates around inherited direct database,
cloud, mini, Docker, Netlify, client-owned diagnostics/control-plane, and static
attunement behavior.

Quarantine does not mean deletion or endorsement. Each surface receives an
owner/status, reachability evidence, supported-entrypoint decision, dependency
inventory, and separate removal/replacement package.

### Package A6+ — capability-by-capability convergence

Migrate only when a real generated operation and test boundary exist, in the
product order already proposed by Parking Lot 002:

1. Overview & Connection;
2. Configuration & Access;
3. Data & Query;
4. Retrieval;
5. Prompt Trail & Evidence;
6. Media & Adapters; and
7. Operations & Audit.

Each completed feature removes its corresponding boundary edges and baseline
entries. A visual tab is never considered migrated while it still calls a
screen-level global query function or client-authored protocol model.

## Structure definition of done

The repository is structurally aligned only when:

- every supported entrypoint is named and tested at its declared evidence
  level;
- every target module belongs to one feature, platform adapter, contract,
  presentation primitive, app composition concern, or proven pure foundation;
- dependency direction has zero unregistered violations and zero cycles in
  target code;
- cross-feature imports use public APIs only;
- Tauri and browser global APIs exist only in platform/entrypoint code;
- generated RRFlow artifacts are identifiable, pinned, and unedited;
- no renderer state contains installed credentials or native session identity;
- native commands are thin typed adapters over testable use cases;
- no new global types/constants/utils barrel is permitted;
- new pure/application code has unit tests, contract adapters have contract
  tests, and UI evidence remains distinct from installed conformance; and
- migration-baseline counts monotonically decrease until all exceptions are
  removed.

## Stop conditions

Stop the relevant package and return to the parking lot if:

- a supposedly shared module needs a feature/store/platform import;
- a folder move requires changing behavior to make imports compile;
- a target feature needs another feature's internal store or component;
- a generated RRFlow contract is unavailable and a local replacement is
  proposed as canonical;
- a browser-test adapter is about to gain production credential, filesystem,
  or mutation authority;
- a new Cargo crate/package is proposed without an independent reuse, release,
  or compilation boundary;
- deleting an unreachable file lacks ownership and runtime evidence;
- strictness is satisfied by new casts/suppressions rather than a narrower
  type; or
- a migration diff becomes too large to demonstrate unchanged C0 behavior.

## Primary-source basis

- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references)
  can enforce logical project separation and improve build/editor behavior, but
  introduce composite/declaration configuration. They are a later hardening
  option after internal seams are proven, not the first migration step.
- Biome provides project-aware
  [`noImportCycles`](https://biomejs.dev/linter/rules/no-import-cycles/javascript/)
  and pattern-based
  [`noRestrictedImports`](https://biomejs.dev/linter/rules/no-restricted-imports/javascript/).
  Both support enforcing the clean target while a separate exact baseline
  controls inherited debt.
- TypeScript documents
  [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html),
  [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html),
  and [`useUnknownInCatchVariables`](https://www.typescriptlang.org/tsconfig/useUnknownInCatchVariables.html)
  as stronger checks with real semantic effects; they should be enabled in
  bounded clean zones and then ratcheted, not treated as formatting switches.
- Tauri's official
  [project structure](https://v2.tauri.app/start/project-structure/) uses a
  thin desktop `main.rs` and a library `run()` entrypoint, and its
  [command guidance](https://v2.tauri.app/develop/calling-rust/) supports
  grouping commands into separate modules.
- The Rust Book's
  [packages, crates, and modules](https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html)
  emphasizes module privacy before extracting independent crates; Cargo
  workspaces are appropriate when multiple packages truly need coordinated
  management.

## Decision request

Approve **1B / 2B / 3B / 4B / 5B / 6B / 7B**, or select a different option for
any decision. Approval commits the target architecture and migration method,
not a mass refactor. The next authored sprint will be Package A0 only, combined
with Parking Lot 003 Package E1 if its recommended stack is also committed.

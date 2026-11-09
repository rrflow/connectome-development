# Sprint 008 — C0 truth before features

**Status**: APPROVED / ACTIVE — reviewed 2026-09-16  
**Source**: RRFlow `docs/reference/client/connectome-implementation-guide.md`, package C0; roadmap H-06  
**Priority**: P0  
**Spoke**: RRFlow connection surface and repository verification  
**Audited revision**: `38f68ce7adda9d03501f3591165f0e14996899ec`

## Goal

Make the current three-public-GET bootstrap and its mocked browser fixture tell
only the truth they establish: liveness, readiness-response, and capability-
response observation. They must not claim authentication, connection,
verification, persistence, recovery, or engine-issued attunement/automation
state.

## COSTAR profile

- **Context**: The visible runtime page calls only `/v1/health/live`,
  `/v1/health/ready`, and `/v1/capabilities`; its passing browser test intercepts
  all three requests. A native authenticated prototype exists but no screen
  invokes it.
- **Objective**: Satisfy C0 acceptance: public GETs and fixtures produce no
  authenticated/connected/persisted/recovered/verified UI state, and mocked
  renderer evidence is visibly separate from future real-process conformance.
- **Style**: Preserve the existing React/Mantine, Playwright, Node source-gate,
  and GitHub Actions patterns. Do not add a dependency or a compatibility path.
- **Tone**: Fail closed and evidence-first; accurate incomplete state is more
  important than a green success presentation.
- **Audience**: The operator, repository reviewers, and future maintainers who
  must be able to distinguish renderer fixtures from RRFlow product evidence.
- **Response**: A bounded code/docs/CI package plus governance and verification
  evidence. C1 generated-client and C2 credential-handoff work remain out of
  scope.

## Baseline reproduction

Environment captured on 2026-09-16:

```text
Linux x86_64, kernel 7.0.0-30-generic
Node v24.16.0
pnpm 11.24.0
rustc 1.98.0 (88d9e12ae 2026-08-18)
```

Exact command:

```bash
pnpm test:smoke
```

Result: two tests passed, including
`creates an RRD HTTP runtime profile by default`; that test mocked every
`/v1/**` response and required the false success label `RRD connected`.
No governance false-positive entry covers this behavior.

## Scope and stop conditions

This sprint does not fetch `/v1/schema/endpoints` or `/v1/schema/openapi`, create
an authenticated session, wire `RrdAuthenticatedClient`, accept a renderer
credential, consume a sibling checkout, add a real-process test, or delete the
larger inherited client. Those belong to C1–C5. Because the current code lacks
the catalogue and OpenAPI identity required by the contract's `Discovered`
state, this sprint will say `capabilities observed`, not `discovered`.

The pre-existing `.gitignore` edit for `.chat/` is user-owned and is excluded
from this sprint.

## Task 1: Correct public-bootstrap state and remove fabricated live cards

**Source**: C0 truth-before-features, runtime-screen bullet  
**Priority**: P0  
**Spoke**: RRFlow connection

### Files affected

#### `src/screens/connectome/pages/RuntimeConnection/index.tsx`

- **Lines**: 1–27, 51–69, 102–229, 232–321
- **Current code**:

```tsx
import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	Progress,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
} from "@mantine/core";
// ...
import {
	ATTUNEMENT_ESTIMATE_MINUTES,
	ATTUNEMENT_PHASES,
	AUTOMATION_PRIMITIVES,
} from "~/rrflow/attunement";

const stages = [
	{
		label: "HTTP transport",
		detail: handshake ? `Responded at ${handshake.endpoint}` : "Awaiting liveness response",
	},
	// readiness and capability stages
];

{handshake ? "RRD connected" : query.isError ? "Rejected" : "Negotiating"}
// ...
{handshake ? "verified" : query.isError ? "stopped" : `${index + 1}/3`}
// ...
Verified engine identity
```

The file then renders locally authored attunement phases, a 30–45 minute
estimate, automation primitives, and mesh-adapter status from
`~/rrflow/attunement`.

- **Target code**:

```tsx
import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
} from "@mantine/core";
// No import from ~/rrflow/attunement.

const stages = [
	{
		label: "HTTP liveness",
		state: "reachable",
		detail: handshake ? `Responded at ${handshake.endpoint}` : "Awaiting liveness response",
	},
	{
		label: "Readiness response",
		state: "ready response",
		detail: handshake
			? `Cursor ${handshake.readiness.runtime_cursor} on ${handshake.readiness.backend}`
			: "Awaiting readiness response",
	},
	{
		label: "Capability response",
		state: "capabilities observed",
		detail: handshake
			? `${handshake.service.instance.id} · rrd v${handshake.service.protocol_version}`
			: "Awaiting capability response",
	},
];

{handshake ? "Public bootstrap complete" : query.isError ? "Rejected" : "Probing"}

{handshake ? stage.state : query.isError ? "stopped" : `${index + 1}/3`}

<Alert
	color="blue"
	title="Public bootstrap only"
>
	These unauthenticated responses do not create an RRD session. Authenticated
	connection remains unavailable until the generated native client and secure
	installed credential handoff land.
</Alert>

Capability response identity
```

The refresh button becomes `Probe again`; error copy becomes `RRD public
bootstrap failed`; the identity card remains a projection of the parsed
capability response; and all attunement, automation, mesh, progress, phase, and
primitive markup is deleted from this live page.

- **Rationale**: A liveness/readiness/capability response is neither an
  authenticated session nor complete discovery. Static client-authored cards
  cannot become engine capability or lifecycle truth.

#### `src/screens/connectome/pages/RuntimeConnection/style.module.scss`

- **Lines**: 1–23
- **Current code**:

```scss
.stage,
.phase {
	border: 1px solid color-mix(in srgb, var(--mantine-color-violet-6) 18%, transparent);
	background: color-mix(in srgb, var(--mantine-color-body) 92%, transparent);
}

.identity { /* retained */ }
.boundary { /* static mesh card */ }
.primitive { /* static automation card */ }
```

- **Target code**:

```scss
.stage {
	border: 1px solid color-mix(in srgb, var(--mantine-color-violet-6) 18%, transparent);
	background: color-mix(in srgb, var(--mantine-color-body) 92%, transparent);
}

.identity {
	border: 1px solid color-mix(in srgb, var(--mantine-color-violet-6) 34%, transparent);
	background:
		radial-gradient(circle at 90% 0%, rgba(139, 92, 246, 0.2), transparent 36%),
		color-mix(in srgb, var(--mantine-color-body) 92%, transparent);
}
```

- **Rationale**: Remove styles whose only consumers were fabricated live
  attunement/automation cards.

## Task 2: Isolate renderer fixtures from render smoke and conformance

**Source**: C0 test-separation bullet  
**Priority**: P0  
**Spoke**: Repository verification

### Files affected

#### `tests/smoke/connectome.spec.ts`

- **Lines**: 1–89
- **Current code**: One file mixes an un-intercepted production-bundle render
  smoke with a case that calls `page.route("http://localhost:9477/v1/**", ...)`,
  fulfills fixed `0.1.0`/`local_daemon` data, and asserts `RRD connected`.
- **Target code**: Delete this mixed file after moving its two cases verbatim or
  truth-corrected into the two files below.
- **Rationale**: A mocked transport must be recognizable by path, test title,
  command, CI step, and artifact name.

#### `tests/smoke/overview.spec.ts`

- **Lines**: new file
- **Current code**: File does not exist.
- **Target code**: The current lines 1–25 overview render test, unchanged except
  for its new file location. It contains no route interception and makes no RRD
  connection or conformance claim.
- **Rationale**: Keep the production-bundle render check narrow.

#### `tests/renderer-fixture/runtime-bootstrap.spec.ts`

- **Lines**: new file
- **Current code**: File does not exist.
- **Target code**: The current intercepted test moves here under
  `test.describe("renderer fixture — mocked public RRD bootstrap", ...)`; its
  case name becomes `renders only public bootstrap evidence from fixed responses`.
  It retains the fixed transport data only as fixture input, asserts
  `Public bootstrap complete`, `reachable`, `ready response`, and
  `capabilities observed`, asserts the public-bootstrap warning, and asserts
  that `RRD connected`, `verified`, attunement, and automation cards are absent.
- **Rationale**: Mocked parser/render coverage stays useful without being
  mistaken for an installed-process, authentication, persistence, or H-06 lane.

#### `playwright.config.ts`

- **Lines**: 3–10
- **Current code**:

```ts
export default defineConfig({
	testDir: "./tests/smoke",
	// ...
	reporter: process.env.CI
		? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
		: "list",
```

- **Target code**:

```ts
const reportDirectory = process.env.CONNECTOME_PLAYWRIGHT_REPORT ?? "playwright-report";

export default defineConfig({
	testDir: "./tests",
	// ...
	reporter: process.env.CI
		? [["github"], ["html", { outputFolder: reportDirectory, open: "never" }]]
		: "list",
```

- **Rationale**: Permit explicit test-directory commands and distinct CI
  evidence directories without a new dependency.

#### `package.json`

- **Lines**: 13–20
- **Current code**:

```json
"test:smoke": "playwright test",
"check": "biome check . && node scripts/check-retired-identities.mjs && tsc --noEmit",
"check:identity": "node scripts/check-retired-identities.mjs"
```

- **Target code**:

```json
"test:smoke": "playwright test tests/smoke",
"test:renderer-fixture": "playwright test tests/renderer-fixture",
"check": "biome check . && node scripts/check-retired-identities.mjs && node scripts/check-c0-truth-boundary.mjs && tsc --noEmit",
"check:identity": "node scripts/check-retired-identities.mjs",
"check:truth": "node scripts/check-c0-truth-boundary.mjs"
```

- **Rationale**: Names and commands make the evidence boundary executable.

## Task 3: Add a truth and retired-authority ratchet gate

**Source**: C0 source-gate bullet and audited-source-map patterns  
**Priority**: P0  
**Spoke**: Repository verification

### Files affected

#### `scripts/check-c0-truth-boundary.mjs`

- **Lines**: new file
- **Current code**: File does not exist.
- **Target code**: A dependency-free Node script will:
  1. scan `package.json`, `src/`, `src-tauri/`, and `tests/` text sources;
  2. reject `RRD connected`, `Verified engine identity`, a rendered `verified`
     badge, or an attunement import in `RuntimeConnectionPage`;
  3. reject `page.route`/`route.fulfill` outside `tests/renderer-fixture/`;
  4. reject mocked transport calls in any path containing `conformance`;
  5. require the renderer-fixture suite/title to say `fixture` and `mocked`;
  6. ratchet the currently audited retired-authority patterns so matches may
     decrease but may not appear in a new file or exceed the audited per-file
     maximum: `@rrflow/client`, `npm:surrealdb`, `@surrealdb`,
     `Surreal as RRFlow`, `@rrflow/wasm`, `rrflowkv://`, `--allow-all`,
     `rrflow-control`, `vyrm-diagnostics`, `rrflow-cloud-`, `local_daemon`, and
     fixed implementation version `0.1.0`; and
  7. print remaining debt counts without calling them conformance.
- **Rationale**: C0 cannot delete all C1–C5 debt, but it can prevent new false
  success claims, new mock leakage, and growth of known alternate authority.

The implementation must encode the audited path/count maxima directly and
must allow reductions without updating the gate.

## Task 4: Correct repository and CI claims

**Source**: C0 README/CI bullet  
**Priority**: P0  
**Spoke**: Repository documentation and CI

### Files affected

#### `README.md`

- **Lines**: 3–91, 127–136
- **Current code**: Claims the runtime is considered connected after the three
  GETs, presents the retired diagnostics and client-invented control plane as
  current contracts, describes static attunement as product scaffolding, and
  omits that browser and native transport tests are mocked/fake-server only.
- **Target code**: State that this checkout is the pre-release development
  client; the visible runtime screen performs only public bootstrap observation;
  the native authenticated code is an unwired handwritten prototype tested
  against fake TCP peers; inherited query/diagnostics/control-plane/attunement
  surfaces are non-conforming migration debt; no authenticated Connectome or
  persistence/conformance claim exists; and test commands are explicitly:

```bash
pnpm check
pnpm build
pnpm test:smoke
pnpm test:renderer-fixture
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

The README will name `rrflow/connectome-development` as the pre-release remote
and state that `rrflow/connectome` is reserved for later official promotion.
- **Rationale**: Documentation must not turn prototypes, mocks, inherited UI,
  or a private development remote into shipped product evidence.

#### `.github/workflows/connectome-ci.yml`

- **Lines**: 14–53, 55–95
- **Current code**:

```yaml
frontend:
  name: Frontend build and render smoke
# ...
- name: Smoke test production build
  run: pnpm test:smoke
- name: Upload smoke-test evidence
# ...
native:
  name: Native ${{ matrix.os }}
```

- **Target code**: Name the frontend job `Frontend static gates and renderer
  evidence (non-conformance)`; run the production render smoke and mocked
  renderer fixture as separate steps with separate
  `CONNECTOME_PLAYWRIGHT_REPORT` directories and artifact names; name the
  native job `Native compile and fake-server unit tests — ${{ matrix.os }}`;
  and include an explicit workflow comment that no job is real RRFlow
  conformance until a candidate-artifact lane exists.
- **Rationale**: Green CI labels must describe the evidence actually executed.

## Task 5: Record the resolved false-success behavior

**Source**: Debug-troubleshooting resolution protocol  
**Priority**: P1  
**Spoke**: Screens governance

### Files affected

#### `src/screens/GOVERNANCE.md`

- **Lines**: after the False Positive Registry
- **Current code**: No known-issues/resolutions section records the runtime
  page's false connected/verified state.
- **Target code**:

```md
## Known Issues / Resolutions

| ID | Area | Resolution | Date |
|----|------|------------|------|
| C0-001 | `RuntimeConnectionPage` public bootstrap | Public liveness, readiness, and capability responses are labelled only as observed bootstrap evidence; authenticated/connected/verified state is reserved for later generated-client and secure-session work. Renderer mocks live only in the explicitly named fixture lane. | 2026-09-16 |
```

- **Rationale**: Future changes need a durable explanation for why a green
  public bootstrap is intentionally not a connection badge.

## Ordered execution

1. Correct the runtime UI and delete its static live cards/styles.
2. Split and truth-correct Playwright test lanes.
3. Add the truth/debt ratchet and wire it into `pnpm check`.
4. Correct README and CI evidence language.
5. Record the resolution in screens governance.
6. Run all gates and reread the complete diff.

## Definition of done

- No production screen derives `authenticated`, `connected`, `persisted`,
  `recovered`, or `verified` from the three public GETs.
- The runtime page contains no client-authored attunement/automation live cards.
- Every intercepted browser request is under `tests/renderer-fixture/`; the
  render-smoke lane has no transport interception; neither is called
  conformance.
- The truth gate fails on false state labels, mock leakage, or growth of an
  audited retired-authority pattern.
- README and CI describe the current prototype and evidence without
  overstatement.
- `pnpm check`, `pnpm build`, `pnpm test:smoke`, and
  `pnpm test:renderer-fixture` pass.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`,
  `cargo check --manifest-path src-tauri/Cargo.toml --all-targets --locked`,
  `cargo test --manifest-path src-tauri/Cargo.toml --all-targets --locked`, and
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`
  pass because C0 changes the repository gate and must preserve the native
  baseline.
- `git diff --check` passes, the user-owned `.gitignore` edit is untouched, and
  no official repository is created, modified, or pushed.

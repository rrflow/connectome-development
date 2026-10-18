# Sprint 008 — RRFlow serve spine

Status: active

## Goal

Make Connectome start, bind to, and explain a real RRFlow estate through the
contract it is pinned to, so the desktop "Start serving" action produces a
green RRD handshake on a clean machine.

## Source

Repository owner's Decision 8 (2026-10-18): "Connectome spine first". Stated
acceptance: RRFlow is "0.0" until Connectome shows every tab, browses estates
and drills into the graphs, and shows prompts processed through a frontier AI
with memories held in rrflowKV/rrflowDB, with the frontier AI forced to use
it. Connectome must be contracted to RRFlow so it is easy to maintain and
update, and must be a guided, turnkey experience (explanations, instructive
popups, tooltips) that evolves a vibe coder into a context engineer.

## Baseline captured 2026-10-18

Reproduced, not inferred:

- `main` is `b388e48`; `src-tauri/Cargo.lock` pins `rrd-client` and
  `rrd-contract` to `rrflow/rrflow-development@b275792` (pull request #3),
  26 commits behind RRFlow `main` `4705941` — before the endpoint-binding
  contract, restore publication, the public `installed_control` backup field,
  and the OpenAPI digest change `733695…` → `07bef046…`.
- The desktop "Start serving" action (`src/components/ActionBar/serving.tsx`
  → `adapter.startDatabase()` → Tauri `start_database`) spawns Surrealist's
  SurrealDB launch line with the binary renamed:
  `rrflow start --bind 0.0.0.0:<port> --user … --pass … --log <level>
  rrflowkv://<storage> --allow-all` under `RRFLOW_EXPERIMENTAL_GRAPHQL=true`.
  The `rrflow` CLI is `version | install | serve | ready | verify | restore`;
  the command exits 2 ("unrecognized subcommand 'start'") within
  milliseconds, so the reader thread's `elapsed <= 500` branch emits
  "RRFlow did not start correctly". Nothing listens, so the runtime page's
  handshake (`/v1/health/live`, `/v1/health/ready`, `/v1/capabilities`) fails
  with "Unknown RRD connection error".
- The contracted sequence exists only in the ignored process tests
  (`src-tauri/src/rrd/client/process.rs`): `install plan --mode fresh` →
  `install apply --plan --expect <plan_sha256>` → `--json serve --bind
  127.0.0.1:0 --project` (one JSON announcement line with `url` and
  `instance_id`) → `ready --address --project` → `NativeRrdClient::connect`
  with `.rrflow/credentials/local-operator.json`. No product path calls it.
- `package.json` carries Surrealist's `"engineProtocol": "2.0.0"`, exposed
  as `import.meta.env.RRFLOW_VERSION` and shown as "RRFlow protocol v2.0.0"
  (About tab) and "RRFlow 2.0.0" (toolbar). RRFlow's protocol is `rrd` v1
  and its product version is 1.0.0; `src/rrflow/runtime.ts` already declares
  `RRD_PROTOCOL = "rrd"`, `RRD_PROTOCOL_VERSION = 1`.
- `ConnectomeServingSettings` is SurrealDB's model: `driver`
  (memory/file/rrflowkv/tikv), `username`, `password`, `port`, `storage`.
  RRFlow has one storage engine, a kernel-chosen loopback port, and a file
  credential the renderer must never read.

## Authority decisions carried forward

Sprint 007 decisions 3 (generated contract owns wire types), 4 (RRD is the
runtime identity), and 5 (Tauri 2 client) stand. Sprint 007's post-merge
steps that mount Connectome under RRFlow `apps/connectome` through a parent
submodule are not executed: RRFlow's `AGENTS.md` forbids a Git submodule and
keeps Connectome an optional public-contract integration. The relationship is
the dependency direction — Connectome pins one exact RRFlow revision and its
CI proves that revision — which is what makes the pin cheap to move.

## Ordered implementation slices

### Slice A — move the contract pin to RRFlow `main` and prove it

Files:

- `src-tauri/Cargo.toml` lines 46–47
- `src-tauri/Cargo.lock`
- `package.json` line 5, `vite.config.ts` line 129,
  `src/shell/components/App/settings/tabs/About.tsx` line 36,
  `src/screens/connectome/toolbar.tsx` lines 322 and 540

Current `src-tauri/Cargo.toml` lines 46–47:

```toml
rrd-client = { git = "https://github.com/rrflow/rrflow-development", rev = "b27579299b91dbe8fe13893ff66c2cd8906c8466" }
rrd-contract = { git = "https://github.com/rrflow/rrflow-development", rev = "b27579299b91dbe8fe13893ff66c2cd8906c8466" }
```

Target:

```toml
rrd-client = { git = "https://github.com/rrflow/rrflow-development", rev = "470594178d25f1bf12d3ec6d9041488817a9e931" }
rrd-contract = { git = "https://github.com/rrflow/rrflow-development", rev = "470594178d25f1bf12d3ec6d9041488817a9e931" }
```

Work:

1. Re-pin both crates to `4705941` (RRFlow `main` after pull request #14) and
   lock them; `cargo check --locked --all-targets` against the new contract.
2. Run the native unit tests and the RRD process tests against `rrflow` built
   at `4705941`; CI's `rrd-process` job derives the revision from the lock.
3. Replace the Surrealist `engineProtocol` leftover: the two displays read the
   protocol and version Connectome is contracted to (`rrd` v1 from
   `src/rrflow/runtime.ts`; the engine's product version from the handshake's
   `implementation_version`), not a manifest field no contract defines.

Rationale: every later slice builds on the contract; a stale pin would make
the serve flow target an engine nobody ships.

### Slice B — the contracted estate serve replaces the legacy lane

Files:

- `src-tauri/src/database/mod.rs` (whole file) and `src-tauri/src/database/shell.rs`
- `src-tauri/src/rrd/client/process.rs` lines 95–180 (the sequence to lift)
- `src/adapter/base.tsx`, `src/adapter/desktop.tsx` lines 173–189,
  `src/adapter/browser.tsx`
- `src/types.tsx` lines 239–248 (`ConnectomeServingSettings`),
  `src/shared/util/defaults.tsx` lines 85–94
- `src/stores/database.tsx`, `src/components/ActionBar/serving.tsx`,
  `src/shell/components/App/modals/console.tsx`, the serving settings tab
- `src/screens/connectome/pages/RuntimeConnection/index.tsx` lines 108–121

Current `src-tauri/src/database/mod.rs` lines 170–195:

```rust
    let mut args = vec![
        path,
        "start",
        "--bind",
        &bind_addr,
        "--user",
        options.username,
        "--pass",
        options.password,
        "--log",
        options.log_level,
    ];

    let file_uri = format!("rocksdb://{}", options.storage);
    let rrflowkv_uri = format!("rrflowkv://{}", options.storage);
    let tikv_uri = format!("tikv://{}", options.storage);

    match options.driver {
        "memory" => args.push("memory"),
        "file" => args.push(&file_uri),
        "rrflowkv" => args.push(&rrflowkv_uri),
        "tikv" => args.push(&tikv_uri),
        _ => Err("Invalid database driver")?,
    }

    args.push("--allow-all");
```

Target: the module becomes `src-tauri/src/rrd/estate.rs` with three Tauri
commands and one event stream, lifted from the process tests:

```rust
/// What the webview may configure: a project directory, the mode, and an
/// optional executable override. No credential, user, password, driver, or
/// port: RRFlow has one storage engine, the kernel picks the loopback port,
/// and the operator credential stays a file the native process reads.
pub struct EstateServeRequest { project: PathBuf, mode: InstallMode, executable: Option<PathBuf> }

/// `rrd_estate_prepare`: `rrflow --json install plan --project --mode` when
/// the project has no locator; returns the preview (managed paths, digests,
/// grants) for the guided explanation. Read-only.
/// `rrd_estate_serve`: `install apply --plan --expect <plan_sha256>` when
/// needed, then `--json serve --bind 127.0.0.1:0 --project`; parses the one
/// announcement line; polls `rrflow ready --address --project`; emits
/// `estate:stage` { stage: install | serve | ready | handshake, state, detail }
/// after each boundary; returns { url, instance_id, credential_path }.
/// `rrd_estate_stop`: stops the child it started; never kills by name.
```

Work:

1. Replace `start_database`/`stop_database` and `shell.rs` (the `sh -c`/
   `cmd /C` wrapper is not needed: `Command` spawns the executable directly,
   with no shell and no secrets on the command line).
2. `ConnectomeServingSettings` becomes `{ project, mode, executable, logLevel }`;
   defaults point at a per-user estate directory under the app data dir.
3. On the announcement, the adapter upserts the `runtime` connection
   (`authentication.hostname` = announced address, `runtimeInstance` =
   `instance_id`, `runtimeCredential` = `<project>/.rrflow/credentials/local-operator.json`)
   and opens it, so the existing handshake page turns green without a manual
   connection.
4. The serving console shows the stage stream and the engine's stderr; each
   stage card explains itself in plain words (what "install plan" sealed,
   why the port is kernel-chosen, what "ready" authenticated), using the
   glossary terms already defined for the lenses.
5. The process tests keep their own `Estate` fixture but call the same
   native functions as the commands, so CI proves the product path.

Rationale: this is the one change the owner sees; it removes the dead lane
rather than patching it, per RRFlow's one-implementation rule.

### Slice C — the TypeScript client consumes the generated SDK

Files:

- `src/rrflow/runtime.ts` (handwritten `RrdServiceCapabilities`, parsers)
- `package.json` (an `@rrflow/rrd-client` dependency from the pinned
  revision's `sdks/typescript`), `scripts/check-dependency-authority.mjs`
- `src/vendor/rrflow-client.ts` (Slice E-6 remnant)

Work:

1. Add the generated TypeScript SDK at the pinned revision and route the
   public handshake (`/v1/health/*`, `/v1/capabilities`) through its
   validators; the dependency-authority scan requires the npm pin and the
   Cargo pin to name one revision.
2. Delete the hand-mirrored wire types that the SDK now owns (Authority
   decision 3); view models stay.

### Slice D — turnkey executable

Files:

- `src-tauri/tauri.conf.json` (`bundle.externalBin`),
  `.github/workflows/connectome-ci.yml`, `src-tauri/src/paths.rs`

Work:

1. Bundle `rrflow` built at the pinned revision as a Tauri sidecar per
   platform, so a fresh install needs no executable setting; the setting
   remains an explicit override.
2. The pinned revision is read from one place (`Cargo.lock`) by CI, the
   sidecar build, and the about display.

## Definition of done

On a clean machine with the desktop build: "Start serving" installs or opens
the configured estate, the stage cards go green in order, the runtime
connection opens itself, the RRD handshake shows `rrd v1` and the instance
id, and every lens renders — proven by the native unit tests, the RRD process
tests at the pinned revision in CI, the Playwright smoke of the stage flow,
and a desktop run reviewed by screenshot. The legacy `start_database` lane,
`shell.rs`, and the `engineProtocol` manifest field are gone.

## Execution journal

### 2026-10-18 — Slice A: pin moved to `4705941`

Branch `agent/rrflow-serve-spine` from `main` `b388e48`.

- `rrd-client` and `rrd-contract` re-pinned to `4705941`; `cargo update -p
  rrd-client -p rrd-contract` relocked exactly those two packages.
- `cargo check --locked --all-targets`: clean against the new contract (the
  26 engine commits are additive on the surfaces the native client uses).
- Native unit tests: 23 passed (2 ignored, the process tests). RRD process
  tests against `rrflow` built at `4705941` (`RRFLOW_BIN`, `--ignored`):
  `the_lenses_read_a_live_estate` and
  `a_second_connection_never_replays_the_first_session` passed (39.8 s on
  the unoptimised build). Strict Clippy and `cargo fmt --check`: clean.
- `engineProtocol` removed from `package.json`. `vite.config.ts` reads the
  `rrd-contract` block of `src-tauri/Cargo.lock` and defines
  `RRFLOW_ENGINE_VERSION` (1.0.0) and `RRFLOW_ENGINE_REVISION`; the build
  fails if the lock stops pinning one revision. The About tab shows
  "RRD protocol rrd v1" and "RRFlow engine 1.0.0 (4705941)"; the toolbar's
  minimum-version badge compares against the engine version. The
  `RRFLOW_VERSION` define and its env typing are gone.
- `pnpm check` (Biome 587 files, identity gate 1822 files, dependency
  authority, `tsc`): clean. `pnpm build`: the bundle carries the revision.
  Render smoke: 2 passed against the production bundle (this machine runs
  the repository's Playwright through its pre-installed Chromium via a
  local-only config; CI installs the pinned browser).
- Not changed yet: the dead `start_database` lane (Slice B).

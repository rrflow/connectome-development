# Connectome

Connectome is the native desktop control surface for RRFlow. It runs as a Tauri application on Windows, macOS, and Linux and connects to a separately deployed RRFlow runtime.

This is the standalone
[`EonsofStupid/rrflow-connectome`](https://github.com/EonsofStupid/rrflow-connectome)
Git repository. It may be checked out beside the engine while the repositories
are developed together, but it is not part of the database engine and it is
not an embedded browser panel.

## Current alpha

Connectome currently provides:

- locally persisted RRFlow connection profiles;
- a real RRD HTTP bootstrap over `/v1/health/live`, `/v1/health/ready`, and
  `/v1/capabilities`;
- strict `rrd` protocol-version and instance-identity validation before a
  runtime is considered connected;
- a native transport allowlist with bounded responses, redirects disabled,
  loopback-only plaintext HTTP, and HTTPS required off-loopback;
- root, namespace, database, record-access, token, and anonymous authentication;
- namespace and database selection;
- a RRFlowQL query studio with table, graph, JSON, and live-result lenses;
- record and table exploration;
- visual data-model and relationship design;
- authentication, parameter, function, GraphQL, and runtime-diagnostics tools;
- a strict `vyrm-diagnostics` v1 client with custom prompt flights, persisted
  past-run replay, reverse/forward transport, scrubbing, 0.5×–8× playback,
  observable event lanes, and a runtime-owned capability/evidence ledger;
- separate project-runtime and optional enterprise-control-plane profiles;
- multi-window native desktop operation.

Connectome uses RRFlow-native runtime and control-plane contracts. A new
runtime profile opens the RRD bootstrap screen; it does not route through the
inherited Surreal-compatible query client. The inherited query, graph, and
schema surfaces remain available for migration, but are not evidence that the
native RRD operations behind those surfaces are finished. The optional
enterprise control-plane connection remains a separate fleet-management
boundary. There is no runtime compatibility fallback.

The connection sequence is deliberately narrow:

```text
direct origin or mesh-resolved origin
                 |
                 v
  HTTP liveness -> readiness -> capabilities
                 |
                 v
    validate rrd v1 + exact instance identity
```

A mesh integration may supply a private devspace endpoint and opaque
attestation reference. It does not become a database transport, store
credentials in the connection model, or make network reachability equivalent
to RRD identity. No Zuul Zero or shippin.ai command has been invented in this
repository; their adapter remains pending an exact installation and discovery
contract.

Existing-project attunement is scaffolded as a future resumable, checkpointed
RRD engine job with a 30–45 minute planning estimate. Its phases are connect,
inventory, parse, normalize, entity-link, lexical index, embed, vector index,
graph, ground, and verify. Only `connect` is implemented here. The UI labels
the remaining phases `planned` until RRD advertises and executes a canonical
attunement contract.

Triggers, routines, hook adapters, and skills follow the same authority rule:
triggers are conditions over canonical engine events; routines are authorized
RRD operations; hook adapters may submit typed host events; skills are
versioned instruction/resource references. Connectome can configure and
observe them, but it cannot execute a parallel lifecycle or write directly to
RRFlowDB.

Native RRD bootstrap requests cross the Tauri command boundary instead of
relying on WebView CORS. That transport accepts only the three public bootstrap
GETs, caps responses at 1 MiB, disables redirects, permits plaintext HTTP only
for loopback, and requires HTTPS for a remote runtime. The older diagnostics
transport remains isolated for existing diagnostic profiles.

The enterprise contract is deliberately separate from the runtime query
protocol:

- `GET /rrflow/v1/control/handshake` must identify `rrflow-control` protocol
  version `1`;
- `GET /rrflow/v1/control/instances` returns the project runtimes managed by
  that control plane;
- requests use bearer authentication and the `RRFlow-Control-Protocol: 1`
  header;
- an invalid or mismatched handshake is rejected and is never routed into the
  runtime query client.

## Repository boundary

```text
RRFlow engine repository             Connectome repository
├── runtime / storage / query execution
├── QORTEX vector internals
└── rrd-contract <------------------ typed client boundary
                                      └── native desktop UI
```

During joint development the Connectome and RRFlow repositories may be checked
out beside one another, but their Git histories and release boundaries remain
independent.
Connectome visualizes and controls project RRFlow instances. The optional
enterprise profile connects to a distinct control plane for fleet and
deployment management; it does not change or proxy the project-runtime
contract.

## Development

Requirements: Node.js 22.13 or newer, pnpm 11.24, and the Tauri 2 platform
prerequisites.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Run the actual desktop shell:

```bash
pnpm tauri:dev
```

Verification:

```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

The production TypeScript/Vite build is green. The inherited whole-repository
Biome assist baseline still reports import-order debt, so CI intentionally uses
the build as its frontend gate until that mechanical cleanup is isolated.

## The bundled engine

A packaged Connectome ships the RRFlow engine it is contracted to. `src-tauri/Cargo.lock` pins one RRFlow revision; `pnpm engine:stage` builds `rrflow` from exactly that revision (or `node scripts/engine/build-sidecar.mjs --from <binary>` takes one already built from it) and stages it as the Tauri sidecar under `src-tauri/binaries/` with a manifest of its revision, target, and SHA-256. The native build embeds that digest, and the desktop runs the bundled engine only while the file still hashes to it — a stale or altered sidecar is refused, never silently replaced. With nothing bundled, "Start serving" uses the executable configured in Settings → Serving, else `rrflow` on `PATH`, and says which one it used.

```bash
pnpm engine:stage        # build and stage the pinned engine (or --from <binary>)
pnpm engine:check        # verify the staged engine against its manifest and the pin
pnpm tauri:bundle        # package Connectome with the bundled engine
```

## Packaging

The Tauri bundle configuration emits NSIS installers for Windows, app/DMG bundles for macOS, and AppImage/DEB/RPM packages for Linux. `pnpm tauri:bundle` adds the staged engine as `bundle.externalBin` through `src-tauri/tauri.bundle.conf.json`; plain `pnpm tauri:build` packages without it. The inherited release workflow already covers macOS x86-64 and ARM64 plus Windows and Linux x86-64; Linux ARM packaging still needs a dedicated runner or cross-compilation pipeline.

## Origin and license

Connectome preserves a mature desktop query, schema, graph, and connection shell while the product evolves around RRFlow. See [LICENSE](LICENSE), third-party notices, and the repository history for attribution.

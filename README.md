# Connectome

Connectome is the native desktop control surface for RRFlow. It runs as a Tauri application on Windows, macOS, and Linux and connects to a separately deployed RRFlow runtime.

This public repository,
[`rrflow/connectome-development`](https://github.com/rrflow/connectome-development),
is RRFlow's associated operator and developer UI repository. The engine
repository, [`rrflow/rrflow-development`](https://github.com/rrflow/rrflow-development),
registers it at `connectome/` as an optional Git submodule in
[the source-integration change](https://github.com/rrflow/rrflow-development/pull/20).
The parent gitlink pins an exact Connectome source revision; UI changes are
reviewed here before a separate engine change advances that pin.

Connectome keeps its own Git history, build, and release boundary. RRFlow can
operate independently of this UI. Connectome's packaged engine revision (see
"The bundled engine" below) is a separate pin for the engine binary shipped
with the desktop application.

## Current alpha

The native workbench provides an explicit local start with an engine-owned
installation preview, authenticated native sessions, a live schema/data-model
browser, bounded rrflowQL row queries, record/relationship graphs, vector point
and similarity views, and storage evidence. The desktop bundle includes the
exact pinned `rrflow` executable, verified by its embedded SHA-256 before use.
No Node.js, Rust toolchain, separate database service or cloud account is needed
to run the built desktop bundle on a supported desktop with its WebView runtime.

Start with **Start local RRFlow** on the home screen, review **Install and open
RRFlow**, then explore **Data models**, **Records & relations**, **Vectors** and
**Storage engine**. The home screen's **How RRFlow fits together** guide explains
rrflowDB, rrflowQL and rrflowKV. [Native workbench instructions](docs/native-workbench.md)
cover building, startup, persistence, exact limits and validation.

Credentials and session tokens remain in the native process. The renderer
receives bounded public results and catalogue metadata. Cloud synchronization,
PostgreSQL wire/SQL compatibility, full attunement and automatic image/audio/video
understanding are not implemented by this workbench. Media inference requires
an explicitly configured model capability. Existing inherited editor/query
surfaces are not the native RRD workbench and do not prove engine support;
[sprint 009](.agents/sprints/009-connectome-ownership.md) owns their convergence.

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

After the source-integration change lands, acquire the pinned UI from an RRFlow
checkout with:

```bash
git submodule update --init -- connectome
git submodule status -- connectome
```

A standalone clone of this public repository also supports UI development.
Neither checkout layout makes UI source an engine build or readiness dependency.
The [RRFlow client contract](https://github.com/rrflow/rrflow-development/blob/agent/connectome-product-integration/docs/reference/client/connectome.md)
owns the integration requirements; a source pin alone does not qualify the UI.
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

Connectome is licensed under the MIT License ([LICENSE](LICENSE)). It began
as a fork of an MIT-licensed desktop database client; [NOTICE](NOTICE) names
that work and preserves its copyright and permission notice for the portions
that remain derived from it, as that license requires. Everything written for
Connectome is Connectome's. The inherited product surfaces (cloud/organization
pages, the inherited assistant, the inherited query client and its WASM
engine, and the inherited UI kit) are being removed or replaced in the order
recorded in `.agents/sprints/009-connectome-ownership.md`; `pnpm
check:identity` fails if the inherited vendor's name appears anywhere other
than a declared dependency's own identifier, the `src/vendor/` seam, or the
notices.

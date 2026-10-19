# Connectome

Connectome is the native desktop control surface for RRFlow. It runs as a Tauri application on Windows, macOS, and Linux and connects to a separately deployed RRFlow runtime.

This is [`rrflow/connectome-development`](https://github.com/rrflow/connectome-development),
with the owner's authored UI from `agent/layman-lenses-wip`. The RRFlow development
repository includes it as the optional `connectome/` submodule. Its source,
history, tests, and release remain independently owned by this repository.

## Current alpha

Connectome currently provides:

- locally persisted RRFlow connection profiles, editable in place;
- managed SSH forwarding for an explicitly configured existing remote runtime;
- a real RRD HTTP bootstrap over `/v1/health/live`, `/v1/health/ready`, and
  `/v1/capabilities`;
- strict `rrd` protocol-version and instance-identity validation before a
  runtime is considered connected;
- a native transport allowlist with bounded responses, redirects disabled,
  loopback-only plaintext HTTP, and HTTPS required off-loopback;
- installation from a sealed RRFlow plan, kernel-selected loopback serving,
  and an authenticated readiness check before opening the estate;
- native operator-credential sessions; credential contents and session bearers
  remain in Rust;
- the owner's Records & relations, Vectors, and Storage engine lenses, with
  persistent connection controls and a compact view switcher;
- capability-gated knowledge trees with native vector bindings, external source
  configuration, retained drafts and concurrent-edit recovery; saving a source
  does not enable an external connector or synchronization;
- bounded RRFlowQL queries through the pinned native RRD SDK;
- authored CodeMirror presentation support, value formatting, icons, code
  blocks, Markdown, theme, and offline pictograms;
- the existing runtime-diagnostics tools and playback surfaces;
- separate project-runtime and optional enterprise-control-plane profiles;
- multi-window native desktop operation.

Connectome uses RRFlow-native runtime and control-plane contracts. There are
no Surreal packages, npm aliases, package-name path aliases, vendor re-export
wrappers, embedded WASM engines, or alternate database transports. Application
consumers import the authored modules under `src/rrflow/` by relative path.

The retained query/schema/administration forms are part of the existing UI.
Password and record sign-up, GraphQL, SQL import/export, embedded execution,
live-query delivery, and query bindings report explicit unavailable errors
until their real RRD contracts are connected. Presentation formatting never
claims to validate RRFlowQL semantics; the engine remains the parser authority.
The optional enterprise control plane is a separate fleet-management boundary.

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

## Reconnect an existing runtime

Open the saved connection and choose **Edit connection**. Keep its original
HTTP origin, expected instance and operator credential reference. For a runtime
already running on another machine, set **SSH host** to that machine's existing
SSH config alias (for example `devstation`). Connectome manages the loopback
forward at the saved port, verifies the instance and opens the authenticated
session. Use **Reconnect** to retry. Closing Connectome stops its forward;
the remote engine continues serving.

For a locally installed runtime, select its existing project directory. It
must already contain the RRFlow locator; opening an existing profile never
installs a new empty estate. Installation is an explicit separate operation
using the project selected in Serving settings.

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

Build `rrflow` from `e5672ec1d953c736b2befa38b34a13623a23a5d6` and put it on
the process PATH, or select that executable in **Settings → Serving**. Choose
an empty project directory for a fresh installation, then click **Start serving**.
The console reports `[install]`, `[serve] Listening at … as instance-…`, and
`[ready] The estate answered an authenticated readiness check`. Connectome opens
the native session and the Records & relations lens; **Engine details** shows
the three verified handshake cards. Serving uses the installed estate's own
credential file and never asks for a root password or storage driver.

Verification:

```bash
pnpm build
pnpm test:rrflow
pnpm check:dependencies
cargo check --manifest-path src-tauri/Cargo.toml
```

Run `pnpm check` for the full Biome, identity/dependency and TypeScript checks,
and `pnpm test:smoke` after building for the production browser smoke suite.
Browser smoke verifies presentation and public bootstrap fixtures; native
session and installed-engine acceptance are verified separately.

## Packaging

The Tauri bundle configuration emits NSIS installers for Windows, app/DMG bundles for macOS, and AppImage/DEB/RPM packages for Linux. The inherited release workflow already covers macOS x86-64 and ARM64 plus Windows and Linux x86-64; Linux ARM packaging still needs a dedicated runner or cross-compilation pipeline.

A cloud version is planned around the same authored UI and public RRD boundary.
Browser authentication, deployment, and hosted conformance are not implemented
by this desktop qualification.

## Origin and license

Connectome preserves a mature desktop query, schema, graph, and connection shell while the product evolves around RRFlow. See [LICENSE](LICENSE), third-party notices, and the repository history for attribution.

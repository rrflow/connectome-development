# Authored Connectome RRFlow boundary

This change starts from the owner's `agent/layman-lenses-wip` UI at
`abc549cf7bb61f2ed4a20353ccb2e3621da515c9`. The original sibling checkout is
preserved. Work is isolated in the RRFlow repository's optional `connectome/`
checkout, on `agent/rrflow-native-connectome`.

## Source replacement

| Previous boundary | Authored destination | Replacement evidence |
| --- | --- | --- |
| npm aliases to a database client and CBOR/WASM | `src/rrflow/client/native.ts`, `values.ts`, existing `session.ts`, native `rrd/client.rs` | Real installed-process query and denial corpus; no renderer wire codec or embedded engine |
| UI package alias | `src/rrflow/ui/` | Accessible icons, exact-source code highlighting, safe Markdown, theme and offline asset tests |
| Vendor editor wrapper and versioned WASM parsing | `src/rrflow/editor/`, `src/shared/util/rrflowql/` | CodeMirror selection, source offsets, variable discovery, links, formatting and strict JSON tests |
| Driver/port/root-password process launcher | `src-tauri/src/rrd/estate.rs`, desktop adapter, serving settings/action | Actual sealed-plan install, engine announcement, authenticated readiness, session and Records lens |

Consumers import these implementations by actual relative source paths.
`src/vendor/rrflow-client.ts`, `src/vendor/rrflowql-editor.ts`, version aliases,
package-name path aliases, the no-op version linter and font injector, and the
obsolete native launcher are removed. No upstream implementation is concealed
under another package name. The installed dependency report is regenerated
from the actual dependency graph; repository history and valid notices remain.

The native SDK is pinned to published engine revision
`e5672ec1d953c736b2befa38b34a13623a23a5d6`. The initial qualification below
used the earlier `4705941` pin; the later knowledge integration was checked
again against the published revision through the normal locked Git dependency. Every native query supplies the
expected connected instance and is rejected before dispatch if it changed.
Native credential files and session bearers never enter renderer state.

## Verification on 2026-10-18

- `pnpm run test:rrflow`: 19 passed, none skipped. Adversarial ownership cases
  reject npm aliases, local package-name aliases, executable upstream imports,
  and recreated vendor wrappers.
- `pnpm run build`: TypeScript and production Vite bundle passed.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed against the pinned
  SDK revision.
- `cargo test --manifest-path src-tauri/Cargo.toml --locked -- --nocapture`:
  38 passed; the separately executed installed-process case is intentionally
  ignored in the ordinary unit run.
- `scripts/test-native-client.ps1 -Executable <pinned rrflow.exe> -FixtureRoot
  <isolated fixture directory>`: one real installed-process test passed, none
  ignored. It installs a fresh estate, checks authenticated readiness, creates
  an authenticated native session, seeds a claim through a public typed
  transaction, checks the exact query row/identity/cursor/work result, and
  proves invalid credentials, invalid syntax, wrong handshake/query instance,
  and closed-session requests fail. Fixture evidence is retained outside the
  application source. Initial fixture runs exposed an incorrectly nonempty
  fresh directory and a missing commit deadline; those test setup errors were
  corrected before the successful run.
- The standard full Biome check passed on all 597 files with every configured
  rule enabled. The initial full check exposed CRLF/import formatting; safe
  formatter/import fixes resolved it without suppressing rules or changing
  features.
- Actual native UI: **Start serving** sealed/applied the installation plan,
  announced `http://127.0.0.1:60410` as
  `instance-3a9cd51750f9564607e67699`, and logged authenticated readiness.
  Connectome opened `local-operator`'s session and the owner's Records &
  relations lens at cursor 2. HTTP transport, engine readiness and RRD
  protocol/identity each displayed **VERIFIED**. The test estate was then
  stopped through the UI and the native dev process exited successfully.

## Existing-profile recovery on D:

The earlier local installation smoke used a separate disposable estate; it did
not repair the owner's pre-existing connection. On 2026-10-18 the original
`Local RRFlow` profile (`I9ZKPaj55`) was recovered without creating another
profile or estate. Its real engine was already serving on `devstation` at
remote loopback port 9477. A digest-only check matched the saved credential's
public plan digest to that installed project's configuration.

The native app now owns the explicitly configured SSH forward for this saved
profile. The existing Edit connection form persists `runtimeSshHost`; bootstrap
starts/reuses that transport, checks the exact original instance, and the
existing native SDK opens the session with the saved credential. Start/Stop
local serving never applies to an SSH profile; its action is Reconnect.
Disconnect and app exit clean up only the app-owned forward, leaving the
remote RRFlow engine running. Original local profiles require their existing
installed project explicitly; an absent locator cannot silently install an
empty replacement estate.

Live verification from `D:\localdev\rrflow\connectome` restored the exact
`instance-07d784c6047ec8be023891a2` as `local-operator`. Records rendered 271
records and 986 relations at cursor 1529; Vectors reported the existing one
collection and one named vector. The actual Reconnect control returned to the
same session/identity/data, and all three identity cards showed VERIFIED.
No test fixture was seeded into this original estate. The existing saved
query and profile identity were preserved; the app configuration was backed
up before adding the verified SSH host and instance fields.

The D: dependency copy initially contained empty package placeholders.
`pnpm install --frozen-lockfile` rebuilt the D: dependency graph; full
`pnpm check` and the 19 authored tests passed there. Five focused SSH tests
and the 38-test native suite passed, with the separately invoked installed
integration case explicitly ignored. C: source was left untouched while the
owner copied it to D:.

## Remaining boundaries

The actual native Records, Vectors and Storage lenses are preserved. Retained
older password/record-signup, GraphQL, SQL import/export, embedded sandbox,
live-query and query-binding forms report explicit unavailable errors until
their RRD contracts are connected. Editor presentation does not pretend to
validate engine semantics. A cloud version still needs browser authentication,
deployment and hosted conformance. This local qualification does not complete
those capabilities or the engine's release gates.


## Knowledge integration and viewport follow-up

The published SDK adds native, exact-instance knowledge-tree list and CAS save
commands. The existing authored editor retains drafts across view switches,
rebases concurrent changes and exposes structural repair. The engine negotiates
this capability; older engines do not receive unsupported requests. External
HydraDB, MongoDB Atlas and Pinecone Nexus entries remain configuration only.

The same workspace now keeps compact connection controls and view navigation
above independently scrolling content. Engine details retain the three checks,
identity and capability status. Graph sizes follow the viewport; side panels
scroll rather than clip. Credential paths are local drafts until explicit sign-in,
and failed sign-out/file selection retain their actual error and recovery action.

Follow-up checks: frontend full check passes 600 files; 28 behavior tests pass;
production build passes 3398 modules. The published SDK native suite passes 40
with one installed-process case explicitly ignored in that ordinary run. That
case was invoked separately against the real primary CLI built at e5672ec1:
one passed, none ignored, including knowledge read/native-path save/stale-write
and wrong-instance denial. It used an isolated retained fixture, never the
original 9477 estate. Browser smoke passes 2 tests, including responsive public
connection presentation at 1366x768, 1024x768, 390x844, 1366x360 and 390x600. Those fixture responses
are UI evidence, not native/provider capability evidence.

The D: desktop app with this SDK and the same credential copied to D: separately
reads the original instance-07d784c6047ec8be023891a2 as local-operator, 271
records/986 relations at cursor 1529, one vector collection and live storage.
No original estate was created, seeded or restarted. Native knowledge-editor
GUI CRUD and complete authenticated narrow-window qualification are still
unrun; the original older engine does not advertise tree editing. The user was
actively recording the desktop during final checks, so automated interaction
was deferred. The engine adapter, native client and editing-model tests remain
separate evidence from that pending GUI qualification.

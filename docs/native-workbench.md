# Native RRFlow workbench

Connectome is the optional desktop UI. The included `rrflow` executable owns
installation, authentication, schema, transactions, queries and persistence.
The UI never opens the database files itself.

## Use the built bundle

Keep `connectome.exe` and `rrflow.exe` together on Windows. Open Connectome,
choose **Start local RRFlow**, inspect the exact installation preview, and
choose **Install and open RRFlow**. Cancel leaves the estate uninstalled; an
empty project folder may have been created for planning. A changed project,
configuration or executable requires a fresh preview. An existing estate opens
without another installation. Credentials are stored by RRFlow and read by the
native client; no token is entered in a URL or browser storage.

The default project is in Connectome's application-data directory under
`estates/local`. The serving settings can select an absolute project path,
fresh/existing mode, and an explicit engine override. Startup binds a free
loopback port and creates or updates its local connection profile. Close the
app or use its stop control to stop the owned engine process; data remains.
Restart and **Start local RRFlow** to reopen it.

The binary digest is part of the installed estate identity. Retain the engine
that installed your project; replacing it is not an automatic data upgrade.
No account is required and this path does not enable synchronization.

## Learn and navigate

- **How RRFlow fits together** explains the native data engine without setup.
- **Data models** reads the authenticated catalogue, shows installed table
  models and schema/read cursor, and offers a bounded row query where native
  rrflowQL has a source for that model. Select a table and **Browse up to 50
  rows**. The displayed query is the one actually executed. A row preview is
  not a total count. Catalogue display is capped at 256 tables and reports
  truncation.
- **Records & relations** renders the engine's records and edges. Graph
  grouping and layout are presentation only.
- **Vectors** reads collections/points and asks the engine for similarity.
- **Storage engine** shows native persistence evidence and counters.

Document, relational, key/value and graph-node tables use native record reads;
record/relation/event queries additionally require their registered typed schema.
Relations, events, time series and geography use their existing native query
sources. Time-series queries select the series record kind, which may differ
from the sample table kind; choose it in the second selector. Vectors retain their existing dedicated public operations. Object
metadata and reasoning claims without an admitted row source are labelled;
no invented query or unimplemented capability is reported as working.

Multimodal storage is distinct from media understanding: metadata, content
references and embeddings may describe text/images/audio/video. Inference and
generation require their separately configured model and authorization.
PostgreSQL compatibility, cloud account synchronization and hosted devspaces
remain separate work; this bundle does not activate them.

## Build the same distribution

Use the repository's locked dependencies and pinned Rust toolchain:

```text
corepack pnpm install --frozen-lockfile
corepack pnpm engine:stage
corepack pnpm engine:check
corepack pnpm tauri:bundle
```

Engine staging builds the exact RRFlow revision in the native Cargo lock.
It is a build-time action; installed startup downloads no engine source.
For a development artifact, `corepack pnpm tauri build --debug --no-bundle
--config src-tauri/tauri.bundle.conf.json` embeds the production frontend and
builds the desktop executable. Copy the staged engine beside that executable
as `rrflow.exe` (Windows) or `rrflow` (Linux/macOS). The frontend-only browser
preview intentionally cannot launch a native engine or hold its credentials.

## Validation

Run `corepack pnpm check`, `corepack pnpm build` and `corepack pnpm test:smoke`.
Native checks are `cargo test --manifest-path src-tauri/Cargo.toml --all-targets
--locked` and strict clippy. With the staged engine's absolute path in
`RRFLOW_BIN`, run `cargo test --manifest-path src-tauri/Cargo.toml --locked
rrd::client::process -- --ignored --test-threads=1`. These tests install and
serve the real engine; the ordinary native suite intentionally ignores them.
The process corpus includes exact preview acceptance/rejection and reopen,
isolated sessions, live catalogue/record/graph/vector/storage reads, and the
digest-verified sidecar. Frontend mocks and screenshots qualify rendering only.

Known query limitation: a schemaless record table without a registered record
schema persists data but native rrflowQL currently rejects its row query as
unregistered. The UI shows that table without enabling Browse. This is a query
qualification gap, not evidence that schemaless data cannot be stored.

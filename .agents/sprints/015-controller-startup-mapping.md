# Start a project with its explicit endpoint credential mapping

Source: [parking lot 005](../parking-lot/005-controller-startup-mapping.md).
Priority P0; shared native/desktop boundary. Existing owner implementation
authorization applies; no separate owner review is claimed.

## Ordered tasks against ed6ed0e5

1. `src-tauri/src/rrd/estate.rs:225-244` currently ends the request with
   `pub installation_identity: Option<String>,`. Add a serde-default optional
   `endpoint_credentials: Option<String>`. At `preview_estate` (263) and
   `serve_estate` (455), validate optional absolute regular-file selection
   without reading its contents. In `EstateState::start` (62-104), reject a
   repeated configured start until the operator stops the existing child.
   `ServedEstateView` (370-380) currently ends `pub engine: EngineBinding,`;
   add the optional resolved mapping path. At lines 509-524, the current
   `engine_command(&executable).args(["--json", "serve", "--bind", "127.0.0.1:0", "--project"])`
   becomes a command builder with an optional `--endpoint-credentials` path
   argument. Preserve owned-child cleanup and readiness.
2. `src/types.tsx:237-263`: `EstateSelection` currently has
   `installationIdentity?: string;`; add `endpointCredentialMapping?: string`.
   `ServedEstate` currently ends `engine: EngineBinding;`; add optional/null
   `endpoint_credentials`. `src/adapter/desktop.tsx:170-195` currently destructures
   `{ project, mode, executable }`; pass the optional selection field as native
   `endpoint_credentials` in preview and serve. Saved default settings stay unchanged.
3. `src/components/ActionBar/projects.tsx:237-304` currently places the project
   `Select` immediately before `Preview or open project`. Add an optional file
   path and native file chooser, explained as engine credential mapping with
   environment values supplied before launching Connectome. Clear it whenever
   the project selection changes. Display only the path used by each owned
   engine and include it beside a pending installation preview.
4. Existing request literals at `estate.rs:764`, `client/process.rs:100,627,677,715`
   and `client/process/effects.rs:92` currently contain
   `installation_identity: None,`; add `endpoint_credentials: None,`.
   At `client/process.rs:30`, `mod values;` gains a sibling `mod startup;`.
   New startup tests drive real engine acceptance of an empty credential mapping,
   explicit stop/reopen, refusal of changed configuration while running, and
   engine rejection of malformed mapping. Native path checks cover relative,
   missing and directory inputs. These are configuration fixtures, not model
   or training data. No invented secret, provider result or task.
5. Update the native GOVERNANCE estate-command description and add
   `docs/controller-startup-mapping.md` with exact validation and remaining setup
   limits. No unrelated imports or dependencies removed. Run focused native tests,
   real-process cases, native suite/lint/format, full frontend checks and applicable
   rendered tests; preserve any failure and identify mock versus native evidence.

## Definition of done

An explicit mapping reaches the engine through the product's own startup path;
invalid inputs cannot masquerade as readiness; changed startup configuration
requires stop/start; the renderer receives paths only. Existing mapping-free
startup remains compatible. Pass local tests and retain the PR behind engine/UI
dependency landing. This is one setup prerequisite, not full task execution,
model qualification, OS secret management, a clean-machine or public release.

## Evidence follow-up

Evidence-head CI 41135105707 exposed eight JSON formatting errors after the
implementation-head checks passed. Preserve the seven raw reports as gzip with
original and compressed checksums; format the authored manifest; run full
`pnpm check` and verify every manifest hash. Keep the failed run linked in the
verification document and require the correction head's CI before landing.

## Integration onto main (2026-11-01)

The owner chose to land Connectome #24 → #25 → #26 → #27 in order. After #26
landed, this PR's base moved from `agent/controller-proposals` to `main`.
This branch merged #26's head (`01a83431`), then `main` `423a13cb` (#26 as
landed, the same tree). The engine pin is RRFlow `main` `15f36a87`, the pin
#25 and #26 landed with. It carries #227's `serve --endpoint-credentials`.

F4a (#24) replaced the registry this sprint extended with the instance
lifecycle (`rrd/estate/lifecycle.rs`), which also attaches to an instance
started elsewhere. The sprint's rules moved there, and both sides' behavior
is kept:

- **`estate.rs`:**
  - The served view keeps F4a's origin and optional engine, and gains the
    mapping path. The path is absent for an instance started elsewhere.
  - `serve_with` resolves the mapping and passes `--endpoint-credentials` to
    `rrflow serve`.
  - The preview still checks the path.
  - The old registry and its test give way to F4a's lifecycle and its
    tests. The mapping path test is kept as it was.
- **`lifecycle.rs`:**
  - `start` canonicalizes the mapping first.
  - A running engine this desktop started refuses a start that brings a
    mapping or was started with one, as before.
  - An attached instance refuses a start that brings a mapping, and so does
    one the endpoint record proves during the start, because attaching
    would drop the mapping. This is the sprint's rule ("an existing
    configured process must be explicitly stopped before applying startup
    changes; opening it remains available") applied to F4a's attach.
  - Without a mapping, such an instance still opens.
- **`projects.tsx` and `types.tsx`:** the mapping used at startup shows in
  F4a's instance row, and `ServedEstate` carries origin, an optional engine
  and the path.
- **Process tests:**
  - `client/process.rs` declares `startup` beside `quantization` and `tasks`.
  - The startup test uses F4a's status and stop. Under F4a a failed start
    keeps its failure, holding no engine, until the next start replaces it.
    The test now checks that, where it checked an empty registry.
  - F4a's `elsewhere` test now also requires a start with a mapping to be
    refused once the record proves the outside instance.
  - A unit test covers the attached case.
  - Disabling the refusal in `launch` fails the `elsewhere` test at that
    step. It was restored.
- **No credential in the webview.** The renderer holds and sends only the
  mapping's path, and shows the path the engine started with. Only the
  engine reads the file and resolves its environment values.
- **Verified locally** (Windows, engine `15f36a87`, sidecar SHA-256
  `f4a8d0b8…`):
  - `pnpm check`: 71 API reference operations; 12 engine values, 18
    checks; 45 engine queries and 3 RRFlow vectors, 100 checks;
  - `cargo fmt --check` and `cargo clippy --all-targets --locked -- -D
    warnings`;
  - 52 native unit tests: the mapping path test and the new lifecycle test
    on top of #26's 50;
  - all 20 real-engine process tests, `startup` and `elsewhere` included.
- **Native captures (Sprint 009 decision 17).** The `main` code after #26
  was compared against this branch, in both themes, with the same harness.
  Each theme has 50 pairs: 9 identical, 21 negligible, 16 dynamic and 4
  changed.
  - The four changed screens are the project engines dialog: alone,
    in the manage-engines panel, and with the project stopped and
    restarted.
  - Each gains the optional endpoint credential mapping field and "Choose
    mapping file" below Project mode, so the dialog is taller.
  - The project's row, its state, path, detail and actions are unchanged.
    No capture starts with a mapping, so the row's mapping line does not
    show.
- **Inherited screens,** with the browser harness, the same two trees, 49
  per theme: dark 23 identical, 24 negligible, 2 dynamic, 0 changed; light
  25 identical, 22 negligible, 2 dynamic, 0 changed.
- The owner's real `RRFlow/Connectome` folder was identical to its SHA-256
  snapshot after every run.

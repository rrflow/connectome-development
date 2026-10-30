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

# Endpoint credentials in desktop-owned project startup

This package follows sprint 015 and parking lot 005, based on controller UI
revision `ed6ed0e59d68fe310bf2b719fd721eee167a1c10`. The SDK/engine pin remains
`c376e27126c0fd513f8ffeb1e8e17a8befe87602`. It closes a launcher configuration
gap; complete worker execution and public release remain open.

## Behavior

In **Manage project engines**, select a project and optionally choose its engine
endpoint credential mapping file. The file must be an absolute regular-file
path. Supply its referenced environment variables before launching Connectome.
Only the engine reads the mapping and resolves credentials; the renderer receives
paths, never file contents or credential values. No provider/model choice or
endpoint profile is created by selecting a mapping.

The selection is local to this start, is shown alongside an installation preview,
and clears when the project selection changes. It is not saved as a global
default or copied into project files. Running engines show the resolved path
used at startup. Stop and restart to apply mapping or environment changes:
requesting a configured start against an already-owned process is refused,
including removing or adding a mapping. Opening the running project remains
available. Ordinary project source edits are outside this startup setting and
do not invoke this guard.

## Verification on Windows, 2026-10-30

- Native absolute/missing/directory/path-with-spaces check passed.
- Actual-engine startup case passed: empty mapping accepted; repeated configured
  start refused; malformed mapping rejected by RRFlow; failed-start reservation
  released; corrected file reopened the same instance; mapping-free startup and
  refusal to silently add credentials to a running child verified.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: 40 passed,
  17 process/helper cases intentionally ignored. Full ignored process selection
  reported 17 passed: 16 actual process cases and one inactive visual-capture
  helper. Its capture environment variables were absent. No model/worker call,
  synthetic training data, invented credential or claimed provider result.
- Strict all-target Clippy and Rust format passed. Full `pnpm check` passed,
  including 432 Biome files, 71 API examples, 18 value-model checks and TypeScript.
- Production frontend build passed. Initial browser smoke: three passed, one
  failed before application startup. Its retained trace records
  `net::ERR_NO_BUFFER_SPACE` fetching the messaging JavaScript asset; screenshot
  is blank and the static HTML title never changed. A single serialized run
  after native jobs ended passed all four cases with retries disabled and no
  existing-server reuse. This is bounded characterization, not a root-cause fix.
  These existing browser tests use mocked transport and do not render the native
  project launcher or prove controller dispatch.

The actual engine executable was independently hash-checked against the retained
sidecar manifest: 150,713,344 bytes, SHA256
`bf1f17f116246dacb4ee55c46484698b57f3184bfffe38c2d0b7d7d4207e8848`.
Local command logs/results and the initial browser trace/screenshot/video are
retained under `controller-startup-mapping` in the operator's evidence directory
for this date. Windows default text decoding initially changed four punctuation
strings; diff review restored their original UTF-8 bytes, then the native suite,
focused real-process test and strict lint/format passed again. No unrelated
imports, dependencies, SDK pins or model data changed.

Build warnings remain: vendor WASM runtime resolution/browser externalization,
mixed imports and large chunks. The previously recorded CodeMirror peer mismatch
remains unresolved; no dependency update or false-positive claim is made here.
The browser resource failure remains retained and requires attention if it recurs.
No new native GUI interaction, clean-machine, model quality, secret-store
onboarding, container or release qualification is claimed by these component tests.

# Refresh the verified controller engine pair

Source: [parking lot 004](../parking-lot/004-controller-engine-refresh.md).
Priority P0. Goal: consume the combined controller/attunement contracts and verify
that exact engine and desktop pair. Existing owner authorization applies; this is
not a new claimed owner review. Sprint 013 remains unchanged.

## Source-grounded tasks

1. `package.json:78` currently contains
   `"@rrflow/rrd-client": "github:rrflow/rrflow-development#61ddb26416811ba7e56edf2e28b8cef3acad5930&path:sdks/typescript"`.
   Replace only its revision with `c376e27126c0fd513f8ffeb1e8e17a8befe87602` and resolve pnpm-lock.yaml normally.
2. `src-tauri/Cargo.toml:47-48` currently contains
   `rrd-client = { git = "https://github.com/rrflow/rrflow-development", rev = "61ddb26416811ba7e56edf2e28b8cef3acad5930" }`
   and the same entry for `rrd-contract`. Change both revisions to `c376e27126c0fd513f8ffeb1e8e17a8befe87602`;
   resolve Cargo.lock normally. Verify no unrelated dependency updates.
3. Build `rrflow-cli --bin rrflow` from clean engine source at that revision.
   Stage an independent single-link sidecar through existing
   `scripts/engine/build-sidecar.mjs --from`, then `--check`. Preserve old artifacts.
4. `src-tauri/src/rrd/client/process/values.rs:77` owns
   `fn the_value_model_golden_matches_the_engine()`;
   at lines 159-163 it writes `src/rrflow/fixtures/engine-values.json` only with
   `CONNECTOME_WRITE_GOLDEN`. Run that real process case against the new executable,
   then format the generated JSON. No manual fixture edit or new fake model data.
5. Run native ordinary/process tests and strict Clippy/format, frontend full check
   and build. Record any surfaced failures, exact artifact hashes and source
   identities in new `docs/controller-engine-refresh.md`. Build the native preview
   from the identified source. Existing trial documents remain historical evidence.

## Acceptance

One matching engine/SDK pair; golden generated through real engine I/O; all
native/process and frontend checks pass; exact preview bytes retained. This proves
component/install interaction, not the owner project workflow, model quality,
container/installer delivery, protected dependency landing or public release.

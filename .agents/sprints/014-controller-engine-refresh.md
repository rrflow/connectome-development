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

## Integration onto main (2026-11-01)

The owner chose to land Connectome #24 → #25 → #26 → #27 in order. This
branch merged T1 (#25) and then `main` `d90c947d` (T1 as landed, the same
tree). The engine pin moves from `c376e271` to RRFlow `main` `15f36a87`,
the revision T1 landed with. It carries #206, #222 and #227.

- **Conflicts, hunk by hunk.** Both sides' behavior is kept:
  - `rrd/client.rs` and `client/process.rs` declare both sides' modules
    (`quantization` beside `tasks`).
  - `src/rrflow/session.ts` imports both sides' types.
  - `package.json`, `src-tauri/Cargo.toml` and both locks take the
    `15f36a87` pin; pnpm and Cargo leave them unchanged.
  - `engine-values.json` is the golden written from `15f36a87`.
  - The duration-aware leasing, the single-attempt client, the task
    commands and T1's quantization commands all compile and run together.
- **The harness** now captures the Tasks tab (`native-workbench-tasks`), and
  `tests/visual/PARITY.md` lists what it keeps.
- **Verified locally** (Windows, engine `15f36a87`, sidecar SHA-256
  `f4a8d0b8…`):
  - `pnpm check`: 71 API reference operations; 12 engine values, 18
    checks; 45 engine queries and 3 RRFlow vectors, 100 checks;
  - `cargo fmt --check` and `cargo clippy --all-targets --locked -- -D
    warnings`;
  - 50 native unit tests;
  - all 19 real-engine process tests, including
    `tasks::task_controls_preserve_engine_state_and_refuse_unconfigured_inference`
    and T1's quantization test.
- **Native captures (Sprint 009 decision 17).** The `main` code after #25
  (built from T1's `eed7b21b`, the same code) was compared against this
  branch, in both themes, with this branch's harness on both sides. Each
  theme has 49 pairs and 1 new screen, the Tasks tab.
  - Dark: 10 identical, 5 negligible, 16 dynamic and 18 changed.
  - Light: 10 identical, 5 negligible, 16 dynamic and 18 changed.
  - Every changed screen changes only in the workbench tab bar, which gains
    Tasks between Knowledge and Activity, and in the widths of masked
    run-dependent text. On the stopped row, a masked port of another width
    rewraps one line.
  - A first light run also lost the map's node labels on the empty
    search-generation screen. That screen's labels were present in the
    same run's Vectors lens, and a second light run drew them. It is the
    late-label timing that Sprint 009's F3 entry records.
  - Two runs of T1's build compared with 0 changed.
- **Inherited screens,** with the browser harness, the same two trees, 49
  per theme: dark 20 identical, 27 negligible, 2 dynamic, 0 changed; light
  27 identical, 20 negligible, 2 dynamic, 0 changed.
- **No credential in the webview.** The task views carry ids, titles,
  goals, statuses, cursors, budgets, digests and the proposal's choice;
  the native client keeps the bearer and the endpoint configuration.
- The owner's real `RRFlow/Connectome` folder was identical to its SHA-256
  snapshot after every run.

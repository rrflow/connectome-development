# Explicit controller protocol in the native workbench

Status: implementation locally tested; candidate CI and full desktop journey pending.
Owner: Gate H / K7 and K12 in the paired RRFlow engine package.
Baseline: `eb31a718f73c3588fbdb210567d3d4aa518ae6de`.
Engine candidate: `36dccea2c8b47f6e431078fbdbb54165546236ef`,
[PR440](https://github.com/rrflow/rrflow-development/pull/440).
Driver: this RRFlow implementation session.

The source audit found both SDK pins at `cc5ebe0fd17bd9cb1a72a0d40811ba381869d202`
and the native process fixture still constructing removed top-level selector
generation fields. The review UI does not identify its configured wire protocol.
The target is one matching typed client and a real installed native controller
journey, with configured transport displayed separately from participation.

Scope: Rust/TypeScript pins and lock files; native task Prepare projection;
frontend task review/type; source-bound process fixture; private extracted
controller/transport/review helpers; this journal and its index. Existing timeout,
budget, consent, stale-input, stop and retained-result guards must remain.
Oversized task and fixture files must shrink, not increase their ratchets.
No second engine policy, protocol fallback or private lifecycle is introduced.

Reviewed README, CONTRIBUTING, native-workbench validation, task Prepare/timeout
and assessment code, Prepared DTO, task review JSX/types, loopback HTTP helpers
and installed source-worker server fixture. This is scoped source review.
The engine prerequisite has passed its local suites and installed driver;
those results do not establish a Connectome pass. No model quality claim.

Acceptance: exact native System One path in the real-process source-worker test;
all existing source/export/staleness/readback checks; native tests/clippy/format;
frontend/source checks, production build and smoke. Keep four Cargo jobs and use
`D:/.usr/Temp/rrflow-selective-recall-audit-20261120/connectome-target` separately
from the parent engine target. No unrelated processes or files may be removed.
Stop on a material boundary gap or a required weakening of an existing oracle.

The runtime source of truth remains RRFlow. Current Connectome uses React/Tauri;
this package does not claim a Svelte migration. The user clarified a larger
prompt-to-visuals, constraints/lexicon/behavior, modular SWAG, hardware-write,
competitor parity, hosted sync and rroflow SDK/signal-manager objective. Those
are broader product requirements, not this package's completion evidence.

## Initial implementation and surfaced checks

The SDK pins now select the paired engine candidate. Task Prepare projects the
explicit protocol; the UI separates configured transport from recorded
participation. Existing timeout logic and review presentation moved into private
helpers without changing dispatch guards. The real-process fixture uses native
choice for selectors and chat for source-bound workers, retaining denial and
stale-input assertions. Smoke rendering asserts the protocol disclosure.

`pnpm install --lockfile-only` and `pnpm install --frozen-lockfile` passed with
Node 24.22.0 / pnpm 11.24.0; existing peer warnings remain. Cargo resolved the two
pinned crates. An initial `cargo test ... --lib` invocation was invalid because
Connectome is a binary target; it did not test anything. The corrected
`cargo test --locked --manifest-path src-tauri/Cargo.toml --all-targets` stopped
at the build script because the existing staged sidecar names the old revision.
`pnpm check` passed TypeScript and early checks, then correctly rejected the old
golden value fixture revision. Neither command is claimed as passed.

Acceptance scope therefore includes regenerating all three golden fixtures
through their owning real-process drivers and restaging a canonical provenance
build at the pin. No old fixture is relabelled by hand. The initial root dev
launcher `--check` succeeded and staged debug bytes, but those bytes have no
canonical source provenance and cannot qualify the bundled sidecar. The child
implementation is recorded on its open PR branch before temporarily selecting
its committed baseline to build the clean parent revision; the branch is then
restored. This avoids creating another checkout or hiding dirty source identity.

## Local integrated acceptance

Using Node 24.22.0/pnpm 11.24.0 and four Cargo jobs, the revised code passed:

- `cargo test --locked --manifest-path src-tauri/Cargo.toml --all-targets`:
  87 passed, 31 explicitly ignored process drivers.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml selected_source_worker_roundtrips_through_installed_ui_adapter -- --ignored --test-threads=1`:
  one passed in 16.61 s, native selector and source-bound chat worker.
- `CONNECTOME_WRITE_GOLDEN=1` with `cargo test --locked --manifest-path src-tauri/Cargo.toml golden_matches_the_engine -- --ignored --test-threads=1`:
  all three owning fixture writers passed in 28.34 s. Formatting restored the
  repository style; the only fixture differences are the verified engine pin.
- With writing disabled, `cargo test --locked --manifest-path src-tauri/Cargo.toml rrd::client::process -- --ignored --test-threads=1`:
  all 31 drivers passed in 436.32 s, including golden comparisons. The optional
  desktop capture seed returns without a capture target; it is not visual proof.
- `cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`:
  passed in 1m 17s.
- `pnpm check`, `pnpm build` and `pnpm test:smoke`: passed, 33 smoke tests in 1.3m.
  The existing production bundle-size warning remains. Rendering uses fixtures.

The sidecar was staged with `node scripts/engine/build-sidecar.mjs --from .../target/debug/rrflow.exe`
after `python scripts/build_rrflow.py --profile dev --target-dir .../target --output .../controller-sidecar-receipt.json`
built the clean pinned parent revision. Its digest is
`fefdf228cc16999b1d3f0074700ec6b92318e590379f7865be9c2fecb013c365`.
The process tests used this single-link staged sidecar through `RRFLOW_BIN`.
Logs are `connectome-native-restaged.log`, `connectome-controller-process.log`,
`connectome-golden-write.log`, `connectome-process.log`, `connectome-clippy.log`,
`connectome-check-regenerated.log`, `connectome-build.log`, and
`connectome-smoke.log` under the named session scratch directory.

The real desktop initially waited on a cold Vite server and then rendered without
source changes. The parent's dev launcher reused its engine Cargo target, which
put the unqualified debug engine beside the UI and caused a correct sidecar
manifest mismatch. Parent PR440 now repairs that launcher collision with a
separate UI target; native sidecar verification is unchanged here. Actual desktop
project/task acceptance is still in progress. CI for this implementation revision
has not yet run; earlier draft CI covered only the audit seed.

Additional inspected inputs: native engine resolver/build/window/main code,
Vite and Tauri configuration, golden process writers, frontend/native CI,
file-size gates, smoke fixture/worker flow and the engine's native wire codec.
The newly extracted helpers are private and hold no engine policy authority.

## Development frontend address correction

A repeated native launch showed WebView `ERR_CONNECTION_REFUSED` for localhost
while the Vite listener was bound only to `::1`. The official
[Vite server.host reference](https://vite.dev/config/server-options#server-host)
documents that browser and Node localhost resolution can select different
addresses. Earlier direct IPv6 requests also timed out, so this observation
alone does not prove the cause of every startup delay. The PR brief now includes
Tauri's development URL and Vite's bind configuration. Tauri names literal
`127.0.0.1`; Vite derives both host and port from that one configuration and
retains strict-port failure. Real desktop retry and frontend validation follow.
No browser or OS security setting was changed.

The literal-address retry still stalled, so it is not recorded as the cause or
repair of the general delay. A minimal Node HTTP service answered in 15 ms;
standalone Vite also stalled, excluding the native app as a necessary trigger.
A temporary diagnostic wrapper observed that even a ten-second event-loop timer
could not run after Vite reported listening. The repository contains 30,938 files
under its ignored `.pnpm-store` and 19,139 under `src-tauri/target`. Vite's watcher
was not excluding either tree. The
[Tauri Vite guide](https://v2.tauri.app/start/frontend/vite/) explicitly excludes
`src-tauri` from frontend watching. The correction now excludes that native tree
and the package store; Tauri retains its own Rust watcher. Neither existing tree
is deleted. This hypothesis is checked by the same diagnostic and actual launch.

With these two watcher exclusions, the same diagnostic returned `/@vite/client`
with HTTP 200 (138,122 bytes) in 47 ms and its event-loop timer ran. The real
development index subsequently returned HTTP 200 and the native window rendered.
This is a local startup observation, not a benchmark or the full project journey.
The literal-address version also passed `pnpm check`, `pnpm build`, and all 33
smoke tests. `pnpm check` on the final watcher configuration passed (exit 0),
recorded in `connectome-check-final.log` in the same scratch directory.

The operator stopped computer use before the isolated installation was applied.
The preview's engine digest differed from the parent's launcher report; exact
selection remains under investigation in parent POAM-093. No installed desktop
task or provider-quality claim follows from this preview. The real-process
source-worker test above remains the executed controller integration oracle.

The subsequent source review confirmed that startup navigation exposes only
Overview and Mini; the native area rail is inside a selected runtime project.
`node scripts/check-native-client-requirement.mjs --complete` failed on this tree:
4 inherited dependencies, 55 client importers, 289/348 capabilities not fully
native, 85 unread inherited files, 26 missing capability rows, and 66/66 visual
items unqualified. This package does not close those deficiencies. The owner
requires restoring usable startup navigation using existing route/workbench
components and actual local-engine evidence next; inventory is not parity proof.

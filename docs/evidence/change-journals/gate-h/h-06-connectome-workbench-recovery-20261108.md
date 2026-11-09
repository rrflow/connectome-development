# H-06 Connectome Workbench recovery

**Status:** In progress; no H-06 qualification or merge-readiness claim  
**PR:** [rrflow/connectome-development#45](https://github.com/rrflow/connectome-development/pull/45)  
**Candidate before integration:** `bd0223be62de3bfee724327df158000b8478986f`  
**Merged main baseline:** `4da67e27f52ef20861fd9ee8c8351ce48920f49a`  
**Integration commit:** `8cfebd206a0e5af81f6f207c1a2fea3bc687fe8c`  
**Journal update:** 2026-11-09 (Playwright isolation follow-up)

## Scope and result

The candidate was integrated with a normal two-parent merge (candidate first, main second). The 84-file React `useState` restoration was retained. Mainline remains the canonical runtime shell and engine-backed Workbench; candidate authoring and dataset-plan integration is not complete. This journal records merge and validation evidence only.

The `pnpm check` script now executes `tsc --noEmit` before Biome, with `check:types` available as a focused command. Playwright starts its own preview server using `corepack pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort`; `reuseExistingServer` is `false`.

## Validation evidence

At integration commit `8cfebd206a0e5af81f6f207c1a2fea3bc687fe8c`:

| Command | Result |
| --- | --- |
| `corepack pnpm run check:types` | Passed |
| `corepack pnpm check` | Passed; TypeScript first, Biome checked 538 files, all remaining repository gates passed |
| `corepack pnpm build` | Passed; Vite emitted WASM externalization, mixed dynamic/static import, and large-chunk warnings |
| `corepack pnpm exec biome check ...` on merge-touched frontend files | Passed |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | Passed |
| `corepack pnpm test:smoke` | 12/12 passed before server isolation; those tests stub RRD responses |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | Could not compile: this runner lacks the system `glib-2.0 >= 2.70` development package |

Playwright isolation follow-up, based on the integration commit plus this config change:

| Command or scenario | Result |
| --- | --- |
| `corepack pnpm exec biome check playwright.config.ts` | Passed |
| `corepack pnpm check` | Passed after setting `reuseExistingServer: false` |
| Occupy `127.0.0.1:4173`, then run `corepack pnpm exec playwright test` | Failed before any test started with `http://127.0.0.1:4173 is already used`; the existing server was not reused |
| `corepack pnpm build` | Passed; same Vite warnings listed above |
| `corepack pnpm exec playwright install chromium` | Installed Playwright Chromium 151.0.7922.34 (revision 1234) for this runner |
| `corepack pnpm test:smoke` | 12/12 passed against the isolated Vite preview |

During this follow-up, the first smoke attempt found no `dist/`, and a later attempt found no installed Chromium. Building the app and installing the pinned browser resolved these runner setup issues. A first nested server launch also found no global `pnpm` command; the config now invokes Corepack explicitly.

The existing smoke cases use mocked RRD responses; they are UI checks, not live-daemon integration evidence. The busy-port check establishes isolation behavior only; it is expected to fail startup when the configured port is occupied.

The original CI run `42544180903` reported frontend Biome failures and native formatting failures on macOS, Ubuntu, and Windows. CI for integration commit `8cfebd2` (`42571220909`) is `action_required` and has no jobs. No current-head candidate CI or merge-group result is claimed.

## Limits and remaining gates

- No live RRD daemon, installed real-project indexing/retrieval, benchmark parity, authenticated Drive access, or desktop end-to-end behavior was exercised.
- No final visual-baseline comparison was performed.
- Local native tests remain blocked by missing GLib development libraries.
- The final-head candidate CI and merge-group CI must be human-triggered and pass before the PR is made ready.
- Do not infer completion of H-06, POAM-011/012, or any engine qualification from these checks.

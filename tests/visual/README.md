# Visual baseline and parity harness

Sprint 009 decision 17 (the owner's rule of 2026-10-24): no inherited screen,
graph or visual is removed before its RRFlow lens reproduces or improves it.
This directory holds the evidence for that rule:

| Path | Purpose |
|---|---|
| `baseline/inherited/38142b7/{dark,light}/` | 49 captures per theme of every reachable inherited screen and state at `main` `38142b7` |
| `baseline/inherited/38142b7/manifest.json` | Revision, viewport, seed digest, capture-only patches and one entry per image with its SHA-256 |
| `baseline/native/83804c3/{dark,light}/` | Captures per theme of every RRFlow-native desktop screen and lens state at `main` `83804c3` |
| `baseline/native/83804c3/manifest.json` | Revision, viewport, engine revision, estate, determinism measures and one entry per image with its SHA-256 |
| `PARITY.md` | The visual elements and interactions each RRFlow lens must keep or improve |
| `capture-only.mjs` | Applies, then restores byte for byte, the patches that let the inherited screens open and run |
| `capture.mjs` | The capture flow: seed the in-browser Sandbox, then visit each view, mode, drawer, modal and settings tab |
| `capture-native.mjs` | The desktop capture flow: install and serve a fresh estate, seed it, then visit each workbench tab, lens, lens state, panel and settings tab |
| `compare.mjs` | Pixel comparison of two capture sets, with diff images and a report |
| `seed.surql` | The deterministic dataset the inherited engine is seeded with |

## Reproduce a capture

From this checkout, with dependencies installed, against any Connectome
worktree `<tree>`:

```sh
node tests/visual/capture-only.mjs apply <tree>
cd <tree> && VITE_FFLAG_GRAPHQL_VIEW=true VITE_FFLAG_APIDOCS_VIEW=true \
  VITE_FFLAG_V3_MIGRATION_TOOLING=true pnpm exec vite build && cd -
node tests/visual/capture-only.mjs restore <tree>
node tests/visual/capture.mjs --root <tree> --out <dir> --theme dark
node tests/visual/capture.mjs --root <tree> --out <dir> --theme light
node tests/visual/compare.mjs --before <baseline dir> --after <dir> --out <report dir>
```

The capture serves the build with `vite preview`, runs Chromium at 1440x900
with reduced motion, turns on the application's "Disable animations"
preference, fixes `Math.random`'s seed so force layouts start in the same
place, and paints query timings magenta. `compare.mjs` ignores masked pixels
and reports each pair as identical, negligible (under 0.1 percent of pixels)
or changed. Two captures of one build at `38142b7` compared 51 identical and
47 negligible, the largest 0.044 percent (the About tab's build time).

The force-directed result graph and the map are reported as `dynamic`: a
layout's final positions depend on how far code has consumed the seeded
random sequence, and map tiles load from the network. Review those by eye
for structure: the same records, edges, legend and marker.

## Reproduce a desktop capture

The RRFlow-native screens need the desktop application and a running engine.
Build a preview desktop from the worktree, so its data stays in
`RRFlow/ConnectomePreview` and never touches a user's `RRFlow/Connectome`,
and put an `rrflow` binary built from the pinned engine revision on a folder
`<engine dir>`:

```sh
cd <tree> && VITE_CONNECTOME_PREVIEW=true pnpm tauri build --debug --no-bundle && cd -
node tests/visual/capture-native.mjs --root <tree> \
  --exe <tree>/src-tauri/target/debug/connectome.exe --engine-dir <engine dir> \
  --out <dir> --theme dark
node tests/visual/compare.mjs --before tests/visual/baseline/native/83804c3/dark \
  --after <dir> --out <report dir>
```

Clear the preview data folder between runs, so each run starts from a fresh
application; the capture refuses to start while an earlier run's webview
still answers on its debugging port. The flow installs a fresh estate into
`<dir>/project` through the application's own installation preview, serves
it, seeds it with the lens fixture through the native test
`seed_served_estate_for_visual_capture` (which reads the operator credential
inside the native process; the capture passes only its path), then visits
every workbench tab, lens, graph and map state, console query, panel and
settings tab at 1440x1800 through WebView2's remote debugging port.

Times render in UTC. Only the characters that change between runs are
painted magenta: the instance identity, the loopback port, dates and times,
the clock reading a query is pinned to, durations and the capture's folder.
The words around them stay in the image. No motion, animation or randomness
override was needed. Two captures of one build compared, dark: 2 identical,
25 negligible (the largest 0.02 percent), 9 dynamic, 0 changed; light: 2
identical, 25 negligible (the largest 0.051 percent), 9 dynamic, 0 changed.
The dynamic views are the records graph states and the storage engine's live
counters, which move when the estate writes during a capture: one light run
read 12 more versions and 6 more keys than the other three, most likely an
automatic session renewal landing earlier in a slower run. The committed
baseline is the second run of each pair.

## Why the capture needs patches

The shipped application cannot reach or run these screens, which is itself
part of the baseline:

- every new connection, the Sandbox included, defaults to an RRFlow runtime
  profile (`target: "runtime"`), so "Open the Sandbox" lands on the RRFlow
  runtime page and the inherited views are reachable only from saved
  profiles that predate that field;
- `connection.tsx` and `adapter/mini.tsx` strip a `rrflow-` prefix from the
  engine's version string, which reads `surrealdb-3.0.2`, so every inherited
  connection fails with "Invalid argument not valid semver" right after it
  connects;
- `tools/mini-embed.html` lacks the `Connectome-mini` meta tag the adapter
  selector looks for, so the mini runner never starts;
- the embed generator builds its preview and copy URLs as `https://<host>/mini`,
  without the serving port.

`capture-only.mjs` undoes the first three in a working tree, so the captures
show these screens as they look when they work. It changes no visual code and
is never committed to a product tree. The fourth is recorded, not patched: the
mini runner is captured from its built page.

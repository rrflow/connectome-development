# Visual baseline and parity harness

Sprint 009 decision 17 (the owner's rule of 2026-10-24): no inherited screen,
graph or visual is removed before its RRFlow lens reproduces or improves it.
This directory holds the evidence for that rule:

| Path | Purpose |
|---|---|
| `baseline/inherited/38142b7/{dark,light}/` | 49 captures per theme of every reachable inherited screen and state at `main` `38142b7` |
| `baseline/inherited/38142b7/manifest.json` | Revision, viewport, seed digest, capture-only patches and one entry per image with its SHA-256 |
| `PARITY.md` | The visual elements and interactions each RRFlow lens must keep or improve |
| `capture-only.mjs` | Applies, then restores byte for byte, the patches that let the inherited screens open and run |
| `capture.mjs` | The capture flow: seed the in-browser Sandbox, then visit each view, mode, drawer, modal and settings tab |
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

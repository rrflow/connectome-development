# GOVERNANCE REGISTRY — Connectome (Root)

> **Status**: ACTIVE | **Date**: 2026-08-21 | **Classification**: PUBLIC ALPHA

---

## Ownership & Identity

| Property | Value |
|----------|-------|
| **Project** | Connectome |
| **Owner** | Jesse Hall (Hades) |
| **Parent** | [RRFlow engine repository](https://github.com/rrflow/rrflow-development) (optional `connectome/` submodule; [integration PR](https://github.com/rrflow/rrflow-development/pull/20)) |
| **AI Product** | Clyffy — local and frontier AI harness managed through this control surface |
| **Data Architecture** | RRFlow — persistent reasoning runtime, storage, query, and lifecycle kernel |
| **Fork Source** | rrflow/connectome |
| **Classification** | PUBLIC ALPHA |
| **Purpose** | Native instance connector, data/model explorer, live observatory, and visual debugger for RRFlow |

### Product Architecture

| Layer | Role |
|-------|------|
| **RRFlow** | Engine umbrella — runtime, storage, query execution, lifecycle, and observability |
| **Vyrm** | Persistent LSM/columnar engine evolved inside RRFlow |
| **Connectome** | Separate Tauri desktop client, pinned at `connectome/` in RRFlow |
| **Clyffy** | AI harness/operator that consumes RRFlow through Automaton and LFG workflows |

### What This Tool IS

Connectome is the native control plane for **RRFlow instances**. It is simultaneously:

1. **Instance client** — Store profiles and connect to local or remote RRFlow runtimes
2. **Visual IDE** — Query data, inspect records, and design schemas and relationships
3. **Live observatory** — Grow into trace, reasoning-run, storage, and lifecycle visualization
4. **Step debugger** — Freeze, inspect, rewind, and compare runtime events as those APIs land

**User #1**: Jesse (you) — building MAESTRO, needs to see everything working
**User #2**: Future junior developers — need to inherit this codebase and understand it

### Boundary Rule

Connectome must remain a separately buildable Windows/macOS/Linux application. The RRFlow repository owns it through a git submodule; Connectome communicates with deployed RRFlow instances through versioned protocols and capability negotiation. An embedded diagnostic page may exist in the engine, but it is not a replacement for Connectome.

---

## Agent Workflow Protocol

All changes to this codebase follow the **Parking Lot → Sprint → Author → Verify** pipeline:

1. **Parking Lot** — Conflicts, design decisions, ambiguity enter here first. Discussed, not solved. Multiple options presented. See `.agents/skills/parking-lot/SKILL.md`
2. **Sprint** — Committed decisions from parking lot become sprint tasks. Tasks are written verbatim against existing source code. See `.agents/skills/sprint-authoring/SKILL.md`
3. **Author** — Code is written per sprint tasks. COSTAR compliance enforced. Import safety rules apply. See `.agents/skills/costar-compliance/SKILL.md` and `.agents/skills/import-safety/SKILL.md`
4. **Verify** — Biome checks, tsc checks, all warnings addressed. False positives documented here. See `.agents/skills/verification/SKILL.md`

---

## Biome Rule Overrides (Acknowledged)

The following Biome rules are intentionally disabled in `biome.json`. Each has been reviewed and acknowledged in this governance registry rather than silently re-enabled.

| Rule | Status | Rationale |
|------|--------|-----------|
| `a11y/useSemanticElements` | `off` | Desktop app — not a public web page. Devtool UI uses custom components extensively. |
| `suspicious/noExplicitAny` | `off` | Inherited from Connectome. Parking lot item — should be progressively tightened as we refactor. |
| `suspicious/noThenProperty` | `off` | RRFlow SDK uses `.then` patterns on result objects. Cannot remove without breaking SDK usage. |
| `suspicious/noMisleadingCharacterClass` | `off` | Inherited. Used in RRFlowQL regex patterns. |
| `suspicious/noArrayIndexKey` | `off` | Inherited. Used in list rendering where items lack stable IDs. Should be revisited per-component. |
| `style/noUnusedTemplateLiteral` | `off` | The `urql` schema parser triggers this. |
| `style/useImportType` | `off` | Inherited. TypeScript `import type` enforcement conflicts with some patterns. |
| `correctness/noUnusedImports` | `warn` | Warning, not error. Subject to Import Safety Skill rules — unused imports are NOT removed until source is verified to exist. |

---

## Baseline Audit

> **Date**: 2026-03-28

The initial fork was validated for build stability and baseline lint status:
- **Package Manager Migration**: Migrated to `pnpm` (with strictly local `store-dir` and `node-linker=hoisted`) due to Windows bundling failure with `bun`.
- **Inherited Fixes**: Resolved TS2322 block in `src/util/mantine.tsx`.
- **Biome Baseline**: 1,108 formatting errors autofixed. 0 runtime/logic warnings remaining.
- **TypeScript Baseline**: `tsc --noEmit` cleanly passes with 0 errors.
- **Tauri Build**: `pnpm run build` succeeds cleanly.

The codebase starts entirely green for Phase 1.

---

## False Positive Registry (Global)

| ID | File | Rule | Reason | Date |
|----|------|------|--------|------|
| _No entries yet. Entries are added after verification confirms a warning is a false positive._ | | | | |

---

## Boundary Governance Index

| Boundary | File | Scope |
|----------|------|-------|
| Root (this file) | `GOVERNANCE.md` | Project identity, agent protocol, biome overrides, global false positives |
| Frontend | `src/GOVERNANCE.md` | Component naming, store patterns, import safety |
| Backend | `src-tauri/GOVERNANCE.md` | Cargo deps, Tauri plugins, Rust lint exceptions |
| Components | `src/components/GOVERNANCE.md` | Folder structure, props naming, re-exports |
| Stores | `src/stores/GOVERNANCE.md` | Zustand patterns, state shape, cross-store deps |
| Screens | `src/screens/GOVERNANCE.md` | View registration, routing, terminology |

---

## Terminology

This project uses **platform-aligned terminology**. See `docs/roadmap/clyffy/terminology-engine.md` for the full glossary and progressive disclosure system.

Key terms used in governance:
- **Spoke** — A hypermodular feature directory under `src/spokes/` (future structure)
- **Hub/Shell** — The Tauri desktop shell that hosts all spokes
- **Bridge** — Tauri IPC layer between React frontend and Rust backend
- **SSOT** — Single Source of Truth (e.g., pipeline config is SSOT, visual graph is projection)
- **COSTAR** — Context, Objective, Style, Tone, Audience, Response — the framework for completeness

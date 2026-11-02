# Parking Lot 005 — RRFlow UI reference and Connectome experience

**Status**: COMMITTED — Option B  
**Date**: 2026-09-16  
**Source**: Operator clarification that Connectome is one cohesively authored
UI and the existing RRFlow UI is reference material  
**Committed**: 2026-09-16  
**Rationale**: The operator explicitly requires a quality-of-life workbench a
senior developer can scan quickly and drill into for exact evidence. Existing
RRFlow UI behavior must inform that product, but must not become a second UI,
an embedded application, a source dependency, or a compatibility tier.

## COSTAR profile

- **Context**: Connectome currently has an honest public-bootstrap screen and a
  broad inherited renderer. RRFlow also contains a client-only reference
  workbench plus preserved behavior inventories. Earlier architecture language
  incorrectly described current source as a separate product tier.
- **Objective**: Build one authored Connectome desktop experience that really
  configures and operates RRFlow, gives a senior developer fast situational
  awareness, and supports progressive drill-down to raw contracts, identifiers,
  traces, receipts, stamps, and failure evidence.
- **Style**: Feature-oriented modular monolith, progressive disclosure,
  information-dense but readable developer tooling, canonical RRFlow names,
  keyboard-efficient navigation, and typed public-contract boundaries.
- **Tone**: Methodical, evidence-first, and quality-focused. Preserve proven
  workflows without copying accidental implementation constraints.
- **Audience**: Senior operators and developers first; less-expert operators
  must still understand state, scope, risk, and required next actions.
- **Response**: Record the reference contract now, then inventory and reauthor
  one vertical UI slice at a time with parity and real-operation evidence.

## What

Decide how RRFlow's existing Connectome workbench and preserved embedded-client
behaviors inform the standalone Connectome product.

## Where

- `../rrflow-g02-w01/crates/connectome-ui/static/index.html:12-29` defines the
  reference navigation: Overview, Models, Graph, Activity, Capabilities, Query,
  and Raw Snapshot over a selected instance.
- `../rrflow-g02-w01/crates/connectome-ui/src/lib.rs:71-175` demonstrates the
  required client boundary: authenticated sessions and typed RRD operations,
  without opening physical stores.
- `../rrflow-g02-w01/crates/connectome-ui/migration/README.md:3-22` inventories
  prompt flights/replay/context/traces, cluster telemetry, and connection
  negotiation behavior that must not be replaced by placeholders.
- `src/screens/connectome/pages/RuntimeConnection/index.tsx:23-239` is the
  current honest Connectome bootstrap surface, but it stops before authenticated
  session and operational drill-down.
- `README.md:14-42` describes the current product truth and identifies existing
  query, graph, schema, profile, and diagnostic UI as source material.
- `docs/reference/engineering/architecture.md:20-60` defines the supported
  product and source boundaries but needs this reference relationship stated.

## Why

Three materially different implementation paths are possible. Choosing the
wrong one would either discard useful RRFlow product knowledge, copy a narrow
embedded UI as the final design, or couple Connectome's release boundary back
to the engine checkout.

## Options

### Option A — source port and visual parity

- **Description**: Port the RRFlow HTML/CSS/JavaScript workbench directly into
  the Tauri renderer, preserving its layout and implementation closely.
- **Pros**: Fast visible parity and low initial design effort.
- **Cons**: Copies embedded-client constraints, duplicates source, and makes
  the reference UI—not Connectome's product needs—the architecture authority.
- **Impact**: Broad renderer rewrite and likely duplicate state/data layers.
- **Effort**: Medium initially; high correction cost later.

### Option B — reference-driven reauthoring (committed)

- **Description**: Treat RRFlow's UI and behavior inventory as a product
  reference corpus. Preserve workflows, information, evidence semantics, and
  useful interaction patterns; reauthor each slice in Connectome's component,
  feature, native-adapter, and design system boundaries. Consume only pinned
  public RRFlow artifacts at runtime/build time.
- **Pros**: Produces one cohesive desktop UI, retains proven operator value,
  supports deeper drill-down, and preserves independent builds/releases.
- **Cons**: Requires an explicit reference inventory and parity criteria before
  each slice; visible progress is intentionally incremental.
- **Impact**: Governs every future Connectome feature slice and its tests.
- **Effort**: Medium per vertical slice.

### Option C — embed or package the RRFlow workbench

- **Description**: Load the RRFlow workbench as an embedded page, submodule, or
  sibling/package source dependency inside Connectome.
- **Pros**: One upstream implementation and rapid reuse.
- **Cons**: Creates two UI systems, weakens native security/composition, couples
  releases, and violates the independent repository boundary.
- **Impact**: Engine and Connectome builds, security, navigation, and styling.
- **Effort**: Small prototype; large long-term integration burden.

## Committed product contract

1. Connectome is the only user-facing product UI in this repository.
2. RRFlow's workbench is reference input, not runtime UI, copied source, or a
   release dependency.
3. Every major view supports three depths where the contract has evidence:
   summary and next action; structured operational detail; raw authoritative
   identifiers/payloads/traces/receipts/stamps.
4. UI state never upgrades evidence. Reachability, readiness, authentication,
   authorization, mutation, persistence, and recovery remain distinct states.
5. Configuration writes cross a typed native/application boundary, enforce the
   selected scope, and show the engine/native result. A form changing local
   renderer memory is not a completed configuration operation.
6. Reference behavior is inventoried before implementation and accepted only
   when the Connectome slice has equivalent-or-better workflow coverage plus
   its declared unit, renderer, native, contract, or installed-process evidence.
7. Unsupported reference operations remain visible in the inventory with their
   missing public contract; they are not replaced by plausible placeholder UI.

## Transfer

- Sprint 009 records this relationship in active governance and architecture
  vocabulary only; it adds no feature UI.
- Sprint 010 inventories the RRFlow reference views and authors the cohesive
  Connectome information architecture before the first vertical UI slice.
- Subsequent implementation sprints reauthor one real slice at a time, starting
  with Runtime Overview and preserving C0 evidence truth.

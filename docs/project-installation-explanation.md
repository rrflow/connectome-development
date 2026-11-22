# Explain the installed database before filesystem details

Package brief, baseline `36d388e919c27de7b72fbccb3d7e7af7bbb71030`.
Parent engine delivery: rrflow/rrflow-development#494, H-06 and the installed
bitemporal database proof. One child candidate owns these UI files.

The real desktop currently leads with thirteen managed paths, including
temporary installation files, before explaining the database or server. This
is an observed usability failure, not evidence of thirteen logical records.
The underlying engine plan already provides the storage profile, instance
identity, storage-root path and project locator. Render those actual fields;
unknown fields must not fabricate a database, port or capability.

Read: installation-facts.ts, installation-summary.tsx,
scripts/check-installation-facts.mjs and docs/native-workbench.md; project-row
installation consumer and project-manager/native startup path inspected.
Scope: these presentation/fact projection files, their existing focused check,
and this evidence record. No engine authority, install plan, permissions,
schema, lifecycle, transport or credential changes.

Oracle: preview a real installation in the desktop; show its native persistent
database location and local-server startup, retain exact managed paths and raw
plan on demand. Existing facts tests must preserve unfamiliar-plan behavior;
run pnpm check and build, then inspect the actual desktop. This is a UI repair,
not database capability/parity proof. Stop on invented facts or altered effects.

Validation: `node --experimental-strip-types scripts/check-installation-facts.mjs`,
`pnpm check` and `pnpm build` passed on Windows. Existing build warnings concern
inherited WASM/browser imports and large chunks; the native-parity checker still
reports 289/348 capabilities incomplete and 66/66 visual comparisons unqualified.
Those limits are unchanged. The actual desktop, served by Vite over native
Tauri/RRD, displayed the real plan for an isolated preview-only directory:
storage root `.rrflow/rrd/roots/install-6fa5498caa70de74b9616a94`, locator,
local-server behavior, and all 13 paths in the expandable list. Cancel left that
directory uninstalled. Screenshot retained at
`D:/.usr/Temp/rrflow-bitemporal-validation/connectome-installation-preview.png`.
Full changed-file/diff review completed; no source capability or install effect
changed. Candidate and merge-queue gates remain required.

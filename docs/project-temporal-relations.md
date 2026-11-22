# Temporal relationship rules in the desktop

Status: active paired package; installed verification pending.
Parent: rrflow/rrflow-development PR496, H-08, POAM-072/073.
Baseline: Connectome main 9d8b9ebe03f102c188cecf82d64227200095c86a.

## Change brief before implementation

The engine adds native per-endpoint REJECT/CASCADE rules. Connectome currently
pins the preceding public SDK contract and would correctly refuse the new
engine's readiness. Its table view also has no readable explanation of those
rules. Update the Rust and TypeScript SDKs together to the published parent
source, regenerate their lockfiles and the existing engine-produced golden
fixtures. Keep exact readiness checks. Add a read-only relationship-rule panel
to Tables using the existing authenticated schema response. Display the source
and target rules, schema revision and knowledge cursor, including explicit
unavailable/error states. The engine remains the only policy executor.

Read: README, package.json, src-tauri/Cargo.toml, scripts/dependency-authority.mjs,
src/rrflow/session.ts schema interface, src-tauri/src/rrd.rs schema projection,
src/features/runtime/tables/tables-view.tsx and row-query.ts. Scope is those
manifest/lock bindings, their generated fixtures, the table presentation and
this record. No cloud, provider, policy authoring or inherited feature parity
is implied.

Driver: parent scripts/dev/bitemporal_proof.py installs and writes a native
project, verifies rejection/cascade at two temporal coordinates, kills and
reopens the server. The same engine build and retained project must open in
Connectome and show its real schema rules and historical/current query results.
Also verify slash and backslash spellings identify the same installed project.
No user project is reset or installed for this test.

Acceptance: dependency-authority gate; frontend type/lint/build checks;
real-process golden write then verification; native tests; actual desktop
readback; candidate and merge-group CI. Record commands, failures, skipped
checks and exact revisions below. Stop on mismatched readiness, fabricated
policy, lost historical data or an unresolved engine refusal. This UI work
cannot close the parent engine objective by itself.

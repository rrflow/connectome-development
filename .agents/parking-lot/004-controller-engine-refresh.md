# Refresh the controller's engine dependency

Status: COMMITTED, 2026-10-30. This is a dependency refresh within the owner's
standing instruction to implement and verify the complete workflow. It does not
claim a separate owner review of this record. Prior decision: parking lot 003.

## Decision and source

Connectome PR26 at 9f705052 pins the older native and TypeScript SDKs. Engine PR222
now unifies controller and landed source-replan bindings at c376e27126c0fd513f8ffeb1e8e17a8befe87602.
The current pins are `package.json:78` and `src-tauri/Cargo.toml:47-48`:
`61ddb26416811ba7e56edf2e28b8cef3acad5930`. The value fixture's engine identity is also the old revision.

Options considered:

1. Refresh both SDKs, build the exact engine, regenerate the fixture through real
   process I/O, and verify/build the desktop. Small dependency scope, real process
   evidence, requires a new build. Chosen within existing implementation authority.
2. Keep the old pair until all engine PRs land. Avoids immediate build work but
   leaves this draft disconnected from the combined controller/replan contracts.
3. Update the fixture's revision without engine I/O. Less work but invalid evidence;
   rejected. No previous binary or model result can be relabelled.

Affected files: package.json, pnpm-lock.yaml, src-tauri/Cargo.toml, Cargo.lock,
engine-values.json, and a new refresh report. Generated sidecar/build outputs stay
outside committed source. Existing receipts, screenshots and journals remain tied
to their original sources. No UI plan, routing defaults or training data changes.

COSTAR carries forward from 003: engine-owned authority, native credentials,
existing styling, evidence before claims, owner/contributor audience, code and
verification report. Stop on semantic contract mismatch or unexpected dependency
changes; record and resolve at the owning boundary. Keep draft behind engine
PR206/222 and protected CI. Full worker/replan/outcome learning remains unfinished.

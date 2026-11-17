# Branch absorption ledger

**Status:** active working record; claims only what is stated per row
**Opened:** 2026-11-17

One branch of record for Connectome is `main`. Every other branch on
`rrflow/connectome-development` is listed here until its features are either on
`main` (read, with a file) or deliberately retired by the owner. A branch is not
retired by a diff count, ancestry, a path match or a patch-id; those only say a
commit's text exists somewhere. The evidence levels are **Read** (the branch
code and its counterpart on `main` were read), **Tested** (a check that fails
without the feature passes on `main`) and **Not read** (no claim).

## `agent/rrflow-native-connectome` (tip `8a9eb5e5`, base 2026-10-16)

Design record: its own `docs/rrflow-native-rewrite.md`, read in full.

| Capability on the branch | On `main` | State |
|---|---|---|
| Knowledge-tree bridge, project/instance/capability binding (`rrd/client/knowledge.rs`) | Absent before PR #68 | Read; ported in PR #68; `cargo test knowledge` 2 passed |
| Knowledge model: three-way draft rebase by immutable id, conflict retention, cycle/orphan repair (`src/rrflow/knowledge.ts`) | Absent before PR #68 | Read; ported in PR #68; 9 tests pass |
| Knowledge editor tab (`RuntimeConnection/tabs/knowledge.tsx`, 1,358 lines) | Absent | Read for its role only; **port pending** after PR #67 (routes move) |
| SSH-forwarded existing profile (`rrd/ssh_forward.rs`, 460 lines, 5 tests; `runtimeSshHost` in the connection form, serving action and runtime client) | Absent | Rust module read in full; **port pending** after PR #67 |
| Authored native client, values, editor (`src/rrflow/client`, `editor`, `ui`) replacing the inherited client, editor and icon packages | `main` still carries the inherited wrappers (`src/vendor/rrflow-client.ts`, `src/vendor/rrflowql-editor.ts`, `rrflowql/v2.tsx`, `rrflowql/v3.tsx`) by its own header comments, used by 20+ components | Wrappers read; the authored replacements are **not yet read file by file**. They move with the view re-authoring (sprint 009 Slice D), not before |
| 19 and 28 behaviour tests, editor and UI tests | Not compared | **Not read** |
| 212 cloud, assistant and support files it rewrote | Deleted on `main` (cloud strip) | Path-level only; **not read** |

## Branches not yet read

These carry a status from a patch-id or path check only, which is **not** an
absorption claim. Each gets its own row after it is read.

| Branch | Tip | Check done | Claim |
|---|---|---|---|
| `agent/rrflow-serve-spine` | `a964caf4` | patch-id present on `main` | none |
| `agent/rrflow-serve-spine-b` | `51110ed1` | patch-id not found | none; `main` still has "Unknown RRD connection error" at `src/rrflow/runtime.ts:68` |
| `agent/rrflow-serve-spine-c` | `a83acc8a` | patch-id present on `main` | none |
| `agent/rrflow-serve-spine-d` | `6ab1e963` | patch-id present on `main` | none |
| `agent/connectome-cloud-strip` | `b054cbbc` | patch-id present on `main` | none |
| `agent/connectome-icons` | `b522202a` | patch-id present on `main` | none |
| `agent/connectome-ownership` | `6acb8d05` | patch-id present on `main` | none |
| `agent/connectome-rrd-only` | `58a3aeae` | patch-id not found; deletes 58 components `main` still has | none; a work in progress that conflicts with the restored August views until read |
| `codex/task-assessments` | `52c3a5eb` | patch-id present on `main` | none |

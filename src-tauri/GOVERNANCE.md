# GOVERNANCE REGISTRY — Rust Backend (src-tauri/)

> **Boundary**: `src-tauri/` | **Date**: 2026-03-27

---

## Scope

This governance file covers the Tauri 2 Rust backend. All Tauri commands, event emitters, plugin registrations, and Cargo dependencies are governed here.

## Cargo Dependency Rules

- All dependencies are pinned to explicit versions in `Cargo.toml`
- New dependencies require a parking lot discussion before adding
- Platform-specific dependencies use `[target.'cfg(...)'.dependencies]` sections
- Current platform deps: `cocoa`/`objc` (macOS), `openssl` vendored (Linux)

## Tauri Plugin Registration

Currently registered plugins:
- `tauri-plugin-fs` (filesystem access)
- `tauri-plugin-os` (OS info)
- `tauri-plugin-log` (logging)
- `tauri-plugin-shell` (shell commands)
- `tauri-plugin-dialog` (native dialogs)
- `tauri-plugin-process` (process management)
- `tauri-plugin-updater` (auto-update — will need endpoint change)
- `tauri-plugin-deep-link` (URL scheme handling)
- `tauri-plugin-localhost` (local server)
- `tauri-plugin-single-instance` (prevent multiple instances)

## RRD commands

Every authenticated RRD command goes through `src/rrd.rs`. It names a project
connection handle (`profile`), and RRFlow's Rust SDK (`rrd-client`) validates
each request and response. The webview receives view projections
(`src/rrd/view.rs`, `view/effect.rs`, `view/history.rs`). It never receives the
operator credential, a session bearer, or an engine-clock expiry instant.

- **Estates:** `rrd_estate_preview`, `rrd_estate_serve`, `rrd_estate_status`,
  `rrd_estate_stop`; and `rrd_public_request` for public read-only paths.
- **Sessions:** `rrd_connect`, `rrd_session`, `rrd_disconnect`.
- **Tasks:** `rrd_task` accepts a closed, typed action enum for task listing,
  opening/readback, budget configuration/readback/Stop, proposal preparation,
  explicit proposal dispatch and attempt readback. Task scope comes from the
  native instance. `client/tasks.rs` projects bounded views and excludes endpoint
  credentials/profile contents. Controller requests use the configured timeout
  plus bounded transport margin and a shared session lease. No mutation is
  automatically retried. A local preflight refusal is explicitly not dispatched;
  a transport failure requires engine readback. Preparation grants no worker effect.
- **Reads:**
  - `rrd_capabilities`, `rrd_schema`, `rrd_database`, `rrd_storage`,
    `rrd_query`;
  - `rrd_vector_collections`, `rrd_vector_points`, `rrd_vector_search`,
    `rrd_vector_map`.
- **Changes:** `rrd_change_preview`, `rrd_change_commit`,
  `rrd_change_discard`.
  - A preview returns an opaque handle.
  - A commit names only that handle and the digest the operator approved.
  - The previewed mutations stay native, and they are what is committed.
- **History:** `rrd_changes`, `rrd_changes_follow`, `rrd_audit`.
- **Exports:** `rrd_query_export`, `rrd_audit_export`, `rrd_artifact_save`.
  The verified file stays native under an opaque handle until the native
  save dialog writes it; the webview never names a path.
- **Backups:** `rrd_backups`, `rrd_backup_create`, `rrd_backup_restore`.
  A restore stages a verified root beside the estate and never replaces it.

- **Live results:** `rrd_live_open`, `rrd_live_close`.
  - Each live subscription is a durable engine subscription, delivered over
    its own `/v1/ws` socket. Its events go to a channel.
  - A delivery is acknowledged only after it has been handed over.
  - The socket reconnects when the session renews, which rotates its bearer.
    When the session is replaced, a new subscription continues after the last
    cursor handed over.
  - At most eight are open per connection.

## Rust Lint Exceptions

| Rule | Status | Rationale |
|------|--------|-----------|
| _No entries yet_ | | |

## False Positive Registry

| ID | File | Rule | Reason | Date |
|----|------|------|--------|------|
| _No entries yet_ | | | | |

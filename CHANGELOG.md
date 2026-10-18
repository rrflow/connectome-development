# Connectome changelog

The in-application "Release changelogs" entries live in
`src/shared/assets/changelogs/<version>.md`; this file is their summary.
`package.json` owns the version and the maturity channel (`pnpm version:check`,
`pnpm version:set <version> [channel]`); the version stays at 0.0.5 alpha until
Connectome works end to end.

## 0.0.5 alpha — 2026-10-18

The first version Connectome numbers as its own.

- Native Windows, macOS, and Linux control surface for RRFlow, at
  `github.com/rrflow/connectome-development`, a sibling of
  `rrflow/rrflow-development` bound by one pinned engine revision.
- One contracted engine pin in `src-tauri/Cargo.lock`, consumed by the native
  client, the generated TypeScript SDK, the staged `rrflow` sidecar, CI, and
  the About tab, with a gate that fails on any disagreement.
- Start serving runs RRFlow's contracted install → serve → ready sequence and
  shows each stage; the bundled sidecar runs only when its digest matches.
- The public RRD handshake runs on the generated `@rrflow/rrd-client` SDK.
- Database, vector, graph, and rrflowKV storage lenses read live state through
  the native RRD client.
- Licensed MIT by AngryVibes LLC; the notice for the portions still derived
  from the inherited client is preserved in `NOTICE`; an identity gate forbids
  the inherited vendor's name outside declared dependency identifiers, the
  `src/vendor/` seam, and the notices.
- The inherited vendor's hosted-service surface deleted, not renamed: cloud
  account, organization, billing, support and referral pages; instance
  dashboard and monitoring views; the assistant; the newsfeed; support chat;
  analytics tracking and the native command that carried it; 221 files and
  twelve dependencies.

Still inherited and scheduled for removal rather than renaming (sprint 009):
the inherited UI kit, and the views that still run on the inherited query
client.

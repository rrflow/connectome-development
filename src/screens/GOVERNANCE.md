# GOVERNANCE REGISTRY — Screens (src/screens/)

> **Boundary**: `src/screens/` | **Date**: 2026-03-27 | **Updated**: 2026-10-24 (sprint 009 Slice D0)

---

## Scope

Governs the 2 screen directories and the 9 views + 7 pages within the main connectome screen. On 2026-10-18 (sprint 009, Slice B) the inherited vendor's hosted-cloud surface was deleted: the auth-callback screen, the dashboard, monitor and sidekick views, the eight cloud/organization pages, and the metrics charts; Slice C2 deleted the unmounted new-domain screen (the vendor's domain-move notice). Every remaining view still runs on the inherited query client. Sprint 009 decision 18 (2026-10-27) re-authors each view in place onto the RRD SDK, keeping its layout and components; a view becomes reachable in the desktop app only once it runs on RRFlow. On 2026-10-24 (Slice D0) the mini runner and its embed generator were kept, by the owner's no-visual-regression rule: the mini adapter now loads the inherited engine, client and message channel on demand, so the shared adapter selector no longer loads them into every RRFlow page.

## Current Screen Structure

```
src/screens/
├── mini-embed/         # Embeddable mini query editor
└── connectome/         # Main application screen
    ├── components/     # Screen-specific shared components
    ├── connection/     # Connection management
    ├── docs/           # Documentation viewer
    ├── pages/          # Overview, connection, runtime and embed pages (7)
    └── views/          # Feature views (9)
```

## View Inventory (9) → Slice D disposition

| View | Purpose | Runs on today | Slice D |
|------|---------|---------------|---------|
| authentication | Users and access methods | inherited client | RRD or delete |
| designer | Schema designer | inherited client | RRD or delete |
| documentation | Docs viewer | inherited docs | RRD reference |
| explorer | Table/record explorer | inherited client | RRD |
| functions | Function editor | inherited client | RRD or delete |
| graphql | GraphQL playground | inherited client | delete |
| migration | Schema migration | inherited client | delete |
| parameters | Variable editor | inherited client | RRD or delete |
| query | Query editor | inherited client + WASM | RRD (RRFlowQL studio) |

Deleted 2026-10-18: `dashboard` and `monitor` (the vendor's hosted-instance dashboard and monitoring, gated to cloud connections) and `sidekick` (the vendor's assistant).

## Page Inventory (7)

| Page | Purpose |
|------|---------|
| ControlPlane | Optional enterprise control-plane profile |
| CreateConnection | New runtime profile or served estate |
| NewEmbed | Mini embed generator |
| Overview | Hero, runtime profiles, resources |
| Placeholder | Empty-state placeholder |
| RuntimeConnection | RRD handshake and session |
| RuntimeDiagnostics | RRD diagnostics lenses |

Deleted 2026-10-18: CreateOrganization, OrganizationDeploy, OrganizationManage, Organizations, Referral, Signin, Support, SupportPlans — the vendor's hosted-cloud account, billing, support and referral pages, none of which was routed.

## Terminology

- **Screen**: A top-level entrypoint (connectome, mini-embed)
- **View**: A feature tab within the main screen (query, explorer, designer...)
- **Page**: A routed page of the main screen outside the connection views

## False Positive Registry

| ID | File | Rule | Reason | Date |
|----|------|------|--------|------|
| _No entries yet_ | | | | |

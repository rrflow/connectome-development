# GOVERNANCE REGISTRY — Screens (src/screens/)

> **Boundary**: `src/screens/` | **Date**: 2026-03-27 | **Updated**: 2026-10-24 (sprint 009 Slice D0)

---

## Scope

Governs the 2 screen directories and the 9 views + 6 pages within the main connectome screen. On 2026-10-18 (sprint 009, Slice B) the inherited vendor's hosted-cloud surface was deleted: the auth-callback screen, the dashboard, monitor and sidekick views, the eight cloud/organization pages, and the metrics charts. Every remaining view still runs on the inherited query client and moves onto the RRD SDK or is deleted in Slice D. On 2026-10-24 (Slice D0) the mini runner screen and its embed generator page were deleted: they ran the inherited engine in the browser, RRFlow has no browser deployment yet, and the shared adapter selector loaded that engine into every RRFlow page.

## Current Screen Structure

```
src/screens/
├── new-domain/         # Domain redirect handler
└── connectome/         # Main application screen
    ├── components/     # Screen-specific shared components
    ├── connection/     # Connection management
    ├── docs/           # Documentation viewer
    ├── pages/          # Overview, connection and runtime pages (6)
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

## Page Inventory (6)

| Page | Purpose |
|------|---------|
| ControlPlane | Optional enterprise control-plane profile |
| CreateConnection | New runtime profile or served estate |
| Overview | Hero, runtime profiles, resources |
| Placeholder | Empty-state placeholder |
| RuntimeConnection | RRD handshake and session |
| RuntimeDiagnostics | RRD diagnostics lenses |

Deleted 2026-10-18: CreateOrganization, OrganizationDeploy, OrganizationManage, Organizations, Referral, Signin, Support, SupportPlans — the vendor's hosted-cloud account, billing, support and referral pages, none of which was routed.

## Terminology

- **Screen**: A top-level entrypoint (connectome, new-domain)
- **View**: A feature tab within the main screen (query, explorer, designer...)
- **Page**: A routed page of the main screen outside the connection views

## False Positive Registry

| ID | File | Rule | Reason | Date |
|----|------|------|--------|------|
| _No entries yet_ | | | | |

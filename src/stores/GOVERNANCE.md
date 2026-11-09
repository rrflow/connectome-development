# GOVERNANCE REGISTRY — Stores (src/stores/)

> **Boundary**: `src/stores/` | **Date**: 2026-03-27 | **Updated**: 2026-10-18 (sprint 009 Slice B)

---

## Scope

Governs the 2 Zustand state stores that remain here. The inherited Cloud, Deploy and Sidekick stores were deleted on 2026-10-18 (sprint 009, Slice B); the shell stores live in `src/shell/stores/`.

## Current Store Inventory

| Store | File | Purpose | Phase 1 Destination |
|-------|------|---------|-------------------|
| Database | `database.tsx` | RRFlow connection, served-estate and lens state | RRFlow spoke |
| Query | `query.tsx` | Active query state | RRFlow spoke |

Deleted 2026-10-18: `cloud.tsx` (inherited vendor's hosted-cloud account state), `deploy.tsx` (its instance deployment flow), `sidekick.tsx` (its assistant). Nothing replaces them; Clyffy arrives with the prompt → frontier AI → rrflowKV increment (sprint 009, Slice D).

## Zustand Store Pattern

```typescript
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface StoreState {
  // State shape
}

export const useStoreName = create<StoreState>()(
  immer((set, get) => ({
    // Initial state + actions
  }))
);
```

## Cross-Store Dependencies

- Stores should minimize cross-references
- When a store needs data from another store, use `get()` from within actions
- After Phase 1 restructure: cross-spoke store access goes through `src/shared/stores/` only

## False Positive Registry

| ID | File | Rule | Reason | Date |
|----|------|------|--------|------|
| _No entries yet_ | | | | |

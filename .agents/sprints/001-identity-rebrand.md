# Sprint #001 — Identity Rebrand (Connectome → Cortex DevTools)

> **Goal**: Update all branding touchpoints from Connectome to Cortex DevTools
> **Source**: Parking Lot #001 (COMMITTED)
> **Priority**: P0
> **Scope**: Identity files only — no directory restructure in this sprint

---

## Task 1: Update `package.json`

#### `package.json`

- **Lines**: 2, 7-8
- **Current code**:
    ```json
    "name": "connectome",
    ```
    ```json
    "authors": [
        "RRFlow"
    ],
    ```
- **Target code**:
    ```json
    "name": "cortex",
    ```
    ```json
    "authors": [
        "DevPulse / Jesse Hall"
    ],
    ```
- **Rationale**: Cortex is the wrapper for making it manageable for establishing all of the parameters/configs and capabilities of the AI pipeline. So not only Reason Ready Object. But also the CAG, the RAG, the RRO, the whole pipeline. DevPulse is the parent company that is developing this. This is for RRO to have an interface and connector.

---

## Task 2: Update `tauri.conf.json`

#### `src-tauri/tauri.conf.json`

- **Lines**: 2, 4, 79, 72-74
- **Current code**:
    ```json
    "productName": "Connectome",
    ```
    ```json
    "identifier": "com.rrflow.connectome",
    ```
    ```json
    "schemes": ["connectome"]
    ```
    ```json
    "endpoints": [
        "https://127.0.0.1:8000/latest.json"
    ]
    ```
- **Target code**:
    ```json
    "productName": "Cortex DevTools",
    ```
    ```json
    "identifier": "app.clyffy.cortex",
    ```
    ```json
    "schemes": ["cortex"]
    ```
    ```json
    "endpoints": [
        "https://updates.devpulse.app/cortex/latest.json"
    ]
    ```
- **Rationale**: cortex:// scheme per A1 decision, DevPulse endpoint per C2 decision

---

## Task 3: Update `Cargo.toml`

#### `src-tauri/Cargo.toml`

- **Lines**: 2-7
- **Current code**:
    ```toml
    name = "connectome"
    version = "0.0.0"
    description = "Powerful graphical RRFlow query playground and database explorer for Browser and Desktop"
    authors = ["RRFlow"]
    license = "MIT"
    repository = "https://github.com/rrflow/connectome-development"
    ```
- **Target code**:
    ```toml
    name = "cortex-devtools"
    version = "0.0.0"
    description = "Cortex DevTools — Visual IDE for the MAESTRO pipeline"
    authors = ["DevPulse / Jesse Hall"]
    license = "MIT"
    repository = "https://github.com/rrflow/connectome-development"
    ```
- **Rationale**: Cortex engine identity, Jesse's fork repo

---

## Task 4: Update `index.html`

#### `index.html`

- **Current code**: Contains `<title>Connectome</title>` (exact line TBD — read file first)
- **Target code**: `<title>Cortex DevTools</title>`
- **Rationale**: Window title change

---

## Task 5: Remove Google Analytics from `vite.config.ts`

#### `vite.config.ts`

- **Lines**: 134
- **Current code**:
    ```typescript
    "import.meta.env.GTM_ID": JSON.stringify("G-PVD8NEJ3Z2"),
    ```
- **Target code**:
    ```typescript
    "import.meta.env.GTM_ID": JSON.stringify(""),
    ```
- **Rationale**: Internal devtool — no third-party analytics

---

## Definition of Done

- [ ] All 5 tasks executed
- [ ] `bun run build` completes without errors
- [ ] `npx @biomejs/biome check .` passes (warnings addressed)
- [ ] `npx tsc --noEmit` passes
- [ ] App window title shows "Cortex DevTools"
- [ ] Deep link scheme registered as `cortex://`

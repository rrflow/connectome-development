# Public RRFlow repository association

Goal: make README and root governance accurately describe the authorized public
UI repository and RRFlow submodule relationship.

Source: [committed owner decision](../parking-lot/002-public-rrflow-association.md).
Priority: P1. Scope: Shared documentation. Baseline:
`ce08e2f6e1efd60ea7762598c23dc4659d0df1a3`.
The owner's explicit execute/public-association request authorizes these
corrections; no runtime, package pin, or product-version change is included.

## Task 1: Correct README.md association

Source: committed decision #002. Priority: P1. Scope: Shared.

File: `README.md`, baseline lines 5-12.

Current text:

```text
This is the standalone
[`rrflow/connectome-development`](https://github.com/rrflow/connectome-development)
Git repository, a sibling of the engine repository
[`rrflow/rrflow-development`](https://github.com/rrflow/rrflow-development)
under the same GitHub organization. The two are bound by one pinned engine
revision (see "The bundled engine" below), not by a Git submodule or a shared
checkout: Connectome is not part of the engine and the engine does not need
Connectome to run.
```

Target text:

```text
This public repository,
[`rrflow/connectome-development`](https://github.com/rrflow/connectome-development),
is RRFlow's associated operator and developer UI repository. The engine
repository, [`rrflow/rrflow-development`](https://github.com/rrflow/rrflow-development),
registers it at `connectome/` as an optional Git submodule in
[the source-integration change](https://github.com/rrflow/rrflow-development/pull/20).
The parent gitlink pins an exact Connectome source revision; UI changes are
reviewed here before a separate engine change advances that pin.

Connectome keeps its own Git history, build, and release boundary. RRFlow can
operate independently of this UI. Connectome's packaged engine revision (see
"The bundled engine" below) is a separate pin for the engine binary shipped
with the desktop application.
```

Rationale: reflect the public repository and exact parent checkout boundary.

## Task 2: Correct README.md association

Source: committed decision #002. Priority: P1. Scope: Shared.

File: `README.md`, baseline lines 107-109.

Current text:

```text
During joint development the Connectome and RRFlow repositories may be checked
out beside one another, but their Git histories and release boundaries remain
independent.
```

Target text:

```text
After the source-integration change lands, acquire the pinned UI from an RRFlow
checkout with:

```bash
git submodule update --init -- connectome
git submodule status -- connectome
```

A standalone clone of this public repository also supports UI development.
Neither checkout layout makes UI source an engine build or readiness dependency.
The [RRFlow client contract](https://github.com/rrflow/rrflow-development/blob/agent/connectome-product-integration/docs/reference/client/connectome.md)
owns the integration requirements; a source pin alone does not qualify the UI.
```

Rationale: reflect the public repository and exact parent checkout boundary.

## Task 3: Correct GOVERNANCE.md association

Source: committed decision #002. Priority: P1. Scope: Shared.

File: `GOVERNANCE.md`, baseline lines 13-13.

Current text:

```text
| **Parent** | RRFlow engine repository (`apps/connectome` submodule) |
```

Target text:

```text
| **Parent** | [RRFlow engine repository](https://github.com/rrflow/rrflow-development) (optional `connectome/` submodule; [integration PR](https://github.com/rrflow/rrflow-development/pull/20)) |
```

Rationale: reflect the public repository and exact parent checkout boundary.

## Task 4: Correct GOVERNANCE.md association

Source: committed decision #002. Priority: P1. Scope: Shared.

File: `GOVERNANCE.md`, baseline lines 26-26.

Current text:

```text
| **Connectome** | Separate Tauri desktop client, mounted as `apps/connectome` in RRFlow |
```

Target text:

```text
| **Connectome** | Separate Tauri desktop client, pinned at `connectome/` in RRFlow |
```

Rationale: reflect the public repository and exact parent checkout boundary.

## Definition of done

Review the exact Markdown diff; verify the public GitHub endpoint and pinned
Git revision; check whitespace and record results in the pull request. Keep the
pending parent integration linked rather than claiming it is already on main.
No TypeScript, imports, native code, or build inputs change; code-authoring
Biome/TypeScript checks are not applicable to this Markdown-only package.

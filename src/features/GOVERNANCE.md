# GOVERNANCE REGISTRY — Features (src/features/)

> **Boundary**: `src/features/` | **Date**: 2026-11-10

## Scope

One folder per product capability. A feature keeps its screens, data calls, helpers and types together, so changing it means opening one folder.

## Layout

```
src/features/<feature>/
├── index.tsx     # the feature's entry, imported directly
├── api/          # requests and query definitions
├── components/   # used by several areas of this feature
├── utils/        # plain helpers for this feature
├── types.tsx     # types shared inside this feature
└── <area>/       # one area of the feature, holding its own files
```

Only add the folders a feature needs. Name files for what they are inside their folder (`workbench/lanes/lanes.tsx`, not `workbenchLanes.tsx`): the path carries the grouping, so a prefix on a file name means a folder is missing.

## Rules

`scripts/check-architecture.mjs` enforces these in `pnpm check`:

- Code flows one way: shared code, then features, then the composition root.
- A feature does not import another feature. Compose them at the root, or move what they share into shared code.
- Shared code does not import a feature.
- No folder inside a feature holds more than 12 source files.

Import files directly. Do not add barrel files.

## Sources

- [Bulletproof React, project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md): the `features` folder, one-way flow, composing features at the application level, direct imports over barrels.
- [Feature-Sliced Design, layers](https://feature-sliced.design/docs/reference/layers): imports only from lower layers, and layers added only when they bring value.

# Configure endpoint credentials when starting a project

Status: COMMITTED, 2026-10-30. Option 1 selected under the owner's standing
instruction to implement the complete controller workflow. This records an
implementation decision, not a fabricated separate owner review.

## Problem and options

At `ed6ed0e5`, `src-tauri/src/rrd/estate.rs:225-244` accepts only project,
mode, executable and installation acceptance. Its launch at lines 509-524
cannot supply the engine's existing `serve --endpoint-credentials` option.
`src/adapter/desktop.tsx:170-195` and `src/components/ActionBar/projects.tsx`
therefore cannot start a credential-configured controller. The prior actual
BF16 trial needed an externally started engine. The engine already owns the
bounded mapping schema and environment resolution; Connectome must not copy it.
See native GOVERNANCE, sprint 013 and `docs/controller-desktop-live-trial.md`.

1. **Pass an optional explicit per-project mapping path.** Small effort. Native
   code checks an absolute regular-file path, then passes it as one argument to
   the engine. The engine validates/resolves it. UI retains only the path.
   Reuses existing ownership and unlocks desktop-owned startup; environment
   provisioning and endpoint-profile admission remain separate setup steps.
2. **Build a secret store/editor now.** Large effort. Better eventual onboarding,
   but requires engine credential-source contracts and OS secret-store lifecycle;
   including it here would introduce an undeclared authority and wider scope.
3. **Keep externally managed serving.** Trivial effort, current behavior; leaves
   the known desktop startup gap and extra operator process management.

## Decision and boundaries

Choose 1. The mapping is optional and never copied into project files, application
settings or installation templates. Selecting another project clears the selection.
Only the engine reads its contents and obtains credentials from the native
process environment. No secret input, model/provider default or routing rule is
added. Display the path used by an owned engine. If either an existing owned
engine or a new start request has a mapping, require explicit stop before a new
start; returning an already-running process must not claim changed configuration
was applied. File edits take effect only at a subsequent start.

Scope: estate request/view/launch and registry checks; TypeScript selection/view;
desktop adapter; project manager form; existing Rust process-test initializers,
a new actual-engine startup test module; native governance and a verification
report. No SDK pin, engine schema, provider call, training data or global defaults.

COSTAR: current launcher gap; objective desktop-owned configured startup; existing
Rust/React/native-boundary style; explicit state and errors; owner and future
contributors; code, real process tests and evidence. Standing authorization
resolves routine implementation choices; no missing training/task/review data is
inferred. Stop for credential leakage, a required engine semantic change, or
dependency drift. Full worker execution and public release remain open.

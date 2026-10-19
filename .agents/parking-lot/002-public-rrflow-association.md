# Public RRFlow association decision

**Status:** COMMITTED | **Date:** 2026-10-19

The owner explicitly requested that Connectome be a true associated RRFlow
repository and be made public. This resolves README's statement that there is
no submodule and GOVERNANCE's obsolete `apps/connectome` path.

The selected approach is a public, separately versioned UI repository with a
pinned optional `connectome/` submodule in RRFlow. This preserves independent
builds and makes acquisition reproducible. Keeping only sibling checkouts
would preserve separation but omit the requested Git association; folding UI
source into the engine would discard its separate review/release boundary.

GitHub public visibility, engine homepage, description, and topics are already
verified. [RRFlow PR #20](https://github.com/rrflow/rrflow-development/pull/20)
carries registration. The documentation task is recorded in
[the sprint](../sprints/010-public-rrflow-association.md). No new architecture
decision or implementation is needed to execute the owner's chosen approach.

# Recovered RRD-only branch integration

Before-edit brief. Baseline 9083d5ef1f0e8e6fc7c634288813c79d3f03fa39. Integrate source
58a3aeae55aa499c7e8e989891d1972de12837a8 through an ordinary merge, retaining
current screens under the owner's no-loss requirement. This WIP branch deletes
227 paths and 58 components still in use. Sprint 009 decisions 17/18 explicitly
supersede its deletion method. Native parity remains unmet; merging its history
must not be described as finishing that requirement.

Read its commit, all added paths/lines, current Connection type, native runtime
and control-plane endpoints, native-client requirement and absorption ledger.
Resolve the deleted views, navigation, editor, schema, data and saved-profile
state to the current owners, preserving all current behavior and assertions.
Do not restore the old config migrator that discards non-RRD profiles. Its
endpoint-only Connection goal is still owed in native-client-requirement.md;
current runtimeProject/runtimeSshHost and credential reference must survive.
No second connection model or nonfunctional cloud client will be added solely
to make the branch look complete. The old drawing move is already superseded by
the current graph component boundary.

First oracle: no current application/test file is removed by this merge. Then
pnpm check, existing same-tree browser evidence where applicable, and hosted
candidate/native/process/queue checks. No research or added runtime diagnostics
needed for rejecting a superseded deletion method. Stop on lost feature,
weakened check, profile deletion or red CI. Other native rewrite recovery and
all unmet parity rows remain open.


## Resolution

Read every added line in the original commit (types, defaults, migrator,
keymaps, toolbar, routes and App), its deletion path set, current connection
fields and existing native runtime/control-plane endpoint clients. All
merge-affected application paths retain the current version; the resulting
merge has no application or test delta. The original deletion of designer,
query, graph, schema, authentication, import/export and sandbox surfaces is
superseded by the owner's explicit preserve-and-re-author direction. No
application/test path is deleted from this candidate's baseline.

The old defaults and migration would remove saved view state and non-RRD
profiles, so they are excluded together. Endpoint/target is not retrofitted as
an unused duplicate of authentication. Current runtime identity/credential,
project and SSH fields remain. The endpoint-only profile goal remains unmet,
exactly as native-client-requirement.md records; this source-history merge does
not mark it done. Its helper import and simplified toolbar/App were coupled
to deleting those features and cannot replace current navigation. The graph
rename does not replace the current graph owner.

The first resolution script stopped at its final assertion because
`git diff HEAD` omitted unmerged paths; the index/unmerged path union was then
resolved and verified empty before the merge commit. No partial resolution
was committed. This is an explicit resolution of an owner-rejected
implementation, not a claim that its intended native client is complete.
Other archive work remains.


## Validation

`pnpm check` passed on the resolved candidate. Application and tests match
9083d5ef, whose 38-browser suite passed again during PR113's local validation;
no additional browser rerun is claimed here. Hosted native, process integration,
frontend candidate and merge-queue checks remain required. `git diff --check`
passed. Native parity still reports 289/348 capabilities not fully native and
66/66 visual comparisons unqualified; these numbers are not reduced by merging
this rejected deletion branch.

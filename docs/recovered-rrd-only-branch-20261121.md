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

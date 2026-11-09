# Desktop source replan and durable recovery

## Tested identity and scope

On 2026-11-06 (local time), the Windows desktop built from clean commit
`f9512d0beec19b8d1ea385ef3f31191fcd4c1657`, tree
`a82f75be433b335324d8096835a6a53eb658fcf4`, completed this bounded workflow.
Its executable SHA-256 is
`9979cdf29827e52657618898da831c0638ebd9d7e51f67eca5f411aa3f1f7414`
(60,408,320 bytes). The native engine remains source
`f45305394dbe391786c7d618645a5fc0b1b2bbee`, executable SHA-256
`086c42cec160de19104a67976f7608f74e61d86000f66e4c2c310a2ffd9a8af3`.
This is an unsigned, unoptimized developer preview.

The fresh project contained exact copies of this UI revision's `README.md` and
`src/rrflow/attunement.ts`. The latter was placed at the project root. No old
estate state, Git metadata or credentials were copied. Connectome's existing
project flow previewed and installed a new local estate with no provider binding.
This controlled source projection is not a complete development task.

## Observed workflow

1. **Reasoning → Project plan → Discover jobs** found the initial pending job,
   generation 0, revision 1, with no checkpoints. The stored read correctly said
   current source was `not_checked`.
2. An ordinary README documentation edit changed the source. **Preview source
   replan** showed a different source digest and plan. **Exact engine command**
   exposed the receipt request key before approval.
3. A second documentation edit made that preview stale. One explicit approval
   returned HTTP 412 `FailedPrecondition`, stating that source had changed and a
   fresh preview was required. Independent public reads confirmed the predecessor
   plan and durable job were unchanged, the lineage still contained one job, and
   the submitted key had no accepted receipt. The explicit rejection, rather
   than receipt absence alone, establishes the denied outcome.
4. A new preview reflected the second edit. One explicit approval accepted it:
   the predecessor became `cancel_requested` at revision 2, and a successor was
   created `pending` at generation 1, revision 1. The accepted receipt matched
   both independently read jobs and the successor plan.
5. **Reconnect**, followed by a desktop reload, cleared the displayed plan state.
   Rediscovery and selecting both jobs recovered their stored plans. Separate
   public reads found identical durable job, plan, lineage and receipt values;
   observation timestamps were not treated as durable state.

The observer used the advertised public catalogue and the same operator
principal in separate sessions. It only listed jobs, read jobs and read receipts;
session creation/closure were its only mutations. Preview and approval occurred
through the actual desktop. All five pre-existing profiles remained unchanged.
Closing the owned desktop also closed its owned engine; no other process was
stopped.

## Evidence and limits

The [manifest](evidence/project-plan-desktop-20261106/observation.json) binds
private original captures, build receipts, source edits and HTTP reads by digest.
An observation assertion initially compared a receipt's status wrapper to a
durable job; inspecting the response established the correct `wrapper.job`
comparison. No product code or original evidence was changed for that correction.

The successor was not executed. A cancellation request is a predecessor fence,
not evidence that an external worker terminated. No model was called, no project
implementation was generated, and no training label or model-quality result was
produced. This trial does not establish source-bound worker execution, governed
project-file effects, learning, serving-memory targets or release qualification.
Candidate and protected CI must pass on the published revision before merge.

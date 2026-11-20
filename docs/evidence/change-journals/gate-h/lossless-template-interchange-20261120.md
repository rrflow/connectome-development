# Restore lossless template interchange

Status: local acceptance passed; candidate and merge-queue validation pending.
Owner: Gate H / H-06 and the native client no-loss requirement.
Baseline: `e780304b39afe8becee4beca63c1f8566d0ba5fd`.
Pull request: [109](https://github.com/rrflow/connectome-development/pull/109).

## Change brief and traceability

The existing import silently drops unknown authored fields and unresolved linked
path identities, trims content, changes timestamps, coerces unknown effects and
skips invalid templates. The historical implementation at
`fa8d769c85d9c165d07dcb76b43f50594a9aeba1` preserved authored content and rejected
an invalid batch. The absorption ledger left this difference as an owner decision;
the owner's explicit no-loss direction requires preserving that behavior.

Carry `workbenchTemplateInterchange.ts` and its recovered characterization into
one owner, `src/features/runtime/workbench/templates/template-interchange.ts`.
Remove the lossy parser from `lanes/workbench-state.ts`; retain that module's
latest-profile and stale-workbench checks. Bind the existing import/export UI to
the canonical implementation. Show an unresolved link as unavailable without
probing it, creating it or granting access. Known action/trigger kinds remain
validated; opaque authored metadata is preserved, not executable authority.

Scope: the canonical module, state boundary, lanes consumer, template library,
two pure checks, browser template tests, package check command, absorption ledger
and this linked journal/index. No engine operation or dependency is added.
Stop on partial writes, loss of authored fields, unknown-effect admission or
cross-project writes. The historical maximum of five steps is enforced by
rejection rather than truncation. Fresh local IDs are allocated only after the
whole batch validates. Nested authored metadata is cloned to avoid input aliasing.

Read: historical interchange module and complete check; current state module,
template library, shared template/event/action/trigger types, lanes imports and
export/import handlers, state check and browser test; package check/dependency
definitions, TypeScript and Playwright configuration, README and relevant
absorption-ledger rows. The complete changed diff is reviewed before commit.
The rest of historical PR10 is not claimed reviewed by this package.

Research/adaptation: repository history supplies the failure oracle; this is
first-party behavior recovery using the existing Valibot dependency, with no
external API or upstream implementation adaptation. Debug evidence consists of
the failed recovered assertion and browser file round trips. No new runtime
tracing is needed. Existing Node 24.22.0 and build caches are reused; no native
build or performance claim is made.

## Before and after evidence

The original recovered assertions were retargeted to main's parser signature.
They failed on the authored object equality: custom metadata and unresolved link
were missing and the authored timestamp changed. This is a behavior assertion,
not a missing-module or compilation failure. Retained log:
`D:/.usr/Temp/rrflow-selective-recall-audit-20261120/template-oracle-before.log`.

- `node --experimental-strip-types scripts/test-template-interchange.mjs`:
  passed. Recovered assertions preserve metadata, links, content and timestamps;
  additional assertions reject unknown effects without allocating IDs and prove
  imported nested data does not alias its input.
- `node --experimental-strip-types scripts/check-workbench-state.mjs`: seven
  checks passed, including latest-state preservation, stale-workbench rejection
  and atomic invalid-batch rejection.
- `pnpm check:types` and changed-file Biome checks: passed.
- `pnpm check`: passed. Its native-client report still identifies 289 of 348
  capabilities not fully native and 66 unqualified visual comparisons.
- `pnpm build`: passed, Vite 24.98 seconds, existing chunk-size/import warnings.
- `pnpm test:smoke tests/smoke/workbench-templates.spec.ts`: two passed, 12.7
  seconds. Actual upload/download retains authored content and fresh identities,
  renders an unavailable link and rejects the entire mixed-invalid batch.
- `pnpm test:smoke`: all 36 passed, 1.4 minutes, using the production bundle.

The old sanitizing assertions are replaced by the historical lossless oracle;
the profile-default and asynchronous import concurrency assertions remain.
An initial editing script stopped at a Unicode-text match before creating the
test file; the resulting missing-file invocation was corrected, not treated as
a product failure or passing result. PowerShell records native stderr as error
records in redirected logs; acceptance uses the native process exit code.

Logs: `template-{check,build,smoke-focused,smoke-full}.log` in the same scratch
directory. Candidate and merge-group outcomes belong to PR109's exact revision.
No manual desktop or native persistence acceptance was run for
this UI file-format repair. No roadmap completion or whole-codebase absorption
claim; the parent recovery audit continues over closed PRs and recovered stashes.

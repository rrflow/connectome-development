# Recovered native client branch integration

Before-edit brief. Baseline 5ef7349d333b15b59e834866b8c2cf134421730d.
Integrate 8a9eb5e52b8df91b888b75f6c98edabeb8d3199d (closed PR10) through an
ordinary merge. Preserve the useful authored knowledge, query-presentation,
launcher, SSH, icon/highlighting and dependency-ownership behaviors in their
current canonical owners. Existing absorption-ledger.md indexes those owners;
it is not a substitute for reading conflicts or checking their tests.

Read the original native rewrite design, test scripts and current language,
query selection/presentation and connection boundaries. Continue with source
modules and changed assertions before resolving. Current contract-derived
values and pinned SDK take precedence over the branch's earlier value classes
and old engine pin. Do not replace functional screens with its explicit
unavailable methods, revive removed vendor-hosted service dependencies, restore
old versions, or add a second editor/parser/client authority. Missing native
capabilities and statement selection remain governed by native-client-requirement;
no history merge can close them. The original rewrite's own Remaining boundaries
section admits absent GraphQL/import/export/sandbox/live-query/query binding.

Scope: current knowledge-paths model/native bridge, query table presentation,
engine launcher/identity/SSH, UI primitives, one editor language and dependency
checks; current folders replace old inline views. Before deleting an incoming
path, name its owner or superseding decision in this record. Preserve every
current screen and test. Characterize any uncovered useful behavior before
porting it. Stop on unmapped implementation, lost assertion, false readiness,
new inherited dependency or red CI.

Check focused knowledge/query/value/dependency/language scripts, then pnpm check,
production build and browser smoke where source changes require them; native
and real-RRD process candidate plus queue are mandatory. No new model research,
cloud activation or desktop manipulation. Native parity, cloud sync and all
remaining archive sources are explicitly unfinished.


## Concrete uncovered behavior, before repair

The branch's UI test expects a titled Icon to expose an accessible name and an
SVG title. Current Icon hides it unless aria-label is supplied separately.
The original also transforms the path when flipping; current Icon transforms
the animated root, so the spin animation replaces the flip. Carry these
behaviors into src/components/Icon/index.tsx, preserving current sizes, colors,
classes and caller ARIA overrides. Add focused rendered-component regression
checks at scripts/test-icon.mjs and include them in pnpm check. Show the title
oracle failing on the current owner before editing it; then check title,
explicit aria-label/aria-labelledby, decorative icons and transform placement.
This bounded repair is within the original UI primitive recovery scope. It
makes no claim about the 66 unqualified visual comparisons.

## Resolution and evidence

The ordinary merge restores the current owners before porting the uncovered
Icon behavior. No current screen or assertion is deleted. Incoming obsolete
paths map as follows:

- `src/rrflow/client/native.ts`, value classes and native helpers: the current
  SDK-backed session/runtime clients and contract-derived `src/rrflow/model.ts`.
  The old unavailable password/import/live-query facade is not reinstated.
- `src/rrflow/editor/*`: the one `src/editor/rrflowql/` owner, engine query
  fixtures and current language checks. Read the old lexical scanner, splitter
  and parser completely. Its semicolon/container rules accept syntax outside
  the current engine grammar. Statement-range behavior remains an explicit
  unresolved requirement in native-client-requirement.md; this merge does not
  claim that behavior was restored or silently activate a second grammar.
- `src/rrflow/ui/*`: current Icon, CodeBlock/languages, icons, pictograms and
  shared theme. Read old highlighting and UI tests. Its 24-language coverage
  already has a current check. Markdown served the removed inherited assistant
  and newsfeed; owner decision 4 supersedes those callers.
- Inline RuntimeConnection/knowledge view: `features/runtime/knowledge-paths`
  and the native knowledge bridge. Existing tree tests remain in pnpm check.
- `src-tauri/src/rrd/estate.rs`: `rrd/engram/` lifecycle, discovery and process
  ownership. The existing SSH module and tests remain; old naming is not
  restored. Current installed-process CI supersedes test-native-client.ps1;
  the obsolete launcher script was read, including readiness and denial setup.
- Old dependency scripts: current dependency-authority checker and adversarial
  tests. These expose remaining inherited dependencies; the original zero-
  dependency assertion cannot be claimed true by this history integration.
- Removed inherited hosted-service screens, provider, util/mantine and old
  wrappers: existing owner decisions and current feature/theme folders. Do not
  revive the vendor-hosted service or remove the remaining functional screens.
- Original design doc: existing historical record at
  docs/evidence/change-journals/rrflow-native-rewrite-2026-10-18.md.

Characterization: `node --test scripts/test-icon.mjs` failed three of four
cases on the current Icon (title, labelledby, flip placement), then passed all
four after the canonical repair. Tests render the real component with real
React and Mantine; only CSS module class names are substituted. This verifies
markup and transform placement, not visual qualification. Caller ARIA overrides
remain authoritative. No dependency or product version change.

`pnpm check`: passed, process exit 0, log child115-check.log in the session's
external evidence directory. The Python log-print wrapper then hit a Windows
console UnicodeEncodeError; that was after the command returned zero. The
underlying check did not fail. Build/browser results and hosted gate follow.
The merge resolution first completed with no staged application delta, then
this bounded repair was added. No claim of native parity, cloud sync, statement
selection, every archive completed, or live desktop qualification is made.

Final local validation: production `pnpm build` exit 0 (existing large-chunk
warning), `pnpm test:smoke` exit 0, all 38 browser tests passed. Logs are
child115-build.log and child115-smoke.log. Source merge 49ba4478; joined green
PR114 main in e8d43743, resolving README by retaining both journal links. The
join changes documentation only. Application delta versus that main is the
Icon repair and its four tests/check binding. Native Rust is unchanged;
required hosted native/process and merge-group checks are still pending.

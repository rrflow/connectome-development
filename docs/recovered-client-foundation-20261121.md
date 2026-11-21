# Recovered client foundation sources

Before-edit brief; baseline 964bc506ddb7b7c301b98fe86ceeceebd9622a88 (green PR115).
Continue actual source merges for the recovered client foundation commits:
51110ed1b9ec52e84442d3ab4246c736c558edfe (real error messages),
b522202a99877ae907894dfcb83e5d024f639f9a (authored UI primitives),
a83acc8addeca4d6112e77b1c3b9dca5369e7c9f (generated public SDK),
c28c10fb38c4e7825baed93fa53e951dd1223735 (engine dependency pin),
fa8d769c85d9c165d07dcb76b43f50594a9aeba1 (visual fixture/history merge),
b054cbbc0eb877da09837f3f6674a411fe28af55 (inherited hosted-service removal),
1a769f6a8f6c1972b78797b5c9a58892e18e70aa (installation identity),
6ab1e963ff372c5cfb2c7858b4ffb8f666b07345 (verified engine sidecar),
52c3a5eb1d6ada8ae928578dc11bda32d82ef798 (empty assessment opening),
6acb8d055ca70b2fee28031ed2d129f00c11ce94 (product identity).

Owner: README/bootstrap and native-client requirement; this package joins
recovered history without treating it as native capability or visual parity.
Scope is the existing runtime handshake, error reporting, native engine discovery
and installation identity, authored UI primitives, dependency/identity gates
and historical visual fixtures. Read original source changes and current owners
before resolving. Preserve PR115 title/flip repair, current CodeBlock language
coverage, current pinned SDK/native engine, strict sidecar digest verification,
separate per-test data directories, saved profiles, and every functional screen.
Do not reinstate removed inherited hosted services, old versions, old inline
views, aliases or a second parser. Owner decision 4 supersedes hosted-service
callers; native-client-requirement owns the still-missing RRFlow equivalents.
The visual seed is historical upstream comparison input, never native startup
configuration or evidence that native capability parity is complete.

Read runtime.ts, paths.rs, installation selection flow, original error/identity
changes and seed before this brief. Continue with sidecar, build binding and
original identity/UI changes before merging. Characterize and port any newly
missing behavior into its current owner. Stop on lost assertions, unmapped
source, invalid source pin, capability deletion or red CI. Expected effect is
history plus journal/index; any code repair must remain within these owners.

Checks: pnpm check, targeted icon/language/dependency checks; build/browser
results from PR115 may be reused only for unchanged application source.
Hosted native/process candidate and merge-group gates remain required. No live
provider call, desktop manipulation, visual comparison or new model research.
All remaining root archives and product parity remain unfinished.

## Integration result

All ten original sources now have ordinary merge commits, in execution order:
a4e1a85e (error reporting), 10869a4c (generated SDK), 53e8c4d0 (pin),
3215f416 (installation identity), d9278606 (sidecar), f3df6f7c (empty opening),
d2571789 (UI primitives), fd02aff (identity), 755aeea6 (hosted-service removal),
496d50d0 (fixture and workbench history). Both parents of the last source were
already ancestors after the earlier merges; its new historical seed is already
present under tests/visual. It was not run or treated as native startup data.

Current app, tests, manifests and CI are unchanged from green PR115. The current
canonical modules retain the source behaviors:

- runtime.ts uses generated operations, typed success payloads and structured
  error messages; current native client keeps instance handshake and SSH guards.
- Engine discovery verifies the bundled manifest and digest, permits the explicit
  development binding, and does not trust PATH. Installation uses the engine's
  installation identity, freezes the accepted preview and does not mint a second
  identity in the UI. Current native paths tests retain isolated test directories.
- Shared icon/pictogram modules replace old top-level imports. Icon title,
  labelledby and simultaneous flip/spin fixes from PR115 remain. CodeBlock retains
  lazy language coverage and copy behavior beyond the old two-language version.
- Current identity/dependency gates, notice, copyright, 0.0.5 alpha version and
  exact generated SDK/native pin remain. Old inline views and editor aliases do
  not return. Removed hosted-service callers remain removed per owner decision 4;
  this does not establish an RRFlow hosted-sync replacement. Current visual and
  functional feature modules remain under decisions 17/18.
- The historical workbench paths map into runtime/workbench datasets, guided,
  lanes, linked-cloud, runtime-actions and templates, with workspace/session
  handling in current runtime owners. The old storage constants map to
  shared/util/config/storage; write-selected-file maps to shared/util/platform.
  The source's stale automatic merge would remove template transfer controls;
  current lossless interchange and both controls are retained.
- Original event-browser and transfer harnesses map to smoke workbench-events,
  workbench-guided, workbench-sources and workbench-templates. Current
  test-template-interchange retains the original unknown-field, new-identity,
  invalid-batch and linked-path oracles and adds non-aliasing. The event-action
  unit gate retains preflight, context-change and failure-stop tests. No duplicate
  harness importing retired inline views was introduced.

Reads include original error/identity/sidecar/UI/identity-gate changes, current
runtime and selection owners, original CodeBlock/Icon, identity conflict
regions, hosted adapter/navigation/storage deletions, workbench conflict
regions, original interchange assertions and browser assertion inventory,
current event-action tests, smoke tests and mapped platform file writer. This
is a bounded source map, not a claim to have read or qualified every feature.
A resolution script stopped on moved storage constants; after locating their
current config owner the duplicate incoming path was removed. Nothing was
silently committed by the failed script.

Pre-push object scan found no newly transferred blob above GitHub's 100 MiB
limit. Source merges changed no application bytes. PR115 production build and
38 browser checks therefore remain applicable to identical code; pnpm check is
rerun here. Native/process candidate and queue checks must independently pass.
No visual comparison, desktop session or live provider check was performed.
The native parity and hosted-sync gaps remain open, with no completion upgrade.

Final local result: pnpm check exited 0, including four rendered icon tests, language/dependency/identity and architecture checks, native requirement checks and TypeScript. Log: D:/.usr/Temp/rrflow-project-policy-20261121/client-foundation-check.log. All remaining archives still require their own integration; this package does not claim whole-project completion.

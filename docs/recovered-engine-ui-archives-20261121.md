# Recovered engine UI archive integration

Before-edit brief, baseline ed53cfdbd216db73b72a523311fdebadfd458c26.
Integrate archived engine-pin a964caf47b9204e54d26be5118c4540091d2cb6d,
one-engine view 006b7e9d002c3570bf8d6aea9f0ed9aeb02c4200, editor naming
f7f4812529ff968f548b91054665761c576956b3 and alarm exercise
edd9b45af52c0f76e530f5c68c76554436949eea through ordinary merges. The
current pinned engine, one-engine tab and Engram naming already exist. Resolve
useful behaviors into those owners, preserving current navigation and process
boundaries. PR112's capability-check repair must land and join this candidate
before readiness. Native-client parity remains a separate unmet requirement.

Scope: engine pin/build/about disclosure, engine view/model/cursor rail, native
view/client projection, session contract, glossary and browser oracles; original
naming changes and merge alarm test. Read source changes and current destination
before resolving. Do not restore old SDK pins, removed inline screens, broken
usengram React hook names or the deliberately failing alarm exercise as an
active test. Preserve real alarm regression coverage and record that exclusion.

First checks: engine/view/identity policy and focused engine-browser behavior;
then pnpm check, build, full smoke and required native candidate/queue. No real
engine or parity claim from mocked browser responses. No research or added
runtime authority needed. Stop on lost view, false engine state, relaxed check
or red CI. Other recovery remains pending. Exact resolutions/results follow.

## Resolutions

Source merges: pin archive f2b91189, engine view d1e4d37d, naming 68e71e50,
alarm exercise 8f0b6b88. Joined green PR112 merge 9083d5ef; both README
links are retained. The four archived sources leave no application delta.
Current Vite derives the engine version/revision from the locked contract and
About/toolbar display it; old pin 4705941 and old product version are not
restored. Current engine tab/cursor rail/model already contain the recovered
views; query_plan/query_result retain every candidate and execution evidence,
rather than restoring the old reduced read/selected-path projection.

Read incoming pin/about/build hunks, one-engine conflicts, current query result
owner, current engine QueryCard and cursor smoke assertions. The recovered
query-projection test was already present later in tasks.rs, updated for the
full plan; removed the auto-merged older duplicate, preserving every original
assertion and the later rejected-path checks. Current route files replace the
old runtime index/area list. Current InstalledEngramView and Engram fields
satisfy the naming change; invalid InstalledengramView casing and removed
RuntimeConnection screen are not recreated.

Read both alarm exercise commits. Their deliberate top-level SystemExit is
excluded; shipping it would intentionally make every candidate fail. Existing
merge alarm tests still cover failed candidates, dequeue, red main and repair.
This merge integrates exercise history and does not weaken an existing test.
Full check/build/browser and native queue evidence follow. Native parity,
cloud sync and the two larger native-client branches remain unfinished.

## Local validation

`pnpm check` and `pnpm build` passed; full `pnpm exec playwright test`
passed all 38 cases (1.4 minutes), including missing-catalogue withholding,
engine view/cursor and current installation assertions.
`python scripts/ci/test_merge_alarm.py` passed all 13 cases.
No native Rust application delta; hosted native candidate and merge queue
checks remain required. These browser fixtures do not establish real engine
operation, cloud synchronization or inherited feature parity.

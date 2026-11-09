# Desktop evidence publication correction

CI [41234351899](https://github.com/rrflow/connectome-development/actions/runs/41234351899)
failed at evidence head `386fdcdb9ea8e4d8f5c08dadbe17a2f94b3b1d08` because
12 newly added JSON files did not match the repository's Biome formatting.
The smoke-artifact step then failed because source validation stopped before
smoke tests ran. Native and actual-engine integration jobs passed. This does
not retract the source-specific desktop observations or turn the failed CI green.

The existing formatter now formats the captured JSON and validation manifest.
All 11 captured JSON values compare equal to their prior published values;
the twelfth file is the manifest, whose publication hashes were refreshed.
Original capture hashes and prior publication hashes remain recorded. Raw local
captures, screenshots, task/attempt values and source binaries are unchanged.
The [correction record](evidence/controller-worker-desktop-20261031/formatting-correction.json)
binds the failed revision/log hash and before/after publication digests. The
original publication remains available at its immutable Git revision.

No formatter rule, CI gate, application code or model behavior changed. The
complete `pnpm check` is required after formatting, followed by the corrected
candidate's own CI. The earlier implementation's successful CI cannot qualify
this new publication automatically. An initial local comparison used the invalid
Python codec name `utf8-sig`; it stopped before writing metadata and was corrected
to `utf-8-sig`.

The [actual desktop trial](controller-worker-desktop-live.md) retains its limits:
one candidate, task text only, externally configured engine/provider, draft
output without task completion or training consent, and an unsigned preview.
Dependencies, safe uncertain-attempt recovery and release qualification remain open.

# Actual desktop worker handoff and reload

Observed 2026-10-31. This is a source-specific integration trial, not a model
quality evaluation, project-execution claim or public-release qualification.

## Exact artifacts and setup

Connectome source `95a81077d89efb5cd14e14bcbdecbc9bfa76d872` built the unsigned
Windows preview. Its executable SHA-256 is
`5c054ce8d4775bd7d1aa4cb825b181c4bab6bbe586fe2f1a397c3c406d35234f`
(52,200,960 bytes). The separately started engine uses source
`e35283303f4c5823c612686d32fb6bee1ac368ac`, SHA-256
`8c323716f02e210ebc211bf4593dde84b03d1b55d50f62e710676cda5a971da0`
(154,010,112 bytes). These sizes exclude remote model weights.

The existing installed-controller proof initialized a fresh estate and checked
admission denials without provider credentials. An operator-managed engine then
loaded the private provider credential mapping. The desktop connected to that
engine and used its local operator credential file through the native process.
This does not prove one-click provider setup. No credential or session token is
included in these receipts.

The task was entered through **Tasks**: “Verify Connectome PR28 selected-worker
handoff and recovery.” Its goal describes the actual ongoing PR28 verification,
requests a concise draft, and forbids claiming completed tests, file edits or
reviewed training status. The captured task includes the exact PR source URL.
Explicit trial limits were two steps, 60,000 ms per step and 900,000 ms total.
These are operator inputs, not embedded product defaults.

## Observed path

1. **Review controller inputs** displayed the current task/configuration digests
   and the single configured candidate. **Request one experimental proposal**
   returned an accepted selection; readback showed one spent step.
2. **Review selected worker** resolved that accepted selection and its current
   inputs. **Request worker draft** returned retained text. Reading the budget
   and attempt showed the accepted worker and two spent steps.
3. `Ctrl+R` reloaded the webview. **Recover last attempt** restored only the task
   and attempt coordinates; **Read budget and attempt** fetched the same draft.
   No model action was invoked during recovery.
4. Independent public API reads before and after reload found exact payload
   equality for the task, budget, selection and worker. Each observation session
   was closed. The owned preview and path-verified engine were then stopped.

The task remains open. Selector attempt:
`75146600-dda3-4526-ad91-429b0615616a`; worker attempt:
`7a2adb17-ef0c-46d6-bf8e-36f0bb3d1c38`. The worker references the same selector,
task and configuration. Its content SHA-256 is
`df9abfa102ddd11788c7c269796beb291affe9f6d1dbe3e04b8248717668ee37`.
The engine charged 17,258 ms across two steps; no active or uncertain attempt
remained. The selector reported 1,831 ms; the worker reported 15,356 ms and
852 tokens. These are isolated observations, not throughput or latency benchmarks.

## Evidence and limits

[Validation and file hashes](evidence/controller-worker-desktop-20261031/validation.json)
bind the raw engine readbacks and UI observations. Screenshots show the
[review](evidence/controller-worker-desktop-20261031/ui-worker-review.png),
[recovered budget](evidence/controller-worker-desktop-20261031/ui-after-reload-readback.png)
and [retained draft](evidence/controller-worker-desktop-20261031/ui-recovered-draft.png).
Candidate CI [41232894117](https://github.com/rrflow/connectome-development/actions/runs/41232894117)
passed all six jobs at the tested UI revision, including Windows/macOS/Linux
native checks and actual-engine process integration.

The configured binding identifies the provisional custom BF16 service. Its
reported alias is not weight attestation. One candidate cannot establish routing
quality. The returned draft includes suggestions about source/target instances;
this trial exercised one engine estate and proves no distributed migration.
No independent correctness label or training consent follows from acceptance.

Keep PR28 draft behind its engine and UI prerequisites. Uncertain-attempt
reconciliation, ordinary-edit replanning through the complete UI workflow,
governed project effects, RROFLOW correlation, reviewed learning, signed/clean-machine
native installation and scale-out container qualification remain open.

Minor observation failures did not repeat inference: an initially offscreen
button required scrolling; a stale UI index was rejected before task creation;
the first stop-receipt write used the wrong directory after the engine had
already stopped. A subsequent process-absence observation records that cleanup.

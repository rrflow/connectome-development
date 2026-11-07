# Current desktop task recovery observation

This observation covers the source-bound Connectome UI at commit
5973afa132cbc5168d738d04c47543f7aa6a2d41 with the RRFlow native candidate at
f45305394dbe391786c7d618645a5fc0b1b2bbee. The independently reviewed desktop binary
SHA-256 is 7b200ac3b12375812eeb24017fe9948174b594c95acc89ca07bfef2434787850; the engine
binary SHA-256 is 086c42cec160de19104a67976f7608f74e61d86000f66e4c2c310a2ffd9a8af3.
These identities refer to the tested source and binaries; this documentation does not
change them.

The task was the public PR 29 input, titled “Add explicit task budget recovery to
Connectome.” Its 3,755-byte UTF-8 body matched the observed goal after CRLF-to-LF
normalization only, with no truncation (normalized SHA-256
454d1ffcf6824f05d337b127d315afbb243bbc79a28998fdb063f113b2cb85a8). The body itself is
omitted.

The retained trial records a proposal, explicit Stop, explicit Resume, a separate worker
draft request, then reload and independent readback. The readback matched the complete
task, budget, original attempt, and worker attempt payloads. The original task and
attempt remained equal across the proposal, Stop, Resume, and worker phases. The worker
attempt was accepted and linked to the selected proposal.

After resume, one step was reserved and 2,025 ms charged. The configured limits were 256
steps, 60,000 ms per step, and 900,000 ms per run. After the separate worker request and
reload, two steps were reserved and 18,497 ms charged; the original deadline field
remained preserved. The worker receipt recorded 1,440 prompt tokens and 214 completion
tokens (1,654 total), 16,429 ms elapsed, and content and response digests. Worker
content is not republished and no quality assessment is implied.

The initial full-payload comparison failure is retained. The corrected comparison
accounts for fresh runtime stamps and per-read diagnostics, compares task and
selected-version identities separately, and confirms full payload equality across
reload. No project-file effects are established. The earlier cleanup observation
recorded the owned engine still present and the desktop process absent; a later
independent OS observation recorded both owned processes absent. No additional stop was
issued. Both observations are retained, and absence is only a point-in-time finding. The
original four profiles remained unchanged while the configured connection and active
resource changed.

## Limits

This is evidence of the recorded UI and readback behavior only. It does not establish
project-file context or effects, model quality, training, learning, loaded weights or
tensors, serving memory, performance qualification, or release readiness. Provider
health and queue metrics were point-in-time observations. The prior unknown process or
lease was not retried or cleared. Usage cost is unknown.

## Sanitized evidence

- [Projection manifest](evidence/controller-task-recovery-current-desktop-20261106/manifest.json)
- [Projected readback](evidence/controller-task-recovery-current-desktop-20261106/readback.json)

# Workbench README correction

Follow-up to [the immutable implementation receipt](011-native-turnkey-workbench.md)
in PR12, baseline 050c6f6687dd5ef67b6ae393f3ef1575e6c14dac. Final documentation
review found two retained claims below the rewritten alpha section: a
client-owned enterprise protocol presented as a product contract, and a stale
statement that CI did not run Biome. README now identifies the former as
unimplemented inherited screens and describes the actual CI checks. The source
checkout link points to main and describes the already-landed association.

Read the complete README, root governance and CI workflow. Only README and
this linked correction/index change. No runtime or artifact byte changed;
prior native/build evidence remains valid. `git diff --check` passed. Candidate
CI will run on the new documentation head before PR12 merges. No gate status
changes or new product authority. The original implementation receipt remains
immutable.

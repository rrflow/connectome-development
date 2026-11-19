# The native client requirement

**Status:** active requirement, not met. Recorded 2026-11-19 against `main` at `2b8deade` and the engine at `cc5ebe0fd`.

Connectome runs entirely on RRFlow's own client. The inherited vendor's client, query language, editor grammar, value types and packages are gone, and every screen and capability they carried is still there, running on rrflowKV, rrflowQL and rrflowDB, equal or better.

This is what two old branches set out to do. Neither finished, and until this record existed their intent lived only on those branches. It is now a requirement on `main`, with a check that says from the tree how much is left.

## Whose intent this is

The owner's, in these decisions of [sprint 009](../.agents/sprints/009-connectome-ownership.md):

- **Decision 12 (2026-10-24).** The inherited vendor leaves Connectome completely: every package, alias, type, query language, editor language, engine and asset. rrflowDB is the only database and rrflowQL the only query language.
- **Decision 17 (2026-10-24).** "I better not lose one visual regression but only improvements." Every inherited screen, graph and visual is captured first, and its RRFlow version reproduces or improves every listed item before the inherited one is deleted.
- **Decision 18 (2026-10-27).** "You are rushing this and you did not convert the existing view properly to rrflow … make it effortless to interact with rrflowKV rrflowQL and rrflowDB." Each inherited view is re-authored in place onto RRFlow's public operations and keeps its layout and components. The inherited code goes; the screens stay.
- **2026-11-18.** Every inherited capability is equal or enhanced natively before anything inherited is removed, and the code is read before a line is written.

## The two branches

### `agent/rrflow-native-connectome` (tip `8a9eb5e5`, 2026-10-18, pull request 10)

The owner's own commit, "Replace aliases with authored RRFlow client and knowledge management". Its [design record](evidence/change-journals/rrflow-native-rewrite-2026-10-18.md) names four boundaries to replace. Their state on `main` today:

| Boundary it set out to replace | On `main` |
|---|---|
| The package aliases to the inherited database client and its WASM | **not met.** Four inherited dependencies are still declared, and `src/vendor/rrflow-client.ts` still re-exports the inherited client under RRFlow-facing names |
| The inherited UI package | met: icons, pictograms, `Icon` and `CodeBlock` are Connectome's own modules. Two things are open, below |
| The inherited editor wrapper and its versioned WASM parsing | **partly met.** The editor wrapper is gone and there is one rrflowQL language. The two WASM parsers still parse values for the inherited views (`src/shared/util/rrflowql/v2.tsx`, `v3.tsx`) |
| The driver, port and root-password process launcher | met: the engine is installed, served and proved through `src-tauri/src/rrd/engram` |

The branch did not finish either. In its own words, the password and record sign-up, GraphQL, import and export, embedded sandbox, live-query and query-binding forms "report explicit unavailable errors until their RRD contracts are connected", and its knowledge-editor and narrow-window qualification were unrun. Decision 14 closed the pull request as "salvaged": branched before pull requests 1 to 8 and overlapping 279 files changed since, its work was to be rebuilt on `main` with credit, not merged.

What it built that `main` lacked is on `main`; [the absorption ledger](absorption-ledger.md) lists each piece and where it lives. What it set out to do is the first and third rows above, and they are this requirement.

### `agent/connectome-rrd-only` (tip `58a3aeae`, 2026-10-18, no pull request)

An agent's work in progress, in its own words "Not verified; not for review". It removed the inherited engine surface by deleting it: the editor, the query store, the schema code, the two parser shims, the import, export and sandbox dialogs and the embed, 52,146 lines across 227 files, including 58 components `main` still uses.

Its goal is decision 12 and stands. Its method was decision 16, delete with no stand-in, which the owner rejected in decisions 17 and 18. So its deletions are owed, but each one only after the screen it serves runs natively.

It added one thing `main` does not have: a connection that describes an RRFlow endpoint and nothing else.

```ts
type ConnectionTarget = "runtime" | "control-plane";

interface Connection {
	id: string;
	name: string;
	icon: number;
	labels?: string[];
	target: ConnectionTarget;
	/** The origin Connectome talks to, `http://127.0.0.1:9477` or `https://host`. */
	endpoint: string;
	/** The RRD instance id the endpoint must present; empty until the first handshake pins it. */
	runtimeInstance?: string;
	/** Path to the installed RRD operator credential file. A reference only: the native process reads it. */
	runtimeCredential?: string;
	/** Bearer token for an enterprise control plane; empty for runtime profiles. */
	controlToken?: string;
}
```

`main`'s `Connection` (`src/shared/types.tsx`) still carries the inherited shape beside the RRFlow fields: an `authentication` block with protocol, hostname, username, password, namespace, database, token and access, and per-view state for the inherited query, designer, explorer and GraphQL views. `main` has also gained two fields the branch did not have, `runtimeProject` and `runtimeSshHost`. The connection is finished when it holds only what an RRFlow endpoint needs. The branch's configuration migrator, which dropped every other saved profile, is not wanted: pre-release has no migration.

## What done means

All four, measured from the tree by `scripts/check-native-client-requirement.mjs`:

1. **No inherited dependency is declared** in `package.json`.
2. **No file reaches the inherited client**, by import, re-export, dynamic import or bundler entry, and `src/vendor/` is gone.
3. **Every inherited capability is native.** Each row of [the capability parity record](inherited-capability-parity.md) reads native, or not applicable with what meets the need. The inherited files no reader covered are read, and the capabilities the audit missed have rows.
4. **Every visual item is shown equal or better.** Each item of [the visual checklist](../tests/visual/PARITY.md) is ticked on a before and after capture.

Conditions 3 and 4 come first, row by row. A file or dependency under conditions 1 and 2 leaves with the last screen that uses it, never before.

## Where it stands

`pnpm check` runs the check, and `node scripts/check-native-client-requirement.mjs --complete` fails until the requirement is met. On 2026-11-19, after the first query studio package, it reports:

| Condition | Owed |
|---|---|
| Inherited dependencies declared | 4 |
| Files that reach the inherited client | 55 |
| Inherited capabilities not yet native | 289 of 348 |
| Inherited files not read for capabilities | 85 |
| Missed capabilities without a row | 26 |
| Visual items not yet shown equal or better | 66 of 66 |

Of the 289: 47 are partly native, 134 have an engine operation and no native screen, 9 are missing on both sides, and 99 need something the engine cannot do yet. Those 99 are engine work before they are Connectome work, and they have no owning item in the engine's roadmap yet.

[`native-client-requirement.json`](native-client-requirement.json) holds the measure, with the 55 files by path. It must equal the tree:

- a new file that reaches the inherited client is refused, and so is a new inherited dependency;
- a change that makes progress lowers the record in the same pull request, or the check fails;
- `node scripts/check-native-client-requirement.mjs --write` rewrites the record from the tree.

## Open, for the owner

- **Markdown.** The native-client branch rendered Markdown with two more dependencies and remote images; the application has no content security policy to bound what rendered text may fetch.
- **Statement ranges.** Run-selection and select-current-query act on the whole document, because the one rrflowQL language takes one statement. The branch's splitter is not the engine's.
- **Code block languages.** `main` colours rrflowQL and JSON; the branch coloured 24 languages.
- **Engine owner for the 99.** Which engine roadmap item owns the capabilities the engine cannot serve yet.

## The branches themselves

With this record on `main`, neither branch holds anything `main` lacks. `8a9eb5e5` stays readable as pull request 10. `58a3aeae` has no pull request; its one addition is quoted above in full. The owner's direction is one branch of record per repository, so both are deleted once this record has landed, and [the ledger](absorption-ledger.md) keeps their tips.

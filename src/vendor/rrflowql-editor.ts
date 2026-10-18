/**
 * The inherited editor language, re-exported under RRFlowQL names.
 *
 * This is SurrealDB's CodeMirror language support (`@surrealdb/codemirror`),
 * not an RRFlowQL grammar: `rrflowql` here is `surrealql`. The query editor
 * highlights and lints the inherited language until RRFlow's native parser
 * exposes a browser extension (sprint 009, Slice D), when this module and the
 * `@surrealdb/codemirror` and `@surrealdb/lezer` dependencies are deleted. Do
 * not add new importers.
 */
export {
	surrealql as rrflowql,
	surrealqlLanguage as rrflowqlLanguage,
	surrealqlVersionLinter as rrflowqlVersionLinter,
} from "@surrealdb/codemirror";

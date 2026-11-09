/**
 * The inherited editor language, re-exported under RRFlowQL names.
 *
 * This is SurrealDB's CodeMirror language support (`@surrealdb/codemirror`),
 * not an RRFlowQL grammar: `rrflowql` here is `surrealql`. Connectome's
 * rrflowQL language is `~/rrflow/editor` (Sprint 009, step F3). Each inherited
 * view moves to it in its own re-authoring step, when its queries move to the
 * engine; this module and the `@surrealdb/codemirror` and `@surrealdb/lezer`
 * dependencies are deleted with the last. Do not add new importers.
 */
export {
	surrealql as rrflowql,
	surrealqlLanguage as rrflowqlLanguage,
	surrealqlVersionLinter as rrflowqlVersionLinter,
} from "@surrealdb/codemirror";

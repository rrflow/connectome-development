/**
 * The rrflowQL source that reads the rows of each table model. This is the
 * same grammar the Data models view runs (`models/models-tab.tsx`); the engine
 * still parses, authorizes and budgets every query.
 */
const ROW_SOURCES: Record<string, string> = {
	document: "record",
	relational: "record",
	graph_node: "record",
	key_value: "record",
	graph_relation: "relation",
	event: "event",
	lifecycle_event: "event",
	reasoning_event: "event",
	reasoning_record: "record",
	lifecycle_record: "record",
	geo: "geo",
};

/** Sources the schema must register on a table before its rows can be read. */
const REGISTERED_SOURCES = new Set(["record", "relation", "event"]);

/** Most rows one read asks for; the engine's own query budget still applies. */
export const TABLE_ROW_LIMIT = 50;

/** A name the query grammar accepts unquoted. */
const QUERYABLE_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function rowSource(model: string): string | undefined {
	return ROW_SOURCES[model];
}

/** Whether the schema must name `source` on a table for its rows to be readable. */
export function needsRegistration(source: string): boolean {
	return REGISTERED_SOURCES.has(source);
}

export function isQueryableName(name: string): boolean {
	return QUERYABLE_NAME.test(name);
}

/** The current rows of one table, as of now, at the newest committed state. */
export function tableRowsQuery(source: string, table: string): string {
	return `FROM ${source}:${table} AT VALID ${Date.now()} KNOWN HEAD PROJECT * LIMIT ${TABLE_ROW_LIMIT}`;
}

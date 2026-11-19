import type { RrdDatabaseView } from "~/rrflow/session";

/** Row bound for the starter queries; the engine's own query budget still applies. */
const STARTER_ROW_LIMIT = 50;
/** A source name the starter queries can spell without quoting. */
const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export interface Starter {
	label: string;
	query: string;
}

/** Starter queries over the kinds this engine really holds, read from its schema. */
export function starters(view: RrdDatabaseView | undefined): Starter[] {
	if (!view) return [];
	const at = `AT VALID ${Date.now()} KNOWN HEAD`;
	const table = view.tables.find(
		(entry) => entry.model === "relational" && PLAIN_NAME.test(entry.name),
	)?.name;
	const kind =
		table ?? view.graph.nodes.find((node) => PLAIN_NAME.test(node.kind))?.kind ?? undefined;
	const relation = view.tables.find(
		(entry) => entry.model === "graph_relation" && PLAIN_NAME.test(entry.name),
	)?.name;
	const list: Starter[] = [];
	if (kind) {
		list.push({
			label: `Read ${kind} records`,
			query: `FROM record:${kind} ${at} PROJECT * LIMIT ${STARTER_ROW_LIMIT}`,
		});
		list.push({
			label: `Read ${kind} records and analyse the run`,
			query: `FROM record:${kind} ${at} PROJECT * EXPLAIN ANALYZE`,
		});
	}
	if (relation) {
		list.push({
			label: `Read ${relation} relations`,
			query: `FROM relation:${relation} ${at} PROJECT * LIMIT ${STARTER_ROW_LIMIT}`,
		});
	}
	return list;
}

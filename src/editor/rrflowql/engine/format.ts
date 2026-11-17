/*
 * Whitespace layout for a query.
 *
 * `layout` puts each clause of the engine's grammar on its own line. It changes
 * whitespace only: every token keeps its text and its order, so a formatted
 * query is the same query to the engine. It never validates and never rewrites.
 */

import { classify } from "./classify.ts";

/** The clauses that start a new line. `FROM` opens the query and `ON` belongs to its `JOIN`. */
const LINE_BREAKS = new Set(["JOIN", "AT", "WHERE", "PROJECT", "LIMIT", "EXPLAIN", "START"]);

/**
 * `pretty` starts each clause on its own line; otherwise the query is only
 * trimmed. A query the engine would refuse is laid out the same way.
 */
export function layout(source: string, pretty = true): string {
	if (!pretty) return source.trim();
	let output = "";
	let previousEnd = 0;
	for (const token of classify(source).tokens) {
		const text = source.slice(token.from, token.to);
		const gap = source.slice(previousEnd, token.from);
		const breaks = token.role === "keyword" && LINE_BREAKS.has(text.toUpperCase());
		output += output && breaks && gap.length > 0 ? "\n" : gap;
		output += text;
		previousEnd = token.to;
	}
	return (output + source.slice(previousEnd)).trim();
}

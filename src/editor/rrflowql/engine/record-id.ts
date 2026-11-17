/*
 * A record address as a reader sees it.
 *
 * The engine reads `kind:id` as three tokens. For links and inspection a person
 * sees one thing, so `recordIds` returns the span of each address: a reference,
 * a colon and a reference with nothing between them. It claims nothing about
 * whether the record exists.
 */

import type { ClassifiedToken } from "./classify.ts";

export interface RecordIdSpan {
	/** Index of the first of the three tokens. */
	token: number;
	from: number;
	to: number;
}

/** The spans of every `kind:id` address in a classified query, in order. */
export function recordIds(tokens: readonly ClassifiedToken[]): RecordIdSpan[] {
	const spans: RecordIdSpan[] = [];
	for (let index = 0; index + 2 < tokens.length; index++) {
		const [kind, colon, id] = [tokens[index], tokens[index + 1], tokens[index + 2]];
		if (
			kind.role === "reference" &&
			colon.kind === "colon" &&
			id.role === "reference" &&
			kind.to === colon.from &&
			colon.to === id.from
		) {
			spans.push({ token: index, from: kind.from, to: id.to });
			index += 2;
		}
	}
	return spans;
}

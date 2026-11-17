/*
 * What place the engine's parser reads each token in.
 *
 * `classify` names each token: a keyword, a source family and kind, a field, a
 * parameter, a value. It never refuses anything. Whether a query is valid is
 * the engine's to say; its refusal, with its location, arrives with the command
 * that sent the query and `refusalRange` places it.
 */

import { type LexicalRefusal, scan, type Token, type TokenKind } from "./scan.ts";

/** The place the engine's parser reads a token in. */
export type Role =
	| "keyword"
	| "family"
	| "kind"
	| "reference"
	| "field"
	| "parameter"
	| "string"
	| "number"
	| "bool"
	| "null"
	| "operator"
	| "punctuation"
	| "word";

export interface ClassifiedToken extends Token {
	role: Role;
}

/** The words the engine's parser reads as keywords, in any case. */
export const KEYWORDS = new Set([
	"FROM",
	"JOIN",
	"ON",
	"AT",
	"VALID",
	"KNOWN",
	"HEAD",
	"WHERE",
	"AND",
	"PROJECT",
	"LIMIT",
	"EXPLAIN",
	"CONTRACT",
	"ANALYZE",
	"START",
	"DIRECTION",
	"DEPTH",
	"OUTGOING",
	"INCOMING",
	"BOTH",
]);

/** The source families a query reads from, in any case. */
export const FAMILIES = new Set([
	"record",
	"relation",
	"event",
	"series",
	"geo",
	"traverse",
	"claim",
]);

// Keywords that open a clause of the parser's grammar.
const CLAUSES = new Set([
	"FROM",
	"JOIN",
	"ON",
	"AT",
	"WHERE",
	"PROJECT",
	"LIMIT",
	"EXPLAIN",
	"START",
	"DIRECTION",
	"DEPTH",
]);
const COMPARISONS = new Set<TokenKind>([
	"equals",
	"not_equals",
	"less_than",
	"less_than_or_equal",
	"greater_than",
	"greater_than_or_equal",
]);

export function classify(source: string): {
	tokens: ClassifiedToken[];
	refusal: LexicalRefusal | null;
} {
	const { tokens, refusal } = scan(source);
	const classified: ClassifiedToken[] = [];
	let clause = "";
	for (const token of tokens) {
		const previous = classified.at(-1);
		const before = classified.at(-2);
		const text = source.slice(token.from, token.to);
		const upper = text.toUpperCase();
		const after = (role: Role, word?: string) =>
			previous?.role === role &&
			(word === undefined || source.slice(previous.from, previous.to).toUpperCase() === word);
		let role: Role;
		switch (token.kind) {
			case "string":
				role = "string";
				break;
			case "number":
				role = "number";
				break;
			case "colon":
			case "comma":
			case "star":
				role = "punctuation";
				break;
			case "word":
				if (text.startsWith("$")) {
					role = "parameter";
				} else if (after("keyword", "FROM") || after("keyword", "JOIN")) {
					role = FAMILIES.has(text.toLowerCase()) ? "family" : "word";
				} else if (previous?.kind === "colon" && before?.role === "family") {
					role = "kind";
				} else if (
					after("keyword", "START") ||
					(previous?.kind === "colon" && before?.role === "reference")
				) {
					role = "reference";
				} else if (
					after("keyword", "WHERE") ||
					after("keyword", "AND") ||
					after("keyword", "ON") ||
					(clause === "ON" && previous?.kind === "equals") ||
					after("keyword", "PROJECT") ||
					(clause === "PROJECT" && previous?.kind === "comma")
				) {
					role = "field";
				} else if (
					clause === "WHERE" &&
					previous?.role === "operator" &&
					["TRUE", "FALSE", "NULL"].includes(upper)
				) {
					role = upper === "NULL" ? "null" : "bool";
				} else if (clause === "WHERE" && previous?.role === "field" && upper === "MATCH") {
					role = "operator";
				} else {
					role = KEYWORDS.has(upper) ? "keyword" : "word";
				}
				break;
			default:
				role = COMPARISONS.has(token.kind) ? "operator" : "punctuation";
		}
		if (role === "keyword" && CLAUSES.has(upper)) {
			clause = upper;
		}
		classified.push({ ...token, role });
	}
	return { tokens: classified, refusal };
}

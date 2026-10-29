/*
 * rrflowQL as the pinned engine reads it, for highlighting.
 *
 * `scan` is the engine's tokenizer (`tokenize` in
 * `crates/compute/rrd-query/src/syntax.rs`): the same tokens, split at the same
 * characters, and the same lexical refusals with the engine's own words. Where
 * the engine stops at its first refusal, `scan` records it and keeps going, so
 * the rest of the query can still be drawn.
 *
 * `classify` names each token by the place the engine's parser reads it in:
 * a keyword, a source family and kind, a field, a parameter, a value. It never
 * refuses anything. Whether a query is valid is the engine's to say; the
 * engine's refusal, with its location, arrives with the command that sent the
 * query (`RrdCommandError.query`) and `refusalRange` places it.
 *
 * `scripts/check-rrflowql.mjs` holds both to what the engine returned for
 * RRFlow's query vectors and a corpus of queries
 * (`src/rrflow/fixtures/engine-queries.json`). Offsets here are UTF-16 code
 * units, as editors count them.
 *
 * This module imports nothing, so Node runs it as written.
 */

export type TokenKind =
	| "word"
	| "string"
	| "number"
	| "colon"
	| "comma"
	| "equals"
	| "not_equals"
	| "less_than"
	| "less_than_or_equal"
	| "greater_than"
	| "greater_than_or_equal"
	| "star";

export interface Token {
	kind: TokenKind;
	from: number;
	to: number;
	/** The engine would refuse the query here. */
	invalid: boolean;
}

/** The first refusal the engine's tokenizer makes, in its own words. */
export interface LexicalRefusal {
	offset: number;
	reason: string;
}

export interface Scan {
	tokens: Token[];
	refusal: LexicalRefusal | null;
}

/** Every refusal the engine's tokenizer can make. */
export const LEXICAL_REASONS = [
	"unterminated string literal",
	"unterminated string escape",
	"unsupported string escape",
	"integer is outside u64 range",
	"unsupported query character",
] as const;

// Rust's `u8::is_ascii_whitespace`: no vertical tab.
const WHITESPACE = new Set([" ", "\t", "\n", "\f", "\r"]);
// Characters that end a word.
const BREAKS = new Set([":", ",", "=", "!", "<", ">", "*", '"']);
const ESCAPES = new Set(['"', "\\", "n", "r", "t"]);
const U64_MAX = 2n ** 64n - 1n;

const isDigit = (character: string | undefined) =>
	character !== undefined && character >= "0" && character <= "9";

export function scan(source: string): Scan {
	const tokens: Token[] = [];
	let refusal: LexicalRefusal | null = null;
	const refuse = (offset: number, reason: (typeof LEXICAL_REASONS)[number]) => {
		refusal ??= { offset, reason };
	};
	const push = (kind: TokenKind, from: number, to: number, invalid = false) =>
		tokens.push({ kind, from, to, invalid });

	let cursor = 0;
	while (cursor < source.length) {
		const character = source[cursor];
		if (WHITESPACE.has(character)) {
			cursor++;
			continue;
		}
		const from = cursor;
		const next = source[cursor + 1];
		if (character === ":") {
			push("colon", from, ++cursor);
		} else if (character === ",") {
			push("comma", from, ++cursor);
		} else if (character === "=") {
			push("equals", from, ++cursor);
		} else if (character === "!" && next === "=") {
			cursor += 2;
			push("not_equals", from, cursor);
		} else if (character === "<" || character === ">") {
			cursor += next === "=" ? 2 : 1;
			const kind = character === "<" ? "less_than" : "greater_than";
			push(next === "=" ? `${kind}_or_equal` : kind, from, cursor);
		} else if (character === "*") {
			push("star", from, ++cursor);
		} else if (character === '"') {
			cursor++;
			let closed = false;
			let invalid = false;
			while (cursor < source.length) {
				const inner = source[cursor];
				if (inner === '"') {
					cursor++;
					closed = true;
					break;
				}
				if (inner === "\\") {
					cursor++;
					if (cursor >= source.length) {
						refuse(from, "unterminated string escape");
						invalid = true;
						break;
					}
					if (!ESCAPES.has(source[cursor])) {
						refuse(cursor, "unsupported string escape");
						invalid = true;
					}
				}
				// One UTF-16 unit at a time: every character that matters here
				// is ASCII, and a surrogate pair is never one of them.
				cursor++;
			}
			if (!closed) refuse(from, "unterminated string literal");
			push("string", from, cursor, invalid || !closed);
		} else if (isDigit(character)) {
			while (isDigit(source[cursor])) cursor++;
			const invalid = BigInt(source.slice(from, cursor)) > U64_MAX;
			if (invalid) refuse(from, "integer is outside u64 range");
			push("number", from, cursor, invalid);
		} else {
			while (
				cursor < source.length &&
				!WHITESPACE.has(source[cursor]) &&
				!BREAKS.has(source[cursor])
			) {
				cursor++;
			}
			if (cursor === from) {
				// A lone `!`: the only break that starts no token.
				refuse(from, "unsupported query character");
				push("word", from, ++cursor, true);
			} else {
				push("word", from, cursor);
			}
		}
	}
	return { tokens, refusal };
}

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

/**
 * The span an engine refusal at `offset` names: the token the offset falls
 * in, the next character when it falls between tokens, or the last
 * character when it falls at the end.
 */
export function refusalRange(source: string, offset: number): { from: number; to: number } {
	const at = Math.max(0, Math.min(offset, source.length));
	const token = scan(source).tokens.find((token) => token.from <= at && at < token.to);
	if (token) return { from: token.from, to: token.to };
	if (at < source.length) return { from: at, to: at + 1 };
	return { from: Math.max(0, source.length - 1), to: source.length };
}

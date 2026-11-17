/*
 * The engine's tokenizer, for highlighting and for the one editor's diagnostics.
 *
 * `scan` is `tokenize` in `crates/compute/rrd-query/src/syntax.rs`: the same
 * tokens, split at the same characters, and the same lexical refusals with the
 * engine's own words. Where the engine stops at its first refusal, `scan`
 * records it and keeps going, so the rest of the query can still be drawn.
 *
 * `scripts/check-rrflowql.mjs` holds it to what the engine returned for
 * RRFlow's query vectors and a corpus of queries
 * (`src/rrflow/fixtures/engine-queries.json`). Offsets are UTF-16 code units,
 * as editors count them. This module imports nothing, so Node runs it as written.
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

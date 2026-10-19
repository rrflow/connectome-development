/**
 * RRFlow-authored presentation tokens. This scanner supports coloring, source
 * selection, and parameter discovery only. The RRD parser owns query validity.
 * Native vocabulary is defined by crates/compute/rrd-query/src/syntax.rs.
 */
export const RRFLOWQL_KEYWORDS = new Set(
	"FROM JOIN ON AT VALID KNOWN HEAD WHERE AND PROJECT LIMIT EXPLAIN CONTRACT ANALYZE START DIRECTION DEPTH OUTGOING INCOMING BOTH MATCH BEGIN MUTATE COMMIT CANCEL".split(
		" ",
	),
);

export type PresentationTokenKind =
	| "Keyword"
	| "Identifier"
	| "TypeName"
	| "VariableName"
	| "LetStatementName"
	| "RecordId"
	| "String"
	| "Number"
	| "Boolean"
	| "Null"
	| "Comment"
	| "Operator"
	| "Punctuation";

export interface PresentationToken {
	kind: PresentationTokenKind;
	from: number;
	to: number;
}

const WORD = /[\p{L}\p{N}_.$-]/u;
const WORD_START = /[\p{L}_$]/u;

/** Scan incomplete source without claiming it is accepted RRFlowQL. */
export function scanRRFlowQL(source: string): PresentationToken[] {
	const tokens: PresentationToken[] = [];
	let cursor = 0;
	while (cursor < source.length) {
		const from = cursor;
		const character = source[cursor];
		if (/\s/u.test(character)) {
			cursor++;
			continue;
		}

		let kind: PresentationTokenKind;
		if (
			source.startsWith("--", cursor) ||
			source.startsWith("//", cursor) ||
			character === "#"
		) {
			kind = "Comment";
			while (cursor < source.length && source[cursor] !== "\n") cursor++;
		} else if (source.startsWith("/*", cursor)) {
			kind = "Comment";
			const end = source.indexOf("*/", cursor + 2);
			cursor = end < 0 ? source.length : end + 2;
		} else if ("\"'`⟨".includes(character)) {
			kind = character === "`" || character === "⟨" ? "Identifier" : "String";
			const closing = character === "⟨" ? "⟩" : character;
			cursor++;
			while (cursor < source.length) {
				if (source[cursor] === "\\") {
					cursor = Math.min(source.length, cursor + 2);
				} else if (source[cursor++] === closing) {
					break;
				}
			}
		} else if (WORD_START.test(character)) {
			cursor++;
			while (cursor < source.length && WORD.test(source[cursor])) cursor++;
			const text = source.slice(from, cursor);
			const upper = text.toUpperCase();
			kind = text.startsWith("$")
				? "VariableName"
				: upper === "TRUE" || upper === "FALSE"
					? "Boolean"
					: upper === "NULL"
						? "Null"
						: RRFLOWQL_KEYWORDS.has(upper)
							? "Keyword"
							: "Identifier";
			// A kind:id address is useful for record-link presentation. It is not
			// a declaration that this address exists or is a valid query source.
			if (
				kind === "Identifier" &&
				source[cursor] === ":" &&
				WORD_START.test(source[cursor + 1] ?? "")
			) {
				cursor += 2;
				while (cursor < source.length && WORD.test(source[cursor])) cursor++;
				const previous = tokens.at(-1);
				const previousWord =
					previous && source.slice(previous.from, previous.to).toUpperCase();
				kind =
					previous?.kind === "Keyword" &&
					(previousWord === "FROM" || previousWord === "JOIN")
						? "TypeName"
						: "RecordId";
			}
		} else if (/\d/u.test(character)) {
			kind = "Number";
			cursor++;
			while (cursor < source.length && /[\d.eE+-]/u.test(source[cursor])) cursor++;
		} else {
			kind = /[=!<>+*/|&?~-]/u.test(character) ? "Operator" : "Punctuation";
			cursor++;
			if (kind === "Operator" && source[cursor] === "=") cursor++;
		}
		tokens.push({ kind, from, to: cursor });
	}
	return tokens;
}

/** Split editor statements only at semicolons outside strings and containers. */
export function rrflowqlStatementRanges(source: string): { from: number; to: number }[] {
	const ranges: { from: number; to: number }[] = [];
	const tokens = scanRRFlowQL(source);
	let from: number | undefined;
	let depth = 0;
	let lastEnd = 0;
	for (const token of tokens) {
		if (token.kind === "Comment") continue;
		from ??= token.from;
		lastEnd = token.to;
		if (token.kind !== "Punctuation") continue;
		const text = source.slice(token.from, token.to);
		if ("([{<".includes(text)) depth++;
		if (")]}>".includes(text)) depth = Math.max(0, depth - 1);
		if (text === ";" && depth === 0) {
			ranges.push({ from, to: token.to });
			from = undefined;
		}
	}
	if (from !== undefined) ranges.push({ from, to: lastEnd });
	return ranges;
}

/** Source-preserving whitespace layout, never canonicalization or validation. */
export function layoutRRFlowQL(source: string, pretty = true): string {
	if (!pretty) return source.trim();
	const breaks = new Set(["JOIN", "AT", "WHERE", "PROJECT", "LIMIT", "EXPLAIN"]);
	const tokens = scanRRFlowQL(source);
	let output = "";
	let previousEnd = 0;
	for (const token of tokens) {
		const text = source.slice(token.from, token.to);
		const gap = source.slice(previousEnd, token.from);
		const breakBefore = token.kind === "Keyword" && breaks.has(text.toUpperCase());
		output += output && breakBefore && gap.length > 0 ? "\n" : gap;
		output += text;
		previousEnd = token.to;
	}
	return (output + source.slice(previousEnd)).trim();
}

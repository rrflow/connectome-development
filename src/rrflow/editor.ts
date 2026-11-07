import { defineLanguageFacet, Language, LanguageSupport } from "@codemirror/language";
import { type Diagnostic, setDiagnostics } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import {
	type Input,
	NodeSet,
	NodeType,
	Parser,
	type PartialParse,
	Tree,
	type TreeFragment,
} from "@lezer/common";
import { styleTags, tags } from "@lezer/highlight";
import { classify, type Role, refusalRange } from "./rrflowql";
import type { RrdQueryError } from "./session";

/*
 * The rrflowQL editor language: a syntax tree built from `classify`, so the
 * editor reads a query exactly as the engine's tokenizer and parser do, styled
 * with the tags the inherited editor's grammar uses for the same things.
 * Diagnostics come only from the engine: `showRefusal` places the refusal a
 * command returned for the query in the editor.
 */

const ROLE_NODES: Record<Role, string> = {
	keyword: "Keyword",
	family: "Family",
	kind: "Kind",
	reference: "Reference",
	field: "Field",
	parameter: "Parameter",
	string: "String",
	number: "Number",
	bool: "Bool",
	null: "Null",
	operator: "Operator",
	punctuation: "Punctuation",
	word: "Word",
};
const ROLES = Object.keys(ROLE_NODES) as Role[];
const INVALID = ROLES.length + 1;

const nodes = new NodeSet([
	NodeType.define({ id: 0, name: "Query", top: true }),
	...ROLES.map((role, index) => NodeType.define({ id: index + 1, name: ROLE_NODES[role] })),
	NodeType.define({ id: INVALID, name: "Invalid", error: true }),
]).extend(
	styleTags({
		Keyword: tags.keyword,
		Family: tags.typeName,
		"Kind Reference": tags.className,
		Field: tags.propertyName,
		Parameter: tags.variableName,
		String: tags.string,
		Number: tags.number,
		Bool: tags.bool,
		Null: tags.null,
		Operator: tags.operator,
		Punctuation: tags.punctuation,
		Word: tags.name,
		Invalid: tags.invalid,
	}),
);

/** A whole query, read in one pass: queries are short and bounded. */
class RrflowqlParser extends Parser {
	createParse(
		input: Input,
		_fragments: readonly TreeFragment[],
		ranges: readonly { from: number; to: number }[],
	): PartialParse {
		const from = ranges[0]?.from ?? 0;
		const to = ranges.at(-1)?.to ?? input.length;
		const text = input.read(from, to);
		return {
			parsedPos: to,
			stoppedAt: null,
			stopAt() {},
			advance() {
				const buffer: number[] = [];
				for (const token of classify(text).tokens) {
					const type = token.invalid ? INVALID : ROLES.indexOf(token.role) + 1;
					buffer.push(type, from + token.from, from + token.to, 4);
				}
				return Tree.build({ buffer, nodeSet: nodes, topID: 0, length: to - from });
			},
		};
	}
}

export const rrflowqlLanguage = new Language(
	defineLanguageFacet({}),
	new RrflowqlParser(),
	[],
	"rrflowql",
);

/** rrflowQL highlighting for a `CodeEditor`. */
export function rrflowql(): LanguageSupport {
	return new LanguageSupport(rrflowqlLanguage);
}

/** The engine's refusal of `query`, on the token it names. */
export function refusalDiagnostic(query: string, refusal: RrdQueryError): Diagnostic {
	return {
		...refusalRange(query, refusal.offset),
		severity: "error",
		message: refusal.reason,
		source: "RRFlow engine",
	};
}

/**
 * Shows the engine's refusal of the editor's query, or clears it. A refusal
 * belongs to the text it was given for, so it shows only while the editor
 * holds that text.
 */
export function showRefusal(
	view: EditorView,
	refused: { query: string; refusal: RrdQueryError } | null,
): void {
	const doc = view.state.doc.toString();
	const diagnostics =
		refused && refused.query === doc ? [refusalDiagnostic(doc, refused.refusal)] : [];
	view.dispatch(setDiagnostics(view.state, diagnostics));
}

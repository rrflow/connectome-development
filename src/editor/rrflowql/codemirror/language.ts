import { defineLanguageFacet, Language, LanguageSupport } from "@codemirror/language";
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
import { classify, type Role, recordIds } from "../engine/index.ts";

/*
 * The one rrflowQL language. Its syntax tree is the engine's own reading of a
 * query (`classify`), styled with the tags the editor theme already knows.
 * Nothing here decides whether a query is valid: tokens the engine would refuse
 * are drawn as `Invalid`, and the engine's refusal arrives with the command.
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
const RECORD_ID = ROLES.length + 1;
const INVALID = ROLES.length + 2;
/** A buffer entry is `[type, from, to, size]`; a node's size counts its children's. */
const LEAF = 4;

const nodes = new NodeSet([
	NodeType.define({ id: 0, name: "Query", top: true }),
	...ROLES.map((role, index) => NodeType.define({ id: index + 1, name: ROLE_NODES[role] })),
	NodeType.define({ id: RECORD_ID, name: "RecordId" }),
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
export function buildTree(text: string, offset = 0): Tree {
	const { tokens } = classify(text);
	const addresses = new Map(recordIds(tokens).map((span) => [span.token, span]));
	const buffer: number[] = [];
	for (let index = 0; index < tokens.length; index++) {
		const address = addresses.get(index);
		const count = address ? 3 : 1;
		for (const token of tokens.slice(index, index + count)) {
			const type = token.invalid ? INVALID : ROLES.indexOf(token.role) + 1;
			buffer.push(type, offset + token.from, offset + token.to, LEAF);
		}
		if (address) {
			buffer.push(RECORD_ID, offset + address.from, offset + address.to, LEAF * (count + 1));
			index += count - 1;
		}
	}
	return Tree.build({ buffer, nodeSet: nodes, topID: 0, length: offset + text.length });
}

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
			advance: () => buildTree(text, from),
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

import { defineLanguageFacet, languageDataProp } from "@codemirror/language";
import {
	type Input,
	NodeType,
	Parser,
	type PartialParse,
	Tree,
	type TreeFragment,
} from "@lezer/common";
import { styleTags, tags } from "@lezer/highlight";
import { type PresentationTokenKind, rrflowqlStatementRanges, scanRRFlowQL } from "./lexical";

export const rrflowqlLanguageData = defineLanguageFacet({
	commentTokens: { line: "--", block: { open: "/*", close: "*/" } },
	closeBrackets: { brackets: ["(", "[", "{", '"'] },
});

const styles = styleTags({
	Keyword: tags.keyword,
	Identifier: tags.name,
	TypeName: tags.typeName,
	VariableName: tags.variableName,
	LetStatementName: tags.definition(tags.variableName),
	RecordId: tags.special(tags.name),
	String: tags.string,
	Number: tags.number,
	Boolean: tags.bool,
	Null: tags.null,
	Comment: tags.comment,
	Operator: tags.operator,
	Punctuation: tags.punctuation,
});

const top = NodeType.define({
	id: 0,
	name: "RRFlowQL",
	top: true,
	props: [[languageDataProp, rrflowqlLanguageData]],
});
const statement = NodeType.define({ id: 1, name: "Statement" });
const kinds: PresentationTokenKind[] = [
	"Keyword",
	"Identifier",
	"TypeName",
	"VariableName",
	"LetStatementName",
	"RecordId",
	"String",
	"Number",
	"Boolean",
	"Null",
	"Comment",
	"Operator",
	"Punctuation",
];
const nodeTypes = new Map(
	kinds.map((name, index) => [name, NodeType.define({ id: index + 2, name, props: [styles] })]),
);

function tokenType(kind: PresentationTokenKind): NodeType {
	const type = nodeTypes.get(kind);
	if (!type) throw new Error(`Missing RRFlow presentation token type: ${kind}`);
	return type;
}

/**
 * A presentation tree, authored for Connectome. It deliberately has no syntax
 * error nodes: only RRD can report semantic parse/validation results.
 */
function presentationTree(source: string): Tree {
	const tokens = scanRRFlowQL(source);
	const ranges = rrflowqlStatementRanges(source);
	const children: Tree[] = [];
	const positions: number[] = [];
	let tokenIndex = 0;
	for (const range of ranges) {
		while (tokenIndex < tokens.length && tokens[tokenIndex].to <= range.from) {
			const token = tokens[tokenIndex++];
			children.push(new Tree(tokenType(token.kind), [], [], token.to - token.from));
			positions.push(token.from);
		}
		const statementChildren: Tree[] = [];
		const statementPositions: number[] = [];
		while (tokenIndex < tokens.length && tokens[tokenIndex].from < range.to) {
			const token = tokens[tokenIndex++];
			statementChildren.push(new Tree(tokenType(token.kind), [], [], token.to - token.from));
			statementPositions.push(token.from - range.from);
		}
		children.push(
			new Tree(statement, statementChildren, statementPositions, range.to - range.from),
		);
		positions.push(range.from);
	}
	for (; tokenIndex < tokens.length; tokenIndex++) {
		const token = tokens[tokenIndex];
		children.push(new Tree(tokenType(token.kind), [], [], token.to - token.from));
		positions.push(token.from);
	}
	return new Tree(top, children, positions, source.length);
}

class RRFlowQLPresentationParser extends Parser {
	createParse(
		input: Input,
		_fragments: readonly TreeFragment[],
		ranges: readonly { from: number; to: number }[],
	): PartialParse {
		const from = ranges[0]?.from ?? 0;
		const end = ranges.at(-1)?.to ?? input.length;
		let stoppedAt: number | null = null;
		let parsedPos = from;
		return {
			get parsedPos() {
				return parsedPos;
			},
			get stoppedAt() {
				return stoppedAt;
			},
			stopAt(position) {
				if (stoppedAt !== null && position > stoppedAt) {
					throw new RangeError("A presentation parse cannot extend its stop position");
				}
				stoppedAt = position;
			},
			advance() {
				const to = Math.min(end, stoppedAt ?? end);
				// Mask excluded ranges without moving source offsets.
				let source = "";
				let position = from;
				for (const range of ranges) {
					if (range.from >= to) break;
					source += " ".repeat(Math.max(0, range.from - position));
					source += input.read(range.from, Math.min(to, range.to));
					position = Math.min(to, range.to);
				}
				parsedPos = to;
				return presentationTree(source);
			},
		};
	}
}

export const rrflowqlPresentationParser = new RRFlowQLPresentationParser();

import { syntaxTree } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getRRFlowQL, hasRRFlowQL } from "~/screens/connectome/connection/connection";
import { getSetting } from "~/shared/util/config";
import { RRFLOWQL_VALIDATION_UNAVAILABLE } from "~/shared/util/rrflowql/native";

const findStatement = (stack: any): [number, number] | null => {
	let last: any = null;

	for (let cur = stack; cur; cur = cur.next) {
		const { node } = cur;

		if (node.type.is("Statement") || node.type.is("BinaryExpression") || node.type.is("Path")) {
			last = cur;
		}
	}

	return last ? [last.node.from, last.node.to] : null;
};

/**
 * Returns the range of the query the cursor is currently in
 */
export const getQueryRange = (view: EditorView, head?: number): [number, number] | null => {
	const tree = syntaxTree(view.state);
	const cursor = head ?? view.state.selection.main.head;
	const isTerm = view.state.sliceDoc(cursor - 1, cursor) === ";";

	// Find a query to the right
	const rightStack = tree.resolveStack(cursor, 1);
	const rightStatement = findStatement(rightStack);

	if (rightStatement) {
		return rightStatement;
	}

	// Find a query to the left, optionally skipping a semicolon
	const leftStack = tree.resolveStack(isTerm ? cursor - 1 : cursor, -1);
	const leftStatement = findStatement(leftStack);

	if (leftStatement) {
		return leftStatement;
	}

	return null;
};

/**
 * RRFlowQL error linting
 *
 * @param onValidate Callback to run when the query is validated
 */
export const rrflowqlLinting = (onValidate?: (status: string) => void): Extension =>
	linter(
		async (view) => {
			const isEnabled = getSetting("behavior", "queryErrorChecker");
			const content = view.state.doc.toString();

			if (!isEnabled || !content || !hasRRFlowQL()) {
				return [];
			}

			let message: string;
			try {
				message = (await getRRFlowQL().validateQuery(content)) || "";
			} catch (error) {
				message = error instanceof Error ? error.message : String(error);
			}
			const match = message.match(/^Parse error: (.+)?\s+-->\s+\[(\d+):(\d+)\]/i);

			if (match) {
				const reason = match[1].trim();
				const lineNumber = Number.parseInt(match[2], 10);
				const column = Number.parseInt(match[3], 10);

				const line = view.state.doc.line(
					Math.max(1, Math.min(view.state.doc.lines, lineNumber)),
				);
				const position = Math.max(line.from, Math.min(line.to, line.from + column - 1));
				const word = view.state.wordAt(position);

				onValidate?.(reason);

				return [
					word
						? {
								from: word.from,
								to: word.to,
								message: reason,
								severity: "error",
								source: "RRFlowQL",
							}
						: {
								from: position,
								to: Math.min(content.length, position + 1),
								message: reason,
								severity: "error",
								source: "RRFlowQL",
							},
				];
			}

			if (message) {
				onValidate?.(message);
				return [
					{
						from: 0,
						to: Math.min(content.length, 1),
						message,
						severity: message === RRFLOWQL_VALIDATION_UNAVAILABLE ? "warning" : "error",
						source: "RRFlowQL",
					},
				];
			}

			onValidate?.("");
			return [];
		},
		{
			delay: 250,
		},
	);

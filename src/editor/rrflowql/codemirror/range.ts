import type { EditorView } from "@codemirror/view";

/**
 * The query the cursor is in. The engine takes one query per request, so that
 * is the whole text without the whitespace around it, or nothing when the
 * editor holds no query.
 */
export function getQueryRange(view: EditorView, _head?: number): [number, number] | null {
	const text = view.state.doc.toString();
	const from = text.length - text.trimStart().length;
	const to = text.trimEnd().length;
	return to > from ? [from, to] : null;
}

import { type Diagnostic, setDiagnostics } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { RrdQueryError } from "~/rrflow/session";
import { refusalRange } from "../engine/index.ts";

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

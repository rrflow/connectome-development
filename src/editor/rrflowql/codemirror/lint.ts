import { linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { getSetting } from "~/shared/util/config/config";
import { refusalRange, scan } from "../engine/index.ts";

/**
 * Lexical checking as the engine's tokenizer does it, with the engine's own
 * words. It finds what the tokenizer would refuse (an unterminated string, an
 * unsupported character); everything else is the engine's to say when the
 * query runs, and arrives through `showRefusal`.
 *
 * @param onValidate Called with the refusal reason, or an empty string when the
 *   query passes the tokenizer.
 */
export const rrflowqlLinting = (onValidate?: (reason: string) => void): Extension =>
	linter(
		(view) => {
			const content = view.state.doc.toString();
			if (!getSetting("behavior", "queryErrorChecker") || !content) return [];
			const { refusal } = scan(content);
			onValidate?.(refusal?.reason ?? "");
			if (!refusal) return [];
			return [
				{
					...refusalRange(content, refusal.offset),
					severity: "error",
					message: refusal.reason,
					source: "RRFlow engine",
				},
			];
		},
		{ delay: 250 },
	);

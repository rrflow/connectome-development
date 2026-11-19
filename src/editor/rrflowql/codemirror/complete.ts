import type { CompletionSource } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { FAMILIES } from "../engine/index.ts";
import { rrflowqlLanguage } from "./language.ts";

/** After `FROM` or `JOIN`: the family being typed. */
const FAMILY = /\b(?:from|join)\s+(\w*)$/i;
/** After `family:`: the kind being typed. */
const KIND = /\b(?:from|join)\s+(\w+):([\w.-]*)$/i;
/** How far back a source can start; a source is one short word pair. */
const LOOK_BEHIND = 256;

/**
 * Completes what a query reads from: the source family after `FROM` or `JOIN`,
 * then the kinds the engine's schema lists for that family.
 *
 * @param kinds The kinds per family, read when a completion is asked for.
 */
export const rrflowqlSourceCompletion = (kinds: () => Record<string, string[]>): Extension => {
	const autocomplete: CompletionSource = (context) => {
		const from = Math.max(0, context.pos - LOOK_BEHIND);
		const before = context.state.sliceDoc(from, context.pos);
		const kind = KIND.exec(before);
		if (kind) {
			const names = kinds()[kind[1].toLowerCase()] ?? [];
			return {
				from: context.pos - kind[2].length,
				validFor: /^[\w.-]*$/,
				options: names.map((label) => ({ label, type: "class" })),
			};
		}
		const family = FAMILY.exec(before);
		if (family) {
			return {
				from: context.pos - family[1].length,
				validFor: /^\w*$/,
				options: [...FAMILIES].map((label) => ({
					label,
					type: "type",
					apply: `${label}:`,
				})),
			};
		}
		return null;
	};
	return rrflowqlLanguage.data.of({ autocomplete });
};

/**
 * Completes `$name` with the parameters that have a value.
 *
 * @param names The parameter names, without `$`, read when asked.
 */
export const rrflowqlParameterCompletion = (names: () => string[]): Extension => {
	const autocomplete: CompletionSource = (context) => {
		const match = context.matchBefore(/\$[\w.]*/);
		if (!match) return null;
		return {
			from: match.from,
			validFor: /^\$[\w.]*$/,
			options: names().map((name) => ({ label: `$${name}`, type: "variable" })),
		};
	};
	return rrflowqlLanguage.data.of({ autocomplete });
};

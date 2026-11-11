import { type CompletionSource, snippetCompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { useDatabaseStore } from "~/stores/database";
import { rrflowqlLanguage } from "~/vendor/rrflowql-editor";

const CUSTOM_FUNCTION_SOURCE: CompletionSource = (context) => {
	const match = context.matchBefore(/fn::\w*/i);
	const functions = useDatabaseStore.getState().connectionSchema.database.functions;
	const names = functions.map((fn) => `fn::${fn.name}`);

	if (!context.explicit && !match) {
		return null;
	}

	return {
		from: match ? match.from : context.pos,
		validFor: /[\w:]+$/,
		options: names.map((label) =>
			snippetCompletion(`${label}(#{1})`, {
				label,
				type: "function",
			}),
		),
	};
};

/**
 * An extension used to autocomplete table names
 */
export const rrflowqlCustomFunctionCompletion = (): Extension => {
	return rrflowqlLanguage.data.of({
		autocomplete: CUSTOM_FUNCTION_SOURCE,
	});
};

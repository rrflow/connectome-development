import type { KeyBinding } from "@codemirror/view";
import { suggestCompletions } from "./commands";
import { executeGraphqlEditorQuery, selectCursorQuery } from "./query";

/*
 * Keymaps of the inherited query and GraphQL editors. They run queries
 * through the inherited client (./query), so they are kept apart from the
 * generic keymaps the base editor setup loads on every page.
 */

/**
 * A keymap used to run the editor contents as a query
 */
export const runQueryKeymap: readonly KeyBinding[] = [
	{ key: "Mod-Enter", run: () => true },
	{ key: "Mod-e", run: selectCursorQuery },
];

/**
 * A keymap used to run the editor contents as a GraphQL query
 */
export const runGraphqlQueryKeymap: readonly KeyBinding[] = [
	{ key: "Mod-Enter", run: executeGraphqlEditorQuery },
	{ key: "F9", run: executeGraphqlEditorQuery },
];

/**
 * A keymap used to suggest GraphQL completions
 */
export const graphqlSuggestions: readonly KeyBinding[] = [
	{ key: "Enter", run: suggestCompletions },
	{ key: "Shift-(", run: suggestCompletions },
];

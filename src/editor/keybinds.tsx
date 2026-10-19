import { acceptCompletion } from "@codemirror/autocomplete";
import type { KeyBinding } from "@codemirror/view";

/**
 * A keybind used to accept a completion
 */
export const acceptWithTab: KeyBinding = {
	key: "Tab",
	run: acceptCompletion,
};

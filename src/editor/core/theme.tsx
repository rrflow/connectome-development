import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t, tagHighlighter } from "@lezer/highlight";
import type { ColorScheme, SyntaxTheme } from "~/shared/types";

type ThemeConfig = { light: HighlightStyle; dark: HighlightStyle };

/**
 * Default theme
 */
const DEFAULT_THEME: ThemeConfig = {
	light: HighlightStyle.define(
		[
			{ tag: t.string, color: "#00a547" },
			{ tag: t.comment, color: "#737e98" },
			{ tag: t.number, color: "#00b3d0" },
			{ tag: t.variableName, color: "#b82e2e" },
			{ tag: t.className, color: "#0084FF" },
			{ tag: [t.keyword, t.operator], color: "#b84d00" },
			{ tag: [t.punctuation, t.name], color: "#000000" },
			{ tag: [t.typeName, t.null, t.bool, t.literal], color: "#0f6b73" },
			{ tag: t.function(t.name), color: "#8f3b00" },
		],
		{ themeType: "light" },
	),
	dark: HighlightStyle.define(
		[
			{ tag: t.string, color: "#00ff6e" },
			{ tag: t.comment, color: "#737e98" },
			{ tag: t.number, color: "#00DBFF" },
			{ tag: t.variableName, color: "#ffd000" },
			{ tag: t.className, color: "#0084FF" },
			{ tag: [t.keyword, t.operator], color: "#ec7f3a" },
			{ tag: [t.punctuation, t.name], color: "#ffffff" },
			{ tag: [t.typeName, t.null, t.bool, t.literal], color: "#5fc4cb" },
			{ tag: t.function(t.name), color: "#ffbe94" },
		],
		{ themeType: "dark" },
	),
};

/**
 * Vivid theme
 */
const VIVID_THEME: ThemeConfig = {
	light: HighlightStyle.define(
		[
			{ tag: t.operator, color: "#0f6b73" },
			{ tag: t.string, color: "#00a547" },
			{ tag: t.comment, color: "#737e98" },
			{ tag: t.propertyName, color: "#b80000" },
			{ tag: t.className, color: "#0097ff" },
			{ tag: t.variableName, color: "#0f5c63" },
			{ tag: [t.keyword, t.operator], color: "#b84d00" },
			{ tag: [t.punctuation, t.name], color: "#000000" },
			{ tag: [t.typeName, t.null, t.bool, t.literal], color: "#0f6b73" },
			{ tag: [t.function(t.name), t.number], color: "#8f3b00" },
		],
		{ themeType: "light" },
	),
	dark: HighlightStyle.define(
		[
			{ tag: t.string, color: "#00ff6e" },
			{ tag: t.comment, color: "#737e98" },
			{ tag: t.propertyName, color: "#e06c75" },
			{ tag: t.className, color: "#00d1ff" },
			{ tag: t.variableName, color: "#ffd000" },
			{ tag: [t.keyword, t.operator], color: "#ec7f3a" },
			{ tag: [t.punctuation, t.name], color: "#ffffff" },
			{ tag: [t.typeName, t.null, t.bool, t.literal], color: "#5fc4cb" },
			{ tag: [t.function(t.name), t.number], color: "#ffbe94" },
		],
		{ themeType: "dark" },
	),
};

const THEME_CONFIGS: Record<SyntaxTheme, ThemeConfig> = {
	default: DEFAULT_THEME,
	vivid: VIVID_THEME,
};

/**
 * Use a specific syntax theme with the given color scheme
 */
export const editorTheme = (colorScheme: ColorScheme, syntaxTheme: SyntaxTheme) =>
	syntaxHighlighting(THEME_CONFIGS[syntaxTheme][colorScheme], { fallback: true });

/**
 * Create a style highlighter for the given color scheme and syntax theme
 */
export function createStyleHighlighter(colorScheme: ColorScheme, syntaxTheme: SyntaxTheme) {
	return tagHighlighter(
		THEME_CONFIGS[syntaxTheme][colorScheme].specs.map((a) => ({ ...a, class: a.color })),
	);
}

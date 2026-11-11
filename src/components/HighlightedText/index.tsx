import { useColorScheme } from "@mantine/hooks";
import { useMemo } from "react";
import { CodeLang } from "~/shared/types";
import { renderHighlighting } from "~/shared/util/text/highlighting";
import { useConfigStore } from "~/shell/stores/config";
import classes from "./style.module.scss";

export interface HighlightedTextProps {
	children: string;
	language?: CodeLang | "rrflowql";
}

export function HighlightedText({ children, language = "rrflowql" }: HighlightedTextProps) {
	const colorScheme = useColorScheme();
	const syntaxTheme = useConfigStore((state) => state.settings.appearance.syntaxTheme);

	const highlightedText = useMemo(() => {
		return renderHighlighting(children, language, colorScheme, syntaxTheme);
	}, [children, language, colorScheme, syntaxTheme]);

	return (
		<span
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Safe to use
			dangerouslySetInnerHTML={{ __html: highlightedText }}
			className={classes.textRoot}
		/>
	);
}

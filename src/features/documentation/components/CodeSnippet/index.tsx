import { useMemo } from "react";
import { CodeBlock, CodeBlockProps } from "~/components/CodeBlock";
import type { CodeLang, Snippets } from "~/shared/types";
import { dedent } from "~/shared/util/text/dedent";

export interface CodeSnippetProps extends Omit<CodeBlockProps, "value"> {
	values: Snippets;
	language: CodeLang;
	editorLanguage?: string;
}

export function CodeSnippet({ values, language, editorLanguage, ...other }: CodeSnippetProps) {
	const snippet = useMemo(() => {
		const value = values[language];
		return value ? dedent(value) : undefined;
	}, [values, language]);

	return (
		<CodeBlock
			value={snippet || "No example available for this language"}
			lang={editorLanguage || language}
			{...other}
		/>
	);
}

import { StreamLanguage } from "@codemirror/language";
import { c, cpp, csharp, java } from "@codemirror/legacy-modes/mode/clike";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import type { Parser } from "@lezer/common";
import { parser as goParser } from "@lezer/go";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { parser as htmlParser } from "@lezer/html";
import { parser as javascriptParser } from "@lezer/javascript";
import { parser as jsonParser } from "@lezer/json";
import { parser as phpParser } from "@lezer/php";
import { parser as pythonParser } from "@lezer/python";
import { parser as rustParser } from "@lezer/rust";
import { parser as yamlParser } from "@lezer/yaml";
import type { ReactNode } from "react";
import { rrflowqlPresentationParser } from "../editor/parser";

const shellParser = StreamLanguage.define(shell).parser;
const parsers: Record<string, Parser> = {
	rrflowql: rrflowqlPresentationParser,
	json: jsonParser,
	js: javascriptParser,
	javascript: javascriptParser,
	jsx: javascriptParser.configure({ dialect: "jsx" }),
	ts: javascriptParser.configure({ dialect: "ts" }),
	typescript: javascriptParser.configure({ dialect: "ts" }),
	rust: rustParser,
	py: pythonParser,
	python: pythonParser,
	go: goParser,
	php: phpParser,
	html: htmlParser,
	xml: htmlParser,
	yaml: yamlParser,
	yml: yamlParser,
	cli: shellParser,
	bash: shellParser,
	sh: shellParser,
	shell: shellParser,
	c: StreamLanguage.define(c).parser,
	cpp: StreamLanguage.define(cpp).parser,
	csharp: StreamLanguage.define(csharp).parser,
	java: StreamLanguage.define(java).parser,
};

// Diagnostics can contain whole records. Color bounded snippets while preserving
// the exact uncolored text for large payloads and unsupported language names.
const MAX_HIGHLIGHT_CHARACTERS = 100_000;

export function highlightCode(source: string, language?: string): ReactNode {
	const key = language?.toLowerCase();
	const parser = key && Object.hasOwn(parsers, key) ? parsers[key] : undefined;
	if (!parser || source.length > MAX_HIGHLIGHT_CHARACTERS) return source;

	const parts: ReactNode[] = [];
	let offset = 0;
	highlightTree(parser.parse(source), classHighlighter, (from, to, className) => {
		if (from > offset) parts.push(source.slice(offset, from));
		parts.push(
			<span
				key={from}
				className={className}
			>
				{source.slice(from, to)}
			</span>,
		);
		offset = to;
	});
	if (offset < source.length) parts.push(source.slice(offset));
	return parts;
}

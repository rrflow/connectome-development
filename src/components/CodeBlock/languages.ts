import { LRLanguage, StreamLanguage } from "@codemirror/language";
import { c, cpp, csharp, java } from "@codemirror/legacy-modes/mode/clike";
import type { Extension } from "@codemirror/state";
import { parser as bashParser } from "@fig/lezer-bash";
import { parser as goParser } from "@lezer/go";
import { parser as htmlParser } from "@lezer/html";
import { parser as javascriptParser } from "@lezer/javascript";
import { parser as phpParser } from "@lezer/php";
import { parser as pythonParser } from "@lezer/python";
import { parser as rustParser } from "@lezer/rust";
import { parser as yamlParser } from "@lezer/yaml";

/*
 * The languages a code block colours besides rrflowQL and JSON. They are the
 * ones the native-client branch (pull request 10) coloured. This module is
 * loaded only when a block asks for one of them, so a page of rrflowQL or JSON
 * never pays for a dozen grammars.
 */

const javascript = LRLanguage.define({ parser: javascriptParser });
const jsx = LRLanguage.define({ parser: javascriptParser.configure({ dialect: "jsx" }) });
const typescript = LRLanguage.define({ parser: javascriptParser.configure({ dialect: "ts" }) });
const rust = LRLanguage.define({ parser: rustParser });
const python = LRLanguage.define({ parser: pythonParser });
const go = LRLanguage.define({ parser: goParser });
const php = LRLanguage.define({ parser: phpParser.configure({ top: "Program" }) });
const html = LRLanguage.define({ parser: htmlParser });
const yaml = LRLanguage.define({ parser: yamlParser });
const shell = LRLanguage.define({ parser: bashParser });

/** Every name a block may ask for, and the language that colours it. */
export const CODE_LANGUAGES: Record<string, Extension> = {
	js: javascript,
	javascript,
	jsx,
	ts: typescript,
	typescript,
	rust,
	py: python,
	python,
	go,
	php,
	html,
	xml: html,
	yaml,
	yml: yaml,
	cli: shell,
	bash: shell,
	sh: shell,
	shell,
	c: StreamLanguage.define(c),
	cpp: StreamLanguage.define(cpp),
	csharp: StreamLanguage.define(csharp),
	java: StreamLanguage.define(java),
};

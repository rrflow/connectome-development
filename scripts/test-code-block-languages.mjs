import assert from "node:assert/strict";
import { test } from "node:test";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { CODE_LANGUAGES } from "../src/components/CodeBlock/languages.ts";

/** A snippet per language whose first word that language colours. */
const SAMPLES = {
	js: "const answer = 42;",
	javascript: "const answer = 42;",
	jsx: "const view = <b>bold</b>;",
	ts: "const answer: number = 42;",
	typescript: "interface Row { id: string }",
	rust: "fn main() { let answer = 42; }",
	py: "def answer():\n    return 42\n",
	python: "def answer():\n    return 42\n",
	go: "func main() { var answer = 42 }",
	php: "<?php function answer() { return 42; }",
	html: '<a href="x">link</a>',
	xml: '<row id="1">text</row>',
	yaml: "answer: 42\n",
	yml: "answer: 42\n",
	cli: 'echo "answer" | wc -l',
	bash: 'echo "answer" | wc -l',
	sh: 'echo "answer" | wc -l',
	shell: 'echo "answer" | wc -l',
	c: "int main(void) { return 42; } /* note */",
	cpp: "class Row { public: int id; }; // note",
	csharp: 'public class Row { string id = "a"; }',
	java: 'public class Row { String id = "a"; }',
};

function coloured(language, source) {
	let spans = 0;
	highlightTree(language.parser.parse(source), classHighlighter, () => {
		spans += 1;
	});
	return spans;
}

test("the code block colours every language the native-client branch coloured", () => {
	// With rrflowQL and JSON, which the block loads on their own, this is the
	// branch's 24 names.
	assert.deepEqual(Object.keys(CODE_LANGUAGES).sort(), Object.keys(SAMPLES).sort());
});

for (const [name, source] of Object.entries(SAMPLES)) {
	test(`${name} is coloured, not shown as plain text`, () => {
		assert.ok(coloured(CODE_LANGUAGES[name], source) > 0, name);
	});
}

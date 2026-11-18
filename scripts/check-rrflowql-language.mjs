/**
 * The CodeMirror binding of the one rrflowQL language must be reachable as a
 * language: completions and other per-language behaviour register through
 * `rrflowqlLanguage.data.of(...)`, and CodeMirror consults that only when the
 * tree's top node names the language's data facet.
 */
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { rrflowql, rrflowqlLanguage } from "../src/editor/rrflowql/codemirror/language.ts";

const source = "FROM record:document AT VALID 0 KNOWN HEAD WHERE status = $status";
const state = EditorState.create({
	doc: source,
	extensions: [rrflowql(), rrflowqlLanguage.data.of({ probe: "registered" })],
});

assert.equal(
	rrflowqlLanguage.isActiveAt(state, 0),
	true,
	"the language is active in its own document",
);
assert.deepEqual(
	state.languageDataAt("probe", source.length),
	["registered"],
	"data registered on the language is found at a position in the document",
);

const plain = EditorState.create({
	doc: source,
	extensions: [rrflowqlLanguage.data.of({ probe: "registered" })],
});
assert.deepEqual(
	plain.languageDataAt("probe", 0),
	[],
	"without the language, its data is not offered",
);

console.log("rrflowQL language data holds: registered data reaches the editor, 3 checks.");

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Source modules use the application's bundler resolution. The test resolver
// supplies its local .ts extension without changing production import paths.
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.startsWith(".") && !/\.[a-z]+$/u.test(specifier)) {
			return nextResolve(`${specifier}.ts`, context);
		}
		return nextResolve(specifier, context);
	},
});

const { Language, syntaxTree } = await import("@codemirror/language");
const { EditorState } = await import("@codemirror/state");
const { classHighlighter, highlightTree } = await import("@lezer/highlight");
const { rrflowqlLanguageData, rrflowqlPresentationParser } = await import(
	"../src/rrflow/editor/parser.ts"
);
const { NativeRRFlowQL, RRFLOWQL_VALIDATION_UNAVAILABLE } = await import(
	"../src/shared/util/rrflowql/native.ts"
);

test("CodeMirror selection, variable discovery, links and highlighting use the authored tree", () => {
	const source = "FROM record:document AT VALID $when KNOWN HEAD PROJECT id; MUTATE $body;";
	const language = new Language(rrflowqlLanguageData, rrflowqlPresentationParser);
	const state = EditorState.create({ doc: source, extensions: [language.extension] });
	const tree = syntaxTree(state);
	const statements = [];
	const parameters = [];
	tree.iterate({
		enter(node) {
			if (node.name === "Statement") statements.push(source.slice(node.from, node.to));
			if (node.name === "VariableName") parameters.push(source.slice(node.from + 1, node.to));
		},
	});
	assert.deepEqual(statements, [
		"FROM record:document AT VALID $when KNOWN HEAD PROJECT id;",
		"MUTATE $body;",
	]);
	assert.deepEqual(parameters, ["when", "body"]);
	assert.equal(tree.resolveInner(source.indexOf("$when") + 2).name, "VariableName");
	assert.equal(tree.resolveInner(source.indexOf("$when") + 2).parent.name, "Statement");
	const highlighted = [];
	highlightTree(tree, classHighlighter, (from, to, classes) =>
		highlighted.push([source.slice(from, to), classes]),
	);
	assert.ok(
		highlighted.some(([text, classes]) => text === "FROM" && classes.includes("keyword")),
	);
	assert.ok(
		highlighted.some(([text, classes]) => text === "$when" && classes.includes("variable")),
	);
});

test("semantic validation stays explicitly unavailable for valid and malformed text", async () => {
	const helper = new NativeRRFlowQL();
	assert.equal(
		await helper.validateQuery("FROM record:document AT VALID 0 KNOWN HEAD PROJECT *"),
		RRFLOWQL_VALIDATION_UNAVAILABLE,
	);
	assert.equal(await helper.validateQuery("garbage"), RRFLOWQL_VALIDATION_UNAVAILABLE);
	assert.equal(await helper.validateWhere("state = true"), RRFLOWQL_VALIDATION_UNAVAILABLE);
	await assert.rejects(helper.extractKindRecords("record<document>"), /native relation schema/u);
	assert.deepEqual(await helper.extractKindRecords("string"), []);
	assert.deepEqual(
		await helper.getLiveQueries("", [
			{ success: true, type: "other", result: [] },
			{ success: true, type: "live", result: "id" },
		]),
		[1],
	);
});

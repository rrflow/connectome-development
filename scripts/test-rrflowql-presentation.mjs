import assert from "node:assert/strict";
import { test } from "node:test";
import {
	layoutRRFlowQL,
	rrflowqlStatementRanges,
	scanRRFlowQL,
} from "../src/rrflow/editor/lexical.ts";
import { formatRRFlowValue, parseRRFlowValue } from "../src/shared/util/rrflowql/values.ts";

test("RRD native temporal query keeps parameter and record-link source offsets", () => {
	const query =
		'FROM traverse:depends_on START document:a DIRECTION OUTGOING DEPTH 4 AT VALID $when KNOWN HEAD WHERE title MATCH "deep; space" PROJECT node_id LIMIT 10';
	const tokens = scanRRFlowQL(query);
	assert.deepEqual(
		tokens
			.filter((token) => token.kind === "VariableName")
			.map((token) => query.slice(token.from, token.to)),
		["$when"],
	);
	assert.deepEqual(
		tokens
			.filter((token) => token.kind === "RecordId")
			.map((token) => query.slice(token.from, token.to)),
		["document:a"],
	);
	assert.deepEqual(rrflowqlStatementRanges(query), [{ from: 0, to: query.length }]);
});

test("editor statement selection does not split quoted data, comments or containers", () => {
	const query = 'BEGIN;\nMUTATE $body; -- $hidden;\n{"title":"a; b", "nested": [";"]}; COMMIT;';
	assert.deepEqual(
		rrflowqlStatementRanges(query).map(({ from, to }) => query.slice(from, to)),
		["BEGIN;", "MUTATE $body;", '{"title":"a; b", "nested": [";"]};', "COMMIT;"],
	);
	assert.deepEqual(
		scanRRFlowQL(query)
			.filter((token) => token.kind === "VariableName")
			.map((token) => query.slice(token.from, token.to)),
		["$body"],
	);
});

test("layout never rewrites tokens or quoted values and preserves line comments", () => {
	const source =
		'FROM record:document AT VALID $when KNOWN HEAD WHERE title = "WHERE PROJECT" -- keep\nPROJECT id LIMIT 5';
	const formatted = layoutRRFlowQL(source);
	const tokenText = (query) =>
		scanRRFlowQL(query).map(({ kind, from, to }) => [kind, query.slice(from, to)]);
	assert.deepEqual(tokenText(formatted), tokenText(source));
	assert.match(formatted, /-- keep\nPROJECT/u);
	assert.equal(layoutRRFlowQL(formatted), formatted);
});

test("JSON editing rejects expressions, precision loss, unsupported data and cycles", () => {
	assert.deepEqual(parseRRFlowValue('{"properties":{"type":"string","value":"a"}}'), {
		properties: { type: "string", value: "a" },
	});
	assert.equal(formatRRFlowValue({ count: 9007199254740993n }), '{"count":"9007199254740993"}');
	assert.throws(() => parseRRFlowValue("RETURN 1"), /Enter a JSON value/u);
	assert.throws(() => parseRRFlowValue("9007199254740993"), /safe range/u);
	assert.throws(() => parseRRFlowValue("1e400"), /safe range/u);
	assert.throws(() => formatRRFlowValue({ hidden: undefined }), /undefined/u);
	assert.throws(() => formatRRFlowValue(Number.NaN), /non-finite/u);
	assert.throws(() => formatRRFlowValue(new Map([["a", 1]])), /toJSON/u);
	const cyclic = {};
	cyclic.self = cyclic;
	assert.throws(() => formatRRFlowValue(cyclic), /circular/u);
});

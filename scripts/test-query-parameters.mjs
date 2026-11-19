import assert from "node:assert/strict";
import { test } from "node:test";
import {
	inferParameters,
	parameterNames,
	parseParameters,
	sourceKinds,
	toQueryValue,
} from "../src/rrflow/query-parameters.ts";

test("JSON scalars become the contract's typed values", () => {
	assert.deepEqual(toQueryValue(null), { type: "null" });
	assert.deepEqual(toQueryValue(true), { type: "bool", value: true });
	assert.deepEqual(toQueryValue("a"), { type: "string", value: "a" });
	assert.deepEqual(toQueryValue(0), { type: "unsigned", value: 0 });
	assert.deepEqual(toQueryValue(1763500000000), { type: "unsigned", value: 1763500000000 });
	assert.deepEqual(toQueryValue(-3), { type: "integer", value: -3 });
	assert.deepEqual(toQueryValue(1.5), { type: "decimal", value: "1.5" });
});

test("a value written in the contract's own form keeps the type it names", () => {
	assert.deepEqual(toQueryValue({ type: "integer", value: 5 }), { type: "integer", value: 5 });
	assert.throws(() => toQueryValue({ type: "unsigned", value: -1 }));
	assert.throws(() => toQueryValue({ type: "bool", value: "yes" }), /is not a bool/);
});

test("lists and plain objects are carried, for the contract to accept or refuse", () => {
	assert.deepEqual(toQueryValue([1, "a"]), {
		type: "list",
		value: [
			{ type: "unsigned", value: 1 },
			{ type: "string", value: "a" },
		],
	});
	assert.deepEqual(toQueryValue({ note: "x" }), {
		type: "map",
		value: { note: { type: "string", value: "x" } },
	});
});

test("a whole number too large to cross exactly is refused, not rounded", () => {
	assert.throws(() => toQueryValue(2 ** 60));
});

test("the variables text is empty or one JSON object", () => {
	assert.deepEqual(parseParameters("  "), { ok: true, parameters: {} });
	assert.deepEqual(parseParameters('{"at": 5, "$who": "a"}'), {
		ok: true,
		parameters: { at: { type: "unsigned", value: 5 }, who: { type: "string", value: "a" } },
	});
	assert.equal(parseParameters("[1]").ok, false);
	assert.match(parseParameters("{").error, /Not valid JSON/);
	assert.match(parseParameters('{"a b": 1}').error, /is not a parameter name/);
});

test("a query's parameters are found once each, in order", () => {
	assert.deepEqual(
		parameterNames("FROM record:doc AT VALID $at KNOWN $cursor WHERE owner = $who AND a = $at"),
		["at", "cursor", "who"],
	);
	assert.deepEqual(parameterNames('FROM record:doc WHERE note = "costs $5"'), []);
});

test("inferring adds the missing names and keeps what was typed", () => {
	const query = "FROM record:doc AT VALID $at KNOWN HEAD WHERE owner = $who";
	assert.deepEqual(JSON.parse(inferParameters("", query)), { at: null, who: null });
	assert.deepEqual(JSON.parse(inferParameters('{"who": "a", "extra": 1}', query)), {
		who: "a",
		extra: 1,
		at: null,
	});
	assert.deepEqual(JSON.parse(inferParameters('{"$at": 5}', "FROM record:doc AT VALID $at")), {
		$at: 5,
	});
});

test("inferring never overwrites text it cannot read", () => {
	assert.equal(inferParameters("{ not json", "FROM record:doc AT VALID $at"), null);
	assert.equal(inferParameters("[1]", "FROM record:doc AT VALID $at"), null);
});

test("each source family is offered the kinds the schema lists for it", () => {
	const kinds = sourceKinds([
		{ name: "document", model: "relational" },
		{ name: "settings", model: "key_value" },
		{ name: "links_to", model: "graph_relation" },
		{ name: "observed", model: "event" },
		{ name: "series_root", model: "time_series" },
		{ name: "location", model: "geo" },
	]);
	assert.deepEqual(kinds.record, ["document", "settings"]);
	assert.deepEqual(kinds.relation, ["links_to"]);
	assert.deepEqual(kinds.traverse, ["links_to"]);
	assert.deepEqual(kinds.event, ["observed"]);
	assert.deepEqual(kinds.series, ["series_root"]);
	assert.deepEqual(kinds.geo, ["location"]);
	assert.deepEqual(kinds.claim, []);
});

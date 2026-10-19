import assert from "node:assert/strict";
import { test } from "node:test";
import { nativeQueryTable } from "../src/rrflow/client/query-presentation.ts";

function queryView(change = {}) {
	return {
		canonical_query: "FROM record:document AT VALID 0 KNOWN HEAD PROJECT title, count",
		known_at_cursor: 42,
		schema_revision: 3,
		columns: ["title", "count"],
		rows: [
			{
				identity: "document:a",
				values: { title: "A\n<script>literal</script>", count: "0" },
			},
		],
		returned_rows: 1,
		truncated: false,
		keys_examined: 2,
		output_bytes: 64,
		...change,
	};
}

test("native query rows preserve engine column order, exact display strings and source metadata", () => {
	const view = queryView();
	const before = JSON.stringify(view);
	const table = nativeQueryTable(view);
	assert.deepEqual(table, {
		columns: ["title", "count"],
		rows: [{ identity: "document:a", cells: ["A\n<script>literal</script>", "0"] }],
		returnedRows: 1,
		knownAtCursor: 42,
		truncated: false,
	});
	assert.equal(JSON.stringify(view), before, "the original metadata/JSON view is untouched");
});

test("a native empty or truncated result remains a valid table result", () => {
	assert.deepEqual(nativeQueryTable(queryView({ rows: [], returned_rows: 0, columns: [] })), {
		columns: [],
		rows: [],
		returnedRows: 0,
		knownAtCursor: 42,
		truncated: false,
	});
	assert.equal(nativeQueryTable(queryView({ truncated: true })).truncated, true);
});

test("projected cells use own properties and safely retain prototype-shaped column names", () => {
	const values = JSON.parse(
		'{"__proto__":"owned prototype text","constructor":"owned constructor text","toString":"owned function name"}',
	);
	Object.setPrototypeOf(values, { inherited: "must not render" });
	const view = queryView({
		columns: ["__proto__", "constructor", "toString", "inherited", "missing"],
		rows: [{ identity: "document:a", values }],
	});
	assert.deepEqual(nativeQueryTable(view).rows[0].cells, [
		"owned prototype text",
		"owned constructor text",
		"owned function name",
		null,
		null,
	]);
	assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test("ordinary object arrays keep their existing preview path and malformed native views fail selection", () => {
	assert.equal(nativeQueryTable([{ title: "legacy object row" }]), null);
	for (const malformed of [
		queryView({ rows: [{ identity: "document:a", values: { title: 123 } }] }),
		queryView({ returned_rows: 2 }),
		queryView({ columns: ["title", "title"] }),
		{ columns: ["title"], rows: [] },
		null,
	]) {
		assert.equal(nativeQueryTable(malformed), null);
	}
});

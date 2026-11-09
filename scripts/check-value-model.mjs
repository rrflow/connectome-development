#!/usr/bin/env node
/**
 * Checks Connectome's value model (`src/rrflow/model.ts`) against what the
 * pinned engine returned for one record holding every kind of value
 * (`src/rrflow/fixtures/engine-values.json`, written and verified by the RRD
 * process test `rrd::client::process::values`), and checks the rules it builds
 * values by.
 *
 *   node --experimental-strip-types scripts/check-value-model.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const model = await import(`file://${join(root, "src/rrflow/model.ts").replaceAll("\\", "/")}`);
const golden = JSON.parse(
	readFileSync(join(root, "src/rrflow/fixtures/engine-values.json"), "utf8"),
);
const lock = readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8");
const pinned = lock.match(/rrflow-development\?rev=([0-9a-f]{40})/)?.[1];
assert.equal(golden.engine, pinned, "the golden values come from the pinned engine");

let checks = 0;
const check = (name, test) => {
	try {
		test();
		checks++;
	} catch (error) {
		console.error(`value model: ${name}`);
		throw error;
	}
};

// Every engine value displays exactly as the native views display it, unless
// it holds a number JavaScript cannot represent; the model says which.
const covered = new Set();
let inexact = 0;
for (const entry of golden.values) {
	covered.add(entry.value.type);
	check(`${entry.name} displays as the native views do`, () => {
		if (model.isExact(entry.value)) {
			assert.equal(model.display(entry.value), entry.display);
		} else {
			inexact++;
			assert.notEqual(model.display(entry.value), entry.display);
		}
	});
}
check("the golden covers every value type", () => {
	assert.deepEqual([...covered].sort(), [...model.VALUE_TYPES].sort());
});
check("the golden holds integers JavaScript rounds", () => assert.equal(inexact, 2));

const { value, parseValue, reference, parseReferenceKey, referenceKey, ValueError } = model;
const refused = (build) => assert.throws(build, ValueError);

check("integers cross only when exact", () => {
	assert.deepEqual(value.integer(-(2 ** 53 - 1)), { type: "integer", value: -(2 ** 53 - 1) });
	refused(() => value.integer(2 ** 53));
	refused(() => value.integer(1.5));
	refused(() => value.unsigned(-1));
	refused(() => parseValue("unsigned", "18446744073709551615"));
	refused(() => parseValue("integer", "9223372036854775808"));
	refused(() => parseValue("unsigned", "-1"));
	assert.deepEqual(parseValue("integer", "-42"), { type: "integer", value: -42 });
});
check("decimals and digests follow the kernel's rules", () => {
	assert.deepEqual(value.decimal("1e5"), { type: "decimal", value: "1e5" });
	for (const text of ["0x10", "inf", "NaN", "", " 1", "1.2.3"])
		refused(() => value.decimal(text));
	refused(() => value.digest(`${"ABCDEF".repeat(10)}abcd`));
	refused(() => value.digest("0".repeat(63)));
	assert.equal(value.digest("0".repeat(64)).value, "0".repeat(64));
});
check("typed text parses by value type", () => {
	assert.deepEqual(parseValue("bool", "true"), { type: "bool", value: true });
	refused(() => parseValue("bool", "yes"));
	assert.deepEqual(parseValue("null", ""), { type: "null" });
	refused(() => parseValue("list", "[]"));
	refused(() => parseValue("map", "{}"));
});
check("references are canonical kind and id", () => {
	assert.deepEqual(reference("document", "a1"), { kind: "document", id: "a1" });
	refused(() => reference("Document", "a1"));
	refused(() => reference("document", "-a1"));
	refused(() => reference("document", "a".repeat(129)));
	assert.equal(referenceKey({ kind: "document", id: "a1" }), "document:a1");
	assert.deepEqual(parseReferenceKey("document:a1"), { kind: "document", id: "a1" });
	assert.equal(parseReferenceKey("document"), null);
	assert.equal(parseReferenceKey("document:a:b"), null);
});

console.log(
	`Value model holds: ${golden.values.length} engine values at ${pinned.slice(0, 8)}, ${checks} checks.`,
);

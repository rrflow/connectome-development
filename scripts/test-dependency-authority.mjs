import assert from "node:assert/strict";
import { test } from "node:test";
import { aliasViolations, npmViolations } from "./dependency-authority.mjs";

const SDK = "@rrflow/rrd-client";
const SDK_PIN = `github:rrflow/rrflow-development#${"a".repeat(40)}&path:sdks/typescript`;

function manifest(section, entries) {
	return { dependencies: { [SDK]: SDK_PIN }, [section]: { ...entries } };
}

test("an RRFlow name aliased to another publisher is refused", () => {
	const dev = npmViolations(
		manifest("devDependencies", { "@rrflow/client": "npm:left-pad@1.3.0" }),
	);
	assert.equal(dev.length, 1);
	assert.match(dev[0], /impersonates an RRFlow package; it is left-pad/);
	const optional = npmViolations(
		manifest("optionalDependencies", { "@rrflow/ui": "npm:@acme/ui@1.0.0" }),
	);
	assert.match(optional[0], /impersonates an RRFlow package; it is @acme\/ui/);
});

test("local source may not be declared under the RRFlow scope", () => {
	for (const spec of ["file:src/rrflow/client", "link:./src/rrflow/ui", "workspace:*", "1.0.0"]) {
		const violations = npmViolations(manifest("devDependencies", { "@rrflow/client": spec }));
		assert.equal(violations.length, 1, spec);
		assert.match(violations[0], /is not a package RRFlow publishes/);
	}
});

test("the SDK is accepted only in dependencies", () => {
	assert.deepEqual(npmViolations({ dependencies: { [SDK]: SDK_PIN } }), []);
	const misplaced = npmViolations({ devDependencies: { [SDK]: SDK_PIN } });
	assert.match(misplaced[0], /belongs in dependencies/);
});

test("ordinary dependencies and same-scope aliases are accepted", () => {
	assert.deepEqual(
		npmViolations(
			manifest("devDependencies", {
				"@mantine/core": "8.3.14",
				"@acme/parser-v2": "npm:@acme/parser@0.2.0",
				"@acme/parser-v3": "npm:@acme/parser@0.3.1",
			}),
		),
		[],
	);
});

test("an alias that changes scope hides provenance and is refused", () => {
	const violations = npmViolations(
		manifest("devDependencies", { parser: "npm:@acme/parser@1.0.0" }),
	);
	assert.match(violations[0], /hides the provenance of @acme\/parser/);
});

test("path aliases may not pass local source off as an RRFlow package", () => {
	assert.deepEqual(
		aliasViolations({ compilerOptions: { paths: { "~/*": ["./src/*"] } } }, ""),
		[],
	);
	assert.deepEqual(
		aliasViolations({}, 'alias: { "~": fileURLToPath(new URL("src", import.meta.url)) }'),
		[],
	);
	const tsconfig = aliasViolations(
		{ compilerOptions: { paths: { "@rrflow/ui": ["./src/rrflow/ui/index.tsx"] } } },
		"",
	);
	assert.equal(tsconfig.length, 1);
	assert.match(tsconfig[0], /tsconfig\.json paths: "@rrflow\/ui"/);
	const vite = aliasViolations(
		{},
		'alias: { "@rrflow/client": fileURLToPath(new URL("src/rrflow/client", import.meta.url)) }',
	);
	assert.equal(vite.length, 1);
	assert.match(vite[0], /vite\.config\.ts alias: "@rrflow\/client"/);
});

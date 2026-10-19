import assert from "node:assert/strict";
import test from "node:test";
import {
	configViolations,
	moduleViolations,
	packageViolations,
} from "./check-rrflow-dependencies.mjs";

test("rejects upstream packages concealed behind a first-party alias", () => {
	assert.equal(
		packageViolations({ dependencies: { "@rrflow/client": "npm:surrealdb@2.0.2" } }).length,
		1,
	);
	assert.equal(
		packageViolations({ optionalDependencies: { "@rrflow/ui": "npm:@surrealdb/ui@1.0.87" } })
			.length,
		1,
	);
	assert.deepEqual(packageViolations({ dependencies: { "@mantine/core": "8.3.14" } }), []);
});

test("rejects static, re-exported, dynamic and commonjs upstream imports", () => {
	for (const source of [
		'import { Client } from "surrealdb";',
		'export * from "@surrealdb/ui";',
		'const parser = import("@surrealdb/lezer");',
		'const client = require("surrealdb");',
		'import "@surrealdb/ui/styles.css";',
	])
		assert.equal(moduleViolations(source).length, 1, source);
	assert.deepEqual(moduleViolations('import { Icon } from "~/rrflow/ui";'), []);
});

test("rejects local package-name aliases as well as upstream aliases", () => {
	assert.equal(moduleViolations('import { Icon } from "@rrflow/ui";').length, 1);
	assert.equal(
		packageViolations({ dependencies: { "@rrflow/client": "file:src/rrflow/client" } }).length,
		1,
	);
	assert.equal(configViolations('"@rrflow/ui": ["./src/rrflow/ui/index.tsx"]').length, 1);
	assert.equal(
		configViolations('"@rrflow/ui": fileURLToPath(new URL("./src/rrflow/ui", import.meta.url))')
			.length,
		1,
	);
	assert.deepEqual(moduleViolations('import { Icon } from "../../rrflow/ui/index";'), []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	compare,
	inheritedDependencies,
	measure,
	reachesInherited,
	remaining,
	visualItems,
} from "./native-client-requirement.mjs";

const vendor = /acme/i;
const manifest = {
	dependencies: { acmedb: "^2.0.0", "@mantine/core": "8.3.14" },
	devDependencies: { "@acme/wasm": "^3.0.0" },
};

function tree(overrides = {}) {
	return {
		manifest,
		vendor,
		sources: [
			{ path: "src/vendor/rrflow-client.ts", content: 'export * from "acmedb";' },
			{
				path: "src/old/view.tsx",
				content: 'import { RRFlow } from "~/vendor/rrflow-client";',
			},
			{ path: "src/new/view.tsx", content: 'import { session } from "~/rrflow/session";' },
		],
		parity: {
			capabilities: [
				{ status: "native" },
				{ status: "partial" },
				{ status: "not applicable" },
			],
			filesNoAreaRead: ["a"],
			missedCapabilities: [],
		},
		checklist: "- [ ] one\n- [x] two\n",
		...overrides,
	};
}

test("inherited dependencies are found in every manifest section", () => {
	assert.deepEqual(inheritedDependencies(manifest, vendor), ["@acme/wasm", "acmedb"]);
});

test("an import, a subpath, a dynamic import and the seam all reach the inherited client", () => {
	const declared = ["acmedb", "@acme/wasm"];
	assert.ok(reachesInherited('import x from "acmedb";', declared));
	assert.ok(reachesInherited('const wasm = import("@acme/wasm/lib?url");', declared));
	assert.ok(reachesInherited("optimizeDeps: { exclude: ['@acme/wasm'] }", declared));
	assert.ok(reachesInherited('import { RRFlow } from "../../vendor/rrflow-client";', declared));
});

test("a name that only resembles an inherited dependency does not count", () => {
	const declared = ["acmedb"];
	assert.ok(!reachesInherited('import x from "acmedb-tools";', declared));
	assert.ok(!reachesInherited('import x from "~/rrflow/client";', declared));
	assert.ok(!reachesInherited("// acmedb is mentioned in a comment only", declared));
});

test("the checklist counts open and ticked items", () => {
	assert.deepEqual(visualItems("- [ ] a\n- [x] b\n- [X] c\ntext - [ ] no\n"), {
		items: 3,
		shown: 2,
	});
});

test("a record that equals the tree passes", () => {
	const measured = measure(tree());
	assert.deepEqual(compare(structuredClone(measured), measured), []);
});

test("a new importer is refused", () => {
	const recorded = measure(tree());
	const grown = tree();
	grown.sources.push({
		path: "src/new/slip.tsx",
		content: 'import { RRFlow } from "~/vendor/rrflow-client";',
	});
	const violations = compare(recorded, measure(grown));
	assert.equal(violations.length, 1);
	assert.match(violations[0], /src\/new\/slip\.tsx .* nothing new may be built on it/);
});

test("a new importer cannot hide behind one that was removed", () => {
	const recorded = measure(tree());
	const swapped = tree();
	swapped.sources[1] = {
		path: "src/new/slip.tsx",
		content: 'import { RRFlow } from "~/vendor/rrflow-client";',
	};
	const violations = compare(recorded, measure(swapped));
	assert.equal(violations.length, 2);
});

test("a new inherited dependency is refused", () => {
	const recorded = measure(tree());
	const grown = tree({
		manifest: { ...manifest, optionalDependencies: { "@acme/extra": "1.0.0" } },
	});
	assert.match(compare(recorded, measure(grown))[0], /may only go down/);
});

test("progress must be written into the record in the same change", () => {
	const recorded = measure(tree());
	const better = tree();
	better.sources[1].content = 'import { session } from "~/rrflow/session";';
	better.parity.capabilities[1].status = "native";
	better.checklist = "- [x] one\n- [x] two\n";
	const violations = compare(recorded, measure(better));
	assert.equal(violations.length, 3);
	assert.match(violations[0], /remove it from the record/);
	assert.match(violations[1], /capability record changed/);
	assert.match(violations[2], /visual checklist changed/);
});

test("what remains names every unmet condition", () => {
	assert.deepEqual(remaining(measure(tree())), [
		"2 inherited dependencies are still declared",
		"2 files still reach the inherited client",
		"1 of 3 inherited capabilities not yet native",
		"1 inherited file has not been read for capabilities",
		"1 of 2 visual items not yet shown equal or better",
	]);
});

test("the requirement is met only when nothing inherited is left", () => {
	const done = measure({
		manifest: { dependencies: { "@mantine/core": "8.3.14" } },
		vendor,
		sources: [{ path: "src/new/view.tsx", content: 'import "~/rrflow/session";' }],
		parity: {
			capabilities: [{ status: "native" }, { status: "not applicable" }],
			filesNoAreaRead: [],
			missedCapabilities: [],
		},
		checklist: "- [x] one\n",
	});
	assert.deepEqual(remaining(done), []);
});

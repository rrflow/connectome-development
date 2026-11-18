import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, isTestFile, limitFor } from "./file-size.mjs";

test("each kind of file has the limit the conventions document gives it", () => {
	assert.equal(limitFor("src/features/a.ts"), 400);
	assert.equal(limitFor("src/features/A.tsx"), 400);
	assert.equal(limitFor("src-tauri/src/rrd/view.rs"), 800);
	assert.equal(limitFor("src-tauri/src/rrd/client/tests.rs"), 1500);
	assert.equal(limitFor("src-tauri/tests/process.rs"), 1500);
	assert.equal(limitFor("tests/smoke/connectome.spec.ts"), 1500);
	assert.equal(limitFor("scripts/check-menu.mjs"), null);
	assert.equal(limitFor("README.md"), null);
});

test("test files are recognised by place and by name", () => {
	assert.equal(isTestFile("tests/smoke/a.spec.ts"), true);
	assert.equal(isTestFile("src/rrflow/ui.test.mjs"), true);
	assert.equal(isTestFile("src-tauri/src/rrd/engram/tests.rs"), true);
	assert.equal(isTestFile("src/features/latest/index.ts"), false);
	assert.equal(isTestFile("src/features/contests.ts"), false);
});

test("a new file over its limit is refused", () => {
	const problems = evaluate({ "src/a.ts": 401, "src/b.ts": 400, "src-tauri/src/c.rs": 801 }, {});
	assert.equal(problems.length, 2);
	assert.match(problems[0], /src\/a\.ts: 401 lines is over the 400-line limit/);
	assert.match(problems[1], /c\.rs: 801 lines is over the 800-line limit/);
});

test("Rust and test files are not held to the TypeScript limit", () => {
	assert.deepEqual(
		evaluate({ "src-tauri/src/c.rs": 800, "tests/smoke/a.spec.ts": 1500 }, {}),
		[],
	);
});

test("a recorded large file may stay the same size or shrink", () => {
	assert.deepEqual(evaluate({ "src/big.ts": 1000 }, { "src/big.ts": 1000 }), []);
	assert.deepEqual(evaluate({ "src/big.ts": 900 }, { "src/big.ts": 1000 }), []);
});

test("a recorded large file may not grow", () => {
	const problems = evaluate({ "src/big.ts": 1001 }, { "src/big.ts": 1000 });
	assert.match(problems[0], /grew from 1000 to 1001 lines/);
});

test("an entry must leave the baseline once its file is under its limit", () => {
	const problems = evaluate({ "src/big.ts": 350 }, { "src/big.ts": 1000 });
	assert.match(problems[0], /remove it from scripts\/file-size-baseline\.json/);
});

test("an entry for a file that no longer exists is refused", () => {
	const problems = evaluate({}, { "src/gone.ts": 900 });
	assert.match(problems[0], /no longer exists/);
});

test("files no rule covers are never refused", () => {
	assert.deepEqual(evaluate({ "scripts/long.mjs": 5000 }, {}), []);
});

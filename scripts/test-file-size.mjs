import assert from "node:assert/strict";
import test from "node:test";
import { evaluate } from "./file-size.mjs";

const LIMIT = 400;

test("a new file over the limit is refused", () => {
	const problems = evaluate({ "src/a.ts": 401, "src/b.ts": 400 }, {}, LIMIT);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /src\/a\.ts: 401 lines is over the 400-line limit/);
});

test("a recorded large file may stay the same size or shrink", () => {
	assert.deepEqual(evaluate({ "src/big.ts": 1000 }, { "src/big.ts": 1000 }, LIMIT), []);
	assert.deepEqual(evaluate({ "src/big.ts": 900 }, { "src/big.ts": 1000 }, LIMIT), []);
});

test("a recorded large file may not grow", () => {
	const problems = evaluate({ "src/big.ts": 1001 }, { "src/big.ts": 1000 }, LIMIT);
	assert.match(problems[0], /grew from 1000 to 1001 lines/);
});

test("an entry must leave the baseline once its file is under the limit", () => {
	const problems = evaluate({ "src/big.ts": 350 }, { "src/big.ts": 1000 }, LIMIT);
	assert.match(problems[0], /remove it from scripts\/file-size-baseline\.json/);
});

test("an entry for a file that no longer exists is refused", () => {
	const problems = evaluate({}, { "src/gone.ts": 900 }, LIMIT);
	assert.match(problems[0], /no longer exists/);
});

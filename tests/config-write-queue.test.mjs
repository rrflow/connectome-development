import assert from "node:assert/strict";
import test from "node:test";
import { createConfigWriteQueue } from "../src/shared/util/config/config-write-queue.ts";

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((ok, fail) => {
		resolve = ok;
		reject = fail;
	});
	return { promise, resolve, reject };
}

test("newer project profiles cannot be overwritten by a slower older save", async () => {
	let current = { profiles: ["first"] };
	let disk = null;
	const first = deferred();
	const started = [];
	const save = createConfigWriteQueue(
		() => structuredClone(current),
		async (value) => {
			started.push(value.profiles.join(","));
			if (started.length === 1) await first.promise;
			disk = value;
		},
	);
	const oldWrite = save();
	await Promise.resolve();
	await Promise.resolve();
	current = { profiles: ["first", "second"] };
	const newWrite = save();
	assert.deepEqual(started, ["first"]);
	first.resolve();
	await Promise.all([oldWrite, newWrite]);
	assert.deepEqual(started, ["first", "first,second"]);
	assert.deepEqual(disk, { profiles: ["first", "second"] });
});

test("a failed save is reported and does not prevent a later retry", async () => {
	let attempts = 0;
	const save = createConfigWriteQueue(
		() => ({ project: "example" }),
		async () => {
			attempts += 1;
			if (attempts === 1) throw new Error("disk full");
		},
	);
	await assert.rejects(save(), /disk full/);
	await assert.doesNotReject(save());
	assert.equal(attempts, 2);
});

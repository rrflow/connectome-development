import assert from "node:assert/strict";
import { writeSelectedFile } from "../src/shared/util/write-selected-file.ts";

function stream({ writeError, closeError, abortError } = {}) {
	const calls = { chunks: [], closes: 0, aborts: [] };
	const output = new WritableStream({
		write(chunk) {
			if (writeError) throw writeError;
			calls.chunks.push(chunk);
		},
		close() {
			calls.closes++;
			if (closeError) throw closeError;
		},
		abort(reason) {
			calls.aborts.push(reason);
			if (abortError) throw abortError;
		},
	});
	output.write = async (value) => {
		const writer = output.getWriter();
		try {
			await writer.write(value);
		} finally {
			writer.releaseLock();
		}
	};
	return { output, calls };
}

for (const content of ["text", new Blob(["blob"]), new Response("response")]) {
	const { output, calls } = stream();
	await writeSelectedFile(output, () => content);
	assert.equal(calls.closes, 1);
	assert.equal(calls.aborts.length, 0);
	const bytes = await new Blob(calls.chunks).text();
	assert.equal(
		bytes,
		content instanceof Response ? "response" : await new Blob([content]).text(),
	);
}

for (const provider of [
	() => null,
	() => new Response(null),
	() => {
		throw new Error("provider");
	},
]) {
	const { output, calls } = stream();
	await assert.rejects(() => writeSelectedFile(output, provider));
	assert.equal(calls.closes, 0);
	assert.equal(calls.aborts.length, 1);
}

for (const failure of ["writeError", "closeError"]) {
	const { output, calls } = stream({ [failure]: new Error(failure) });
	await assert.rejects(() => writeSelectedFile(output, () => "text"), new RegExp(failure));
	assert.equal(calls.closes, failure === "closeError" ? 1 : 0);
}

for (const failingOperation of ["write", "close"]) {
	const failure = new Error(`${failingOperation} failed`);
	const aborts = [];
	const output = {
		async write() {
			if (failingOperation === "write") throw failure;
		},
		async close() {
			if (failingOperation === "close") throw failure;
		},
		async abort(reason) {
			aborts.push(reason);
		},
	};
	await assert.rejects(
		() => writeSelectedFile(output, "text"),
		(error) => error === failure,
	);
	assert.deepEqual(aborts, [failure]);
}

const original = new Error("provider failure");
const abortFailure = new Error("abort failure");
const { output } = stream({ abortError: abortFailure });
await assert.rejects(
	() =>
		writeSelectedFile(output, () => {
			throw original;
		}),
	(error) =>
		error instanceof AggregateError &&
		error.errors[0] === original &&
		error.errors[1] === abortFailure,
);
console.log("Selected file streams close on success and surface failures.");

import assert from "node:assert/strict";
import { runWorkbenchEventActions } from "../src/features/runtime/workbench/lanes/event-actions.ts";

const action = (name, payload) => ({ id: name, name, label: name, payload });
const calls = [];
let current = true;
const context = {
	resolveRoute: (route) => (route === "knowledge/records" ? route : undefined),
	canReadEngine: true,
	canCapture: true,
	isCurrent: () => current,
	openRoute: (route) => calls.push(`route:${route}`),
	refreshStorage: async () => {
		calls.push("storage");
	},
	refreshFlights: async () => {
		calls.push("flights");
	},
	captureDiagnostics: async () => {
		calls.push("capture");
	},
};

await runWorkbenchEventActions(
	[
		action("refresh-storage-signals"),
		action("refresh-governed-flights"),
		action("capture-runtime-receipt"),
		action("navigate-route", "knowledge/records"),
	],
	context,
);
assert.deepEqual(calls, ["storage", "flights", "capture", "route:knowledge/records"]);
calls.length = 0;
for (const actions of [
	[],
	[action("refresh-storage-signals"), action("navigate-route", "not-a-route")],
	[action("navigate-route", "knowledge/records"), action("refresh-storage-signals")],
	[action("refresh-storage-signals"), action("unknown-effect")],
]) {
	await assert.rejects(runWorkbenchEventActions(actions, context));
	assert.deepEqual(calls, []);
}
await assert.rejects(
	runWorkbenchEventActions([action("refresh-storage-signals")], {
		...context,
		canReadEngine: false,
	}),
	/connected engine/,
);
await assert.rejects(
	runWorkbenchEventActions([action("capture-runtime-receipt")], {
		...context,
		canCapture: false,
	}),
	/local workbench/,
);
await assert.rejects(
	runWorkbenchEventActions(
		[action("refresh-storage-signals"), action("refresh-governed-flights")],
		{
			...context,
			refreshStorage: async () => {
				current = false;
				calls.push("storage");
			},
		},
	),
	/context changed/,
);
assert.deepEqual(calls, ["storage"]);
current = true;
calls.length = 0;
await assert.rejects(
	runWorkbenchEventActions(
		[action("refresh-storage-signals"), action("refresh-governed-flights")],
		{
			...context,
			refreshStorage: async () => {
				throw new Error("storage failed");
			},
		},
	),
	/storage failed/,
);
assert.deepEqual(calls, []);
console.log("Workbench event actions preflight and stop safely on errors or context changes.");

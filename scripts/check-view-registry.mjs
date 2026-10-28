#!/usr/bin/env node
/**
 * Checks Connectome's view registry (`src/rrflow/views.ts`) against what the
 * pinned engine offers (`src/rrflow/fixtures/engine-offer.json`, written and
 * verified by the RRD process test `rrd::client::process::offer`) and against
 * the pinned SDK's operation map.
 *
 *   node --experimental-strip-types scripts/check-view-registry.mjs
 *
 * The table below is what each view shows on a ready instance of the pinned
 * engine. A pin move that changes it fails here until the change is reviewed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { AREAS, VIEWS, viewState } = await import(
	`file://${join(root, "src/rrflow/views.ts").replaceAll("\\", "/")}`
);
const golden = JSON.parse(
	readFileSync(join(root, "src/rrflow/fixtures/engine-offer.json"), "utf8"),
);
const lock = readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8");
const pinned = lock.match(/rrflow-development\?rev=([0-9a-f]{40})/)?.[1];
assert.equal(golden.engine, pinned, "the golden offer comes from the pinned engine");
// The SDK's generated endpoint map, read as text as the API examples check does.
const generated = readFileSync(
	join(root, "node_modules/@rrflow/rrd-client/src/generated/endpoints.ts"),
	"utf8",
);
const literal = generated.match(/export const endpoints = (\{[\s\S]*?\n\}) as const;/);
assert.ok(literal, "the SDK endpoint map has an unexpected shape");
const sdkOperations = new Set(Object.keys(JSON.parse(literal[1])));

/** What each view shows on a ready instance of the pinned engine. */
const AT_THE_PIN = {
	overview: "ready",
	"knowledge/models": "ready, experimental exact-rrflowql-query",
	"knowledge/records": "ready, experimental exact-rrflowql-query",
	"knowledge/vectors": "ready, experimental vector-search",
	"knowledge/storage": "ready",
	"knowledge/paths": "planned, serves knowledge-tree-list knowledge-tree-replace",
	activity:
		"planned, serves changefeed-read changefeed-follow audit-read flight-list flight-read task-list task-read",
	learning: "planned, serves nothing",
	services: "planned, serves nothing",
	api: "ready",
};

let checks = 0;
const check = (name, test) => {
	try {
		test();
		checks++;
	} catch (error) {
		console.error(`view registry: ${name}`);
		throw error;
	}
};
const summary = (state) => {
	switch (state.kind) {
		case "ready":
			return state.experimental.length === 0
				? "ready"
				: `ready, experimental ${state.experimental.map((c) => c.name).join(" ")}`;
		case "planned":
			return state.served.length === 0
				? "planned, serves nothing"
				: `planned, serves ${state.served.join(" ")}`;
		case "unserved":
			return `unserved ${state.operations.join(" ")}`;
		case "unavailable":
			return `unavailable ${state.capabilities.map((c) => c.name).join(" ")}`;
		case "instance":
			return `instance ${state.state}`;
	}
};
const ready = {
	project: "p",
	state: "ready",
	origin: "connectome",
	detail: "Serving.",
	revision: 1,
};
const offer = {
	operations: new Set([...golden.operations, ...golden.websocket_operations]),
	capabilities: golden.capabilities.map(({ name, status, limitation }) => ({
		name,
		status,
		limitation: limitation ?? undefined,
	})),
};
const declared = new Set(offer.capabilities.map((capability) => capability.name));

check("areas and views are unique and every view has an area", () => {
	assert.equal(new Set(AREAS.map((area) => area.id)).size, AREAS.length);
	assert.equal(new Set(VIEWS.map((view) => view.id)).size, VIEWS.length);
	for (const view of VIEWS) {
		assert.ok(
			AREAS.some((area) => area.id === view.area),
			`${view.id} names area ${view.area}`,
		);
	}
	for (const area of AREAS) {
		assert.ok(
			VIEWS.some((view) => view.area === area.id),
			`area ${area.id} has a view`,
		);
	}
});
for (const view of VIEWS) {
	check(`${view.id} names only operations the pinned SDK and engine have`, () => {
		for (const operation of view.operations) {
			assert.ok(sdkOperations.has(operation), `${operation} is in the pinned SDK`);
			assert.ok(
				offer.operations.has(operation),
				`${operation} is served by the pinned engine`,
			);
		}
	});
	check(`${view.id} names only capabilities the pinned engine declares`, () => {
		for (const capability of view.capabilities) {
			assert.ok(declared.has(capability), `${capability} is declared by the pinned engine`);
		}
	});
	check(`${view.id} at the pin`, () => {
		assert.equal(summary(viewState(view, ready, offer)), AT_THE_PIN[view.id]);
	});
	for (const state of ["starting", "stopping", "stopped", "failed"]) {
		check(`${view.id} while its instance is ${state}`, () => {
			const result = viewState(view, { ...ready, state, detail: `It is ${state}.` }, offer);
			assert.deepEqual(result, { kind: "instance", state, detail: `It is ${state}.` });
		});
	}
	check(`${view.id} without a tracked instance, and before its offer is read`, () => {
		assert.equal(summary(viewState(view, undefined, offer)), "instance stopped");
		assert.equal(summary(viewState(view, ready, undefined)), "instance unknown");
	});
}
assert.deepEqual(Object.keys(AT_THE_PIN).sort(), VIEWS.map((view) => view.id).sort());

// What a built view shows when the instance stops serving what it needs.
const built = VIEWS.filter((view) => view.built && view.operations.length > 0);
for (const view of built) {
	check(`${view.id} is unserved without its first operation`, () => {
		const operations = new Set(offer.operations);
		operations.delete(view.operations[0]);
		assert.equal(
			summary(viewState(view, ready, { ...offer, operations })),
			`unserved ${view.operations[0]}`,
		);
	});
}
for (const view of VIEWS.filter((view) => view.built && view.capabilities.length > 0)) {
	const [name] = view.capabilities;
	check(`${view.id} is unavailable when ${name} is`, () => {
		const capabilities = offer.capabilities.map((capability) =>
			capability.name === name
				? { ...capability, status: "unavailable", limitation: "Switched off." }
				: capability,
		);
		const result = viewState(view, ready, { ...offer, capabilities });
		assert.equal(result.kind, "unavailable");
		assert.deepEqual(result.capabilities, [
			{ name, status: "unavailable", limitation: "Switched off." },
		]);
	});
	check(`${view.id} is unavailable when ${name} is not declared`, () => {
		const capabilities = offer.capabilities.filter((capability) => capability.name !== name);
		const result = viewState(view, ready, { ...offer, capabilities });
		assert.equal(result.kind, "unavailable");
		assert.equal(result.capabilities[0].limitation, "This instance does not declare it.");
	});
}

console.log(
	`View registry holds: ${VIEWS.length} views in ${AREAS.length} areas at ${pinned.slice(0, 8)}, ${checks} checks.`,
);

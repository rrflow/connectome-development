#!/usr/bin/env node
/**
 * Checks Connectome's view registry (`src/rrflow/views.ts`) against the route
 * files, what the pinned engine offers (`src/rrflow/fixtures/engine-offer.json`,
 * written and verified by the RRD process test `rrd::client::process::offer`)
 * and the pinned SDK's operation map.
 *
 *   node --experimental-strip-types scripts/check-view-registry.mjs
 *
 * The table below is what each gated view shows on a reachable instance of the
 * pinned engine. A pin move that changes it fails here until the change is
 * reviewed.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { VIEW_NEEDS, viewState, lifecycleState } = await import(
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

/** What each gated view shows on a reachable instance of the pinned engine. */
const AT_THE_PIN = JSON.parse(
	readFileSync(join(root, "scripts/view-registry-at-the-pin.json"), "utf8"),
);

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
		case "unserved":
			return `unserved ${state.operations.join(" ")}`;
		case "unavailable":
			return `unavailable ${state.capabilities.map((c) => c.name).join(" ")}`;
	}
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
const routeFile = (path) => {
	const base = join(root, "src/routes/runtime/$id", path);
	return existsSync(`${base}.tsx`) || existsSync(join(base, "index.tsx"));
};

for (const [path, needs] of Object.entries(VIEW_NEEDS)) {
	check(`${path} is a route file`, () => {
		assert.ok(routeFile(path), `src/routes/runtime/$id/${path} exists`);
	});
	check(`${path} names only operations the pinned SDK and engine have`, () => {
		for (const operation of needs.operations) {
			assert.ok(sdkOperations.has(operation), `${operation} is in the pinned SDK`);
			assert.ok(
				offer.operations.has(operation),
				`${operation} is served by the pinned engine`,
			);
		}
	});
	check(`${path} names only capabilities the pinned engine declares`, () => {
		for (const capability of needs.capabilities) {
			assert.ok(declared.has(capability), `${capability} is declared by the pinned engine`);
		}
	});
	check(`${path} at the pin`, () => {
		assert.equal(summary(viewState(path, offer)), AT_THE_PIN[path]);
	});
	check(`${path} is unserved without its first operation`, () => {
		const operations = new Set(offer.operations);
		operations.delete(needs.operations[0]);
		assert.equal(
			summary(viewState(path, { ...offer, operations })),
			`unserved ${needs.operations[0]}`,
		);
	});
	if (needs.capabilities.length > 0) {
		const [name] = needs.capabilities;
		check(`${path} is unavailable when ${name} is`, () => {
			const capabilities = offer.capabilities.map((capability) =>
				capability.name === name
					? { ...capability, status: "unavailable", limitation: "Switched off." }
					: capability,
			);
			const result = viewState(path, { ...offer, capabilities });
			assert.equal(result.kind, "unavailable");
			assert.deepEqual(result.capabilities, [
				{ name, status: "unavailable", limitation: "Switched off." },
			]);
		});
		check(`${path} is unavailable when ${name} is not declared`, () => {
			const capabilities = offer.capabilities.filter(
				(capability) => capability.name !== name,
			);
			const result = viewState(path, { ...offer, capabilities });
			assert.equal(result.kind, "unavailable");
			assert.equal(result.capabilities[0].limitation, "This instance does not declare it.");
		});
	}
}
assert.deepEqual(Object.keys(AT_THE_PIN).sort(), Object.keys(VIEW_NEEDS).sort());
check("a view with no entry is not gated", () => {
	assert.deepEqual(viewState("system/instance", offer), { kind: "ready", experimental: [] });
});

for (const state of ["starting", "stopping", "stopped", "failed"]) {
	check(`a tracked instance that is ${state} gates every view with the registry's words`, () => {
		assert.deepEqual(lifecycleState({ state, detail: `It is ${state}.` }), {
			kind: "instance",
			state,
			detail: `It is ${state}.`,
		});
	});
}
check("a running instance, or one the registry does not track, gates nothing", () => {
	assert.equal(lifecycleState({ state: "ready", detail: "Serving." }), null);
	assert.equal(lifecycleState(undefined), null);
});

console.log(
	`View registry holds: ${Object.keys(VIEW_NEEDS).length} gated views at ${pinned.slice(0, 8)}, ${checks} checks.`,
);

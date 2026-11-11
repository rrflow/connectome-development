import assert from "node:assert/strict";
import {
	displayPath,
	installationFacts,
	refusedAsFresh,
} from "../src/components/ActionBar/installation-facts.ts";

// The shape of a real `rrflow install plan --mode existing` reply, trimmed to the
// fields the summary reads.
const preview = {
	preview_format_version: 1,
	installation: {
		product_version: "1.0.0",
		deployment: { endpoint_presentation: "loopback_http_websocket" },
		bootstrap: {
			project_policy: "preserve_project_owned_state",
			process_invocations: [],
			network_endpoints: [],
			activated_provider_bindings: [],
		},
		initial_grants: Array.from({ length: 58 }, (_, index) => ({ index })),
		managed_paths: [
			{ relative_path: ".rrflow" },
			{ relative_path: ".rrflow/credentials" },
			{ relative_path: ".rrflow" },
			{ relative_path: "AGENTS.rrflow.md" },
		],
		plan_sha256: "49342ffd18bd1b60cc6608864070a47b059991e8a7d9176be1b7dbe944a00301",
	},
	attunement: {
		phases: [
			{ phase: "inventory", sequence: 2 },
			{ phase: "connect", sequence: 1 },
		],
	},
};

const facts = installationFacts(preview);
assert.deepEqual(facts.createdPaths, [".rrflow", ".rrflow/credentials", "AGENTS.rrflow.md"]);
assert.equal(facts.preservesProjectFiles, true);
assert.equal(facts.loopbackOnly, true);
assert.equal(facts.networkEndpoints, 0);
assert.equal(facts.outsidePrograms, 0);
assert.equal(facts.aiProviders, 0);
assert.equal(facts.permissions, 58);
assert.deepEqual(facts.phases, ["connect", "inventory"], "phases follow their sequence");
assert.equal(facts.planSha256?.slice(0, 8), "49342ffd");

// A plan this version does not recognise yields no invented facts.
const unknown = installationFacts({ something: "else" });
assert.deepEqual(unknown.createdPaths, []);
assert.equal(unknown.preservesProjectFiles, false);
assert.equal(unknown.networkEndpoints, null);
assert.equal(unknown.permissions, null);

assert.equal(refusedAsFresh("ProjectBindingMismatch", "fresh"), true);
assert.equal(refusedAsFresh("ProjectBindingMismatch", "existing"), false);
assert.equal(refusedAsFresh("some other failure", "fresh"), false);

assert.equal(displayPath(String.raw`\\?\D:\work\project`), String.raw`D:\work\project`);
assert.equal(displayPath(String.raw`\\?\UNC\server\share`), String.raw`\\server\share`);
assert.equal(displayPath("/home/me/project"), "/home/me/project");

console.log("installation preview facts read the engine's plan and invent nothing");

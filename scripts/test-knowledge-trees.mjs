import assert from "node:assert/strict";
import test from "node:test";
import {
	knowledgeDescendants,
	knowledgeParentOptions,
	knowledgeTreeAvailability,
	knowledgeUnplacedPaths,
	putKnowledgePath,
	putKnowledgeTree,
	readKnowledgeTrees,
	rebaseKnowledgeTrees,
	removeKnowledgePath,
	saveKnowledgeTrees,
} from "../src/rrflow/knowledge.ts";

function path(id, parent_id = null, kind = "group") {
	return {
		id,
		name: id,
		parent_id,
		binding:
			kind === "group"
				? { kind }
				: {
						kind: "native",
						collection_id: "documents",
						vector_name: "semantic",
					},
	};
}

function tree() {
	return {
		id: "research",
		name: "Research 知識",
		paths: [
			path("root"),
			path("branch", "root"),
			path("leaf", "branch", "native"),
			path("other"),
		],
	};
}

function connection(status = "experimental") {
	return {
		endpoint: "http://127.0.0.1:9477",
		instance: "original-instance",
		service: {
			instance: "original-instance",
			installed_estate: {
				project_id: "existing-project",
				estate_id: "estate",
				instance_id: "original-instance",
			},
			capabilities: [
				{ name: "knowledge-tree-catalogue", contract_version: 1, status, limitation: null },
			],
		},
	};
}

test("renames, reparenting and source edits retain tree/path identities and input state", () => {
	const original = tree();
	const before = structuredClone(original);
	const edited = putKnowledgePath(original, {
		...original.paths[2],
		name: "Semantic research",
		parent_id: "other",
		binding: { kind: "native", collection_id: "new-documents", vector_name: "meaning" },
	});
	const renamed = putKnowledgeTree([original], { ...edited, name: "Authored knowledge" });
	assert.deepEqual(original, before);
	assert.equal(renamed[0].id, original.id);
	assert.equal(renamed[0].paths[2].id, "leaf");
	assert.equal(renamed[0].paths[2].parent_id, "other");
	assert.equal(renamed.length, 1);
});

test("parent choices exclude self, descendants and vector leaves", () => {
	const original = tree();
	assert.deepEqual(
		knowledgeParentOptions(original, "root").map((entry) => entry.id),
		["other"],
	);
	assert.throws(
		() => putKnowledgePath(original, { ...original.paths[0], parent_id: "branch" }),
		/descendants/,
	);
	assert.throws(
		() => putKnowledgePath(original, { ...original.paths[1], parent_id: "leaf" }),
		/grouping parent/,
	);
	assert.throws(
		() =>
			putKnowledgePath(original, {
				...original.paths[0],
				binding: {
					kind: "native",
					collection_id: "documents",
					vector_name: "semantic",
				},
			}),
		/children/,
	);
});

test("removing a group removes exactly its subtree and preserves vector data references elsewhere", () => {
	const original = tree();
	const result = removeKnowledgePath(original, "branch");
	assert.deepEqual([...knowledgeDescendants(original, "branch")], ["branch", "leaf"]);
	assert.deepEqual(
		result.paths.map((entry) => entry.id),
		["root", "other"],
	);
	assert.equal(original.paths.length, 4);
	const cycle = { ...original, paths: [path("one", "two"), path("two", "one")] };
	assert.equal(
		knowledgeDescendants(cycle, "one").size,
		2,
		"bad cached input cannot loop forever",
	);
});

test("three-way rebase combines disjoint local and estate edits using stable identities", () => {
	const base = [tree()];
	const local = structuredClone(base);
	local[0].name = "My tree rename";
	local[0].paths[2].name = "My path rename";
	const latest = structuredClone(base);
	latest[0].paths[2].binding.collection_id = "estate-rebound-collection";
	latest[0].paths.push(path("estate-added"));
	const before = structuredClone({ base, local, latest });
	const result = rebaseKnowledgeTrees(base, local, latest);
	assert.deepEqual(result.conflicts, []);
	assert.equal(result.trees[0].name, "My tree rename");
	assert.equal(result.trees[0].paths[2].name, "My path rename");
	assert.equal(result.trees[0].paths[2].binding.collection_id, "estate-rebound-collection");
	assert.equal(result.trees[0].paths.at(-1).id, "estate-added");
	assert.deepEqual({ base, local, latest }, before);
});

test("same-field and edit/delete conflicts preserve the local draft without hiding the conflict", () => {
	const base = [tree()];
	const local = structuredClone(base);
	local[0].paths[2].name = "My title";
	const latest = structuredClone(base);
	latest[0].paths[2].name = "Estate title";
	let result = rebaseKnowledgeTrees(base, local, latest);
	assert.equal(result.trees[0].paths[2].name, "My title");
	assert.deepEqual(result.conflicts, ["Path My title: name"]);
	latest[0].paths = latest[0].paths.filter((entry) => entry.id !== "leaf");
	result = rebaseKnowledgeTrees(base, local, latest);
	assert.equal(result.trees[0].paths.find((entry) => entry.id === "leaf").name, "My title");
	assert.equal(result.conflicts.length, 1);
});

test("rebase preserves deliberate local removals and independently added estate trees", () => {
	const base = [tree()];
	const local = [{ ...base[0], paths: [base[0].paths[3]] }];
	const latest = [...structuredClone(base), { id: "estate-tree", name: "Estate", paths: [] }];
	const result = rebaseKnowledgeTrees(base, local, latest);
	assert.deepEqual(result.conflicts, []);
	assert.deepEqual(
		result.trees[0].paths.map((entry) => entry.id),
		["other"],
	);
	assert.equal(result.trees[1].id, "estate-tree");
});

test("old, unavailable, incompatible and unbound engines invoke no knowledge routes", () => {
	let calls = 0;
	const client = {
		knowledgeTrees: () => {
			calls++;
		},
		replaceKnowledgeTrees: () => {
			calls++;
		},
	};
	const old = connection();
	old.service.capabilities = [];
	const future = connection();
	future.service.capabilities[0].contract_version = 2;
	const unbound = connection();
	unbound.service.installed_estate = null;
	const emptyLimitation = connection("unavailable");
	emptyLimitation.service.capabilities[0].limitation = "";
	for (const candidate of [old, connection("unavailable"), future, unbound, emptyLimitation]) {
		assert.ok(knowledgeTreeAvailability(candidate));
		assert.throws(() => readKnowledgeTrees(client, candidate));
		assert.throws(() => saveKnowledgeTrees(client, candidate, 1, [tree()]));
	}
	assert.equal(calls, 0);
});

test("negotiated manager pins native requests to the accepted instance and never submits project/scope", async () => {
	const calls = [];
	const catalogue = { revision: 2, trees: [tree()] };
	const client = {
		knowledgeTrees: async (instance) => {
			calls.push(instance);
			return catalogue;
		},
		replaceKnowledgeTrees: async (request) => {
			calls.push(request);
			return { catalogue, idempotent_replay: false };
		},
	};
	for (const status of ["experimental", "available"])
		assert.equal(knowledgeTreeAvailability(connection(status)), null);
	assert.equal(await readKnowledgeTrees(client, connection()), catalogue);
	const trees = [tree()];
	await saveKnowledgeTrees(client, connection(), 1, trees);
	assert.deepEqual(calls, [
		"original-instance",
		{ expected_instance: "original-instance", expected_revision: 1, trees },
	]);
	assert.equal(Object.hasOwn(calls[1], "project_id"), false);
	assert.equal(Object.hasOwn(calls[1], "scope"), false);
});

test("orphaned and cyclic paths remain addressable for repair after a stale-revision merge", () => {
	const original = tree();
	assert.deepEqual(knowledgeUnplacedPaths(original), []);
	const broken = {
		...original,
		paths: [
			path("orphan", "removed"),
			path("cycle-a", "cycle-b"),
			path("cycle-b", "cycle-a"),
			path("healthy"),
		],
	};
	assert.deepEqual(
		knowledgeUnplacedPaths(broken).map((entry) => entry.id),
		["orphan", "cycle-a", "cycle-b"],
	);
	const repaired = putKnowledgePath(broken, { ...broken.paths[1], parent_id: null });
	assert.deepEqual(
		knowledgeUnplacedPaths(repaired).map((entry) => entry.id),
		["orphan"],
	);
});

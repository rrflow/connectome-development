import assert from "node:assert/strict";
import {
	inventoryCheckpoint,
	inventoryNeighborhood,
	inventoryRoot,
} from "../src/features/runtime/graph/inventory-neighborhood.ts";

const snapshot = "a".repeat(64),
	root = "b".repeat(64),
	child = "c".repeat(64);
const checkpoint = {
	jobId: "job-1",
	digest: snapshot,
	cursor: "27",
	validAt: "1000",
	laterJobsNotScanned: false,
};
const row = (fromKind, from, to) => ({
	identity: "edge",
	values: {
		from_kind: fromKind,
		from_id: from,
		to_kind: "source-tree-entry",
		to_id: to,
		relation_kind: "source-tree-contains",
		relation_id: `edge-${to}`,
	},
});
const result = (rows, overrides = {}) => ({
	canonical_query: "",
	known_at_cursor: 27,
	schema_revision: 1,
	columns: [],
	rows,
	returned_rows: rows.length,
	truncated: false,
	keys_examined: 7,
	output_bytes: 100,
	...overrides,
});
const requests = [];
const client = {
	async attunement(r) {
		if (r.action === "list")
			return {
				kind: "page",
				page: {
					jobs: [
						{ job_id: "old", checkpoint_count: "0" },
						{ job_id: "job-1", checkpoint_count: "2" },
					],
					next_after_job_id: null,
				},
			};
		assert.equal(r.job_id, "job-1");
		return {
			kind: "snapshot",
			snapshot: {
				status: {
					job: {
						id: "job-1",
						checkpoints: [
							{
								phase: "inventory",
								output_sha256: snapshot,
								coordinates: { runtime_cursor: "27" },
								committed_at_unix_ms: "1000",
							},
						],
					},
				},
			},
		};
	},
	async query(q) {
		requests.push(q);
		assert.match(q, /AT VALID 1000 KNOWN 27/);
		if (q.includes("START source-tree-snapshot:"))
			return result([row("source-tree-snapshot", snapshot, root)]);
		if (q.includes("START source-tree-entry:"))
			return result([row("source-tree-entry", root, child)]);
		if (q.includes(`id = "${root}"`))
			return result([{ identity: root, values: { id: root, path: "", kind: "directory" } }]);
		if (q.includes(`id = "${child}"`))
			return result([
				{ identity: child, values: { id: child, path: "src", kind: "directory" } },
			]);
		throw new Error("unexpected query");
	},
};
assert.deepEqual(await inventoryCheckpoint(client), checkpoint);
assert.equal(await inventoryRoot(client, checkpoint), root);
const view = await inventoryNeighborhood(client, checkpoint, root, 20);
assert.deepEqual(
	view.nodes.map((n) => n.label),
	["Project root", "src"],
);
assert.equal(view.edges[0].from, `source-tree-entry:${root}`);
assert.equal(view.edges[0].to, `source-tree-entry:${child}`);
assert.equal(view.mayHaveMore, false);
assert.equal(requests.length, 4);
await assert.rejects(
	() => inventoryNeighborhood(client, checkpoint, 'x" OR id = "', 20),
	/invalid/,
);
await assert.rejects(() => inventoryNeighborhood(client, checkpoint, root, 999), /limit/);
const wrongStamp = { ...client, query: async () => result([], { known_at_cursor: 28 }) };
await assert.rejects(() => inventoryRoot(wrongStamp, checkpoint), /checkpoint cursor/);
const truncated = {
	...client,
	query: async () => result([row("source-tree-snapshot", snapshot, root)], { truncated: true }),
};
await assert.rejects(() => inventoryRoot(truncated, checkpoint), /missing or incomplete/);
const foreignEdge = {
	...client,
	query: async () => result([row("source-tree-entry", child, root)]),
};
await assert.rejects(
	() => inventoryNeighborhood(foreignEdge, checkpoint, root, 20),
	/unexpected relation/,
);
const denied = {
	...client,
	query: async () => {
		throw new Error("permission denied");
	},
};
await assert.rejects(() => inventoryRoot(denied, checkpoint), /permission denied/);
const more = {
	...client,
	attunement: async (r) =>
		r.action === "list"
			? {
					kind: "page",
					page: {
						jobs: [{ job_id: "job-1", checkpoint_count: "2" }],
						next_after_job_id: "job-1",
					},
				}
			: client.attunement(r),
};
assert.equal((await inventoryCheckpoint(more)).laterJobsNotScanned, true);
const none = {
	...client,
	attunement: async () => ({
		kind: "page",
		page: { jobs: [{ job_id: "none", checkpoint_count: "0" }], next_after_job_id: null },
	}),
};
assert.equal(await inventoryCheckpoint(none), null);
const duplicate = {
	...client,
	query: async () =>
		result([row("source-tree-entry", root, child), row("source-tree-entry", root, child)]),
};
await assert.rejects(() => inventoryNeighborhood(duplicate, checkpoint, root, 20), /repeated/);
const missingLabel = {
	...client,
	query: async (q) =>
		q.includes("START source-tree-entry:")
			? result([row("source-tree-entry", root, child)])
			: result([]),
};
await assert.rejects(
	() => inventoryNeighborhood(missingLabel, checkpoint, root, 20),
	/missing or incomplete/,
);
const limited = {
	...client,
	query: async (q) =>
		q.includes("START source-tree-entry:") ? result([], { truncated: true }) : client.query(q),
};
assert.equal((await inventoryNeighborhood(limited, checkpoint, root, 20)).mayHaveMore, true);
await assert.rejects(
	() => inventoryRoot(client, { ...checkpoint, validAt: "18446744073709551616" }),
	/invalid coordinates/,
);
console.log("inventory checkpoint and bounded neighborhood cases passed");

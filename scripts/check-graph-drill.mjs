import assert from "node:assert/strict";
import {
	clusterMembers,
	clusterOverview,
	groupAnchor,
	groupNodeId,
} from "../src/features/runtime/graph/drill.ts";

const node = (id, cluster) => ({
	id,
	kind: "document",
	key: id,
	label: id,
	properties: {},
	cluster,
});
const edge = (id, from, to) => ({ id, kind: "links_to", from, to });
const graph = {
	valid_at_unix_ms: 1,
	known_at_cursor: 1,
	nodes: [
		node("a1", 0),
		node("a2", 0),
		node("a3", 0),
		node("b1", 1),
		node("b2", 1),
		node("x", 2),
		node("y", 3),
	],
	edges: [
		edge("e1", "a1", "a2"),
		edge("e2", "a1", "a3"),
		edge("e3", "b1", "b2"),
		edge("e4", "a2", "b1"),
		edge("e5", "a3", "b2"),
	],
	clusters: [
		{ id: 0, size: 3, anchor: "a1", label: "Alpha" },
		{ id: 1, size: 2, anchor: "b1", label: "Beta" },
		{ id: 2, size: 1, anchor: "x", label: "x" },
		{ id: 3, size: 1, anchor: "y", label: "y" },
	],
};

// The overview draws one node per cluster, and single unlinked records as one group.
{
	const view = clusterOverview(graph);
	assert.deepEqual(
		view.nodes.map((group) => group.label),
		["Alpha (3)", "Beta (2)", "Unlinked records (2)"],
	);
	assert.equal(view.hidden, 0);
	assert.equal(view.edges.length, 1, "links between two clusters merge into one edge");
	assert.equal(view.edges[0].weight, 2, "and the edge counts them");
}

// Group ids carry the anchor, which survives a renumbering of the clusters.
{
	const renumbered = {
		...graph,
		nodes: graph.nodes.map((item) => ({
			...item,
			cluster: item.cluster === 0 ? 1 : item.cluster === 1 ? 0 : item.cluster,
		})),
		clusters: [graph.clusters[1], graph.clusters[0], graph.clusters[2], graph.clusters[3]],
	};
	assert.deepEqual(
		new Set(clusterOverview(renumbered).nodes.map((group) => group.id)),
		new Set(clusterOverview(graph).nodes.map((group) => group.id)),
	);
	assert.equal(groupAnchor(groupNodeId("a1")), "a1");
	assert.equal(groupAnchor("document:a1"), null);
}

// Drilling in draws only that cluster's records and links.
{
	const view = clusterMembers(graph, "a1");
	assert.deepEqual(view.nodes.map((item) => item.id).sort(), ["a1", "a2", "a3"]);
	assert.deepEqual(view.edges.map((item) => item.id).sort(), ["e1", "e2"]);
	assert.equal(view.hidden, 0);
}

// Past the limit, the most linked records stay and the rest are counted.
{
	const view = clusterMembers(graph, "a1", 2);
	assert.equal(view.nodes[0].id, "a1", "the most linked record comes first");
	assert.equal(view.nodes.length, 2);
	assert.equal(view.hidden, 1);
	assert.equal(clusterOverview(graph, 1).hidden, 4, "records in clusters not drawn are counted");
}

console.log("cluster drill-down groups, limits and counts records");

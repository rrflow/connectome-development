import assert from "node:assert/strict";
import Graph from "graphology";
import { nodeSize, reconcileGraph } from "../src/features/runtime/graph/live-layout.ts";

const label = (text) => text;

function drawn(positions) {
	const model = new Graph({ multi: true, type: "directed", allowSelfLoops: true });
	for (const [id, x, y] of positions) {
		model.addNode(id, { label: id, x, y, size: 3, color: "" });
	}
	return model;
}

const place = [
	["a", 0, 0],
	["b", 100, 0],
	["c", 0, 100],
	["d", 100, 100],
];
const nodesOf = (ids) => ids.map((id) => ({ id, label: id }));

// A new node lands beside its neighbour and nothing else moves.
{
	const model = drawn(place);
	const edges = [{ id: "e1", from: "a", to: "n" }];
	assert.equal(reconcileGraph(model, nodesOf(["a", "b", "c", "d", "n"]), edges, label), true);
	for (const [id, x, y] of place) {
		assert.equal(model.getNodeAttribute(id, "x"), x, `${id} kept its x`);
		assert.equal(model.getNodeAttribute(id, "y"), y, `${id} kept its y`);
	}
	const distance = Math.hypot(model.getNodeAttribute("n", "x"), model.getNodeAttribute("n", "y"));
	assert.ok(distance > 0 && distance <= 5, `the new node is beside a, at ${distance}`);
	assert.equal(model.getNodeAttribute("a", "size"), nodeSize(1), "size follows the new link");
}

// The same input twice changes nothing, as React's double render requires.
{
	const model = drawn(place);
	const nodes = nodesOf(["a", "b", "c", "d", "n"]);
	const edges = [{ id: "e1", from: "a", to: "n" }];
	reconcileGraph(model, nodes, edges, label);
	const first = [model.getNodeAttribute("n", "x"), model.size, model.order];
	reconcileGraph(model, nodes, edges, label);
	assert.deepEqual([model.getNodeAttribute("n", "x"), model.size, model.order], first);
}

// A removal and a rename apply in place.
{
	const model = drawn(place);
	model.addEdgeWithKey("old", "a", "b", { weight: 1, size: 1 });
	const nodes = [
		{ id: "a", label: "renamed" },
		{ id: "b", label: "b" },
		{ id: "c", label: "c" },
	];
	assert.equal(reconcileGraph(model, nodes, [], label), true);
	assert.equal(model.hasNode("d"), false, "a retired record leaves the drawing");
	assert.equal(model.hasEdge("old"), false, "a retired relation leaves the drawing");
	assert.equal(model.getNodeAttribute("a", "label"), "renamed");
}

// A wholesale change asks for a new layout and leaves the old drawing alone.
{
	const model = drawn(place);
	const fresh = Array.from({ length: 12 }, (_, index) => `new-${index}`);
	assert.equal(reconcileGraph(model, nodesOf(fresh), [], label), false);
	assert.deepEqual(model.nodes(), ["a", "b", "c", "d"]);
	assert.equal(reconcileGraph(drawn([]), nodesOf(["a"]), [], label), false, "nothing to keep");
}

console.log("live graph updates keep every existing position");

import type Graph from "graphology";

export interface NodeAttributes {
	label: string;
	x: number;
	y: number;
	size: number;
	color: string;
}

export interface EdgeAttributes {
	weight: number;
	size: number;
}

export type LayoutGraph = Graph<NodeAttributes, EdgeAttributes>;

interface LiveNode {
	id: string;
	label: string;
}

interface LiveEdge {
	id: string;
	from: string;
	to: string;
	weight?: number;
}

/** More new nodes than this share of those drawn is a new picture, not an update. */
const MAX_NEW_SHARE = 0.5;
/** A small graph can always take this many new nodes in place. */
const MIN_NEW_IN_PLACE = 8;
/** How far from its neighbours a new node lands, as a share of the drawing's span. */
const SEED_SPREAD = 0.04;

export function nodeSize(degree: number): number {
	return 3 + 2 * Math.log2(1 + degree);
}

/** A stable angle for an id, so the same change always lands in the same place. */
function angleOf(id: string): number {
	let hash = 2166136261;
	for (let index = 0; index < id.length; index += 1) {
		hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
	}
	return ((hash >>> 0) / 4294967296) * 2 * Math.PI;
}

/**
 * Brings a drawn graph up to date without moving what is already there, so a
 * reader keeps their place while the data changes. Returns false, leaving the
 * graph untouched, when so much is new that a fresh layout is the honest answer.
 * Safe to run twice with the same input.
 */
export function reconcileGraph(
	model: LayoutGraph,
	nodes: readonly LiveNode[],
	edges: readonly LiveEdge[],
	labelOf: (label: string) => string,
): boolean {
	const added = nodes.filter((node) => !model.hasNode(node.id));
	if (
		model.order === 0 ||
		added.length > Math.max(MIN_NEW_IN_PLACE, model.order * MAX_NEW_SHARE)
	) {
		return false;
	}

	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	model.forEachNode((_, { x, y }) => {
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
	});
	const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
	const reach = Math.max(maxX - minX, maxY - minY, 1) * SEED_SPREAD;

	const wantedNodes = new Set(nodes.map((node) => node.id));
	for (const node of model.nodes()) {
		if (!wantedNodes.has(node)) model.dropNode(node);
	}
	const wantedEdges = new Set(edges.map((edge) => edge.id));
	for (const edge of model.edges()) {
		if (!wantedEdges.has(edge)) model.dropEdge(edge);
	}

	const newNodes = new Set(added.map((node) => node.id));
	for (const node of added) {
		model.addNode(node.id, {
			label: labelOf(node.label),
			x: center.x,
			y: center.y,
			size: 3,
			color: "",
		});
	}
	for (const edge of edges) {
		if (!model.hasEdge(edge.id) && model.hasNode(edge.from) && model.hasNode(edge.to)) {
			model.addEdgeWithKey(edge.id, edge.from, edge.to, {
				weight: edge.weight ?? 1,
				size: 1,
			});
		}
	}

	for (const id of newNodes) {
		const anchors = model.neighbors(id).filter((neighbour) => !newNodes.has(neighbour));
		const origin =
			anchors.length === 0
				? center
				: {
						x:
							anchors.reduce((sum, a) => sum + model.getNodeAttribute(a, "x"), 0) /
							anchors.length,
						y:
							anchors.reduce((sum, a) => sum + model.getNodeAttribute(a, "y"), 0) /
							anchors.length,
					};
		const angle = angleOf(id);
		model.setNodeAttribute(id, "x", origin.x + Math.cos(angle) * reach);
		model.setNodeAttribute(id, "y", origin.y + Math.sin(angle) * reach);
	}

	for (const node of nodes) {
		const label = labelOf(node.label);
		if (model.getNodeAttribute(node.id, "label") !== label) {
			model.setNodeAttribute(node.id, "label", label);
		}
	}
	// No attribute hint: sigma would answer one with a partial repaint, and that
	// throws for the nodes added above, which it has not indexed yet.
	model.updateEachNodeAttributes((id, attributes) => ({
		...attributes,
		size: nodeSize(model.degree(id)),
	}));
	return true;
}

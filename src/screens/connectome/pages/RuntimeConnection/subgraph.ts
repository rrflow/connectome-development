import type { RrdGraphView } from "~/rrflow/session";

export type GraphScope = "estate" | "neighbourhood";
export type GraphDirection = "both" | "outgoing" | "incoming";

export interface GraphLens {
	scope: GraphScope;
	/** Record whose neighbourhood is drawn in `neighbourhood` scope. */
	focus: string | null;
	depth: number;
	direction: GraphDirection;
	/** Record kinds to draw; empty draws every kind. */
	recordKinds: string[];
	/** Relation kinds to draw; empty draws every kind. */
	relationKinds: string[];
}

/**
 * Selects the part of the engine-issued graph snapshot one lens draws: the
 * whole estate or one record's neighbourhood, filtered by record and relation
 * kind. It never invents records or relations; every node and edge returned
 * is in the snapshot.
 */
export function selectSubgraph(graph: RrdGraphView, lens: GraphLens): RrdGraphView {
	const recordKinds = new Set(lens.recordKinds);
	const relationKinds = new Set(lens.relationKinds);
	const nodes = graph.nodes.filter(
		(node) => recordKinds.size === 0 || recordKinds.has(node.kind) || node.id === lens.focus,
	);
	const visible = new Set(nodes.map((node) => node.id));
	const edges = graph.edges.filter(
		(edge) =>
			(relationKinds.size === 0 || relationKinds.has(edge.kind)) &&
			visible.has(edge.from) &&
			visible.has(edge.to),
	);

	if (lens.scope === "estate" || !lens.focus || !visible.has(lens.focus)) {
		return { ...graph, nodes, edges };
	}

	const outgoing = new Map<string, string[]>();
	const incoming = new Map<string, string[]>();
	for (const edge of edges) {
		outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
		incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
	}
	const reached = new Set([lens.focus]);
	let frontier = [lens.focus];
	for (let level = 0; level < lens.depth && frontier.length > 0; level += 1) {
		const next: string[] = [];
		for (const id of frontier) {
			const neighbours = [
				...(lens.direction !== "incoming" ? (outgoing.get(id) ?? []) : []),
				...(lens.direction !== "outgoing" ? (incoming.get(id) ?? []) : []),
			];
			for (const neighbour of neighbours) {
				if (!reached.has(neighbour)) {
					reached.add(neighbour);
					next.push(neighbour);
				}
			}
		}
		frontier = next;
	}

	return {
		...graph,
		nodes: nodes.filter((node) => reached.has(node.id)),
		edges: edges.filter((edge) => reached.has(edge.from) && reached.has(edge.to)),
	};
}

export function kinds(values: { kind: string }[]): string[] {
	return [...new Set(values.map((value) => value.kind))].sort();
}

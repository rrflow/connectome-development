import type { RrdGraphView } from "~/rrflow/session";

/** What the engram holds, which can exceed what the engine sent. */
export function graphTotals(graph: RrdGraphView) {
	return {
		records: Math.max(graph.records_total ?? 0, graph.nodes.length),
		relations: Math.max(graph.relations_total ?? 0, graph.edges.length),
	};
}

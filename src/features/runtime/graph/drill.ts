import type { RrdGraphView, RrdNodeView } from "~/rrflow/session";

/**
 * Most nodes drawn in detail at once. In a controlled study people struggled
 * past about 50 dense or 100 sparse nodes, so larger sets are grouped.
 */
export const MAX_DETAILED_NODES = 100;

const GROUP_PREFIX = "cluster-group:";
/** Clusters of one unlinked record collapse into this single group. */
const UNLINKED_ANCHOR = "(unlinked)";

export interface DrillNode {
	id: string;
	label: string;
}

export interface DrillEdge {
	id: string;
	from: string;
	to: string;
	weight?: number;
}

export interface DrillView {
	nodes: DrillNode[];
	edges: DrillEdge[];
	/** Records in this view that are not drawn. */
	hidden: number;
}

export function groupNodeId(anchor: string): string {
	return `${GROUP_PREFIX}${anchor}`;
}

/** The anchor of a group node, or null for an ordinary record. */
export function groupAnchor(id: string): string | null {
	return id.startsWith(GROUP_PREFIX) ? id.slice(GROUP_PREFIX.length) : null;
}

/**
 * The anchor names a cluster across refreshes: cluster numbers follow size and
 * can change whenever the data does.
 */
function anchorOf(graph: RrdGraphView, node: RrdNodeView): string {
	const cluster = graph.clusters[node.cluster];
	if (!cluster) return UNLINKED_ANCHOR;
	return cluster.size === 1 ? UNLINKED_ANCHOR : cluster.anchor;
}

/** The group a record belongs to in the overview. */
export function groupOfRecord(graph: RrdGraphView, node: RrdNodeView): string {
	return groupNodeId(anchorOf(graph, node));
}

/** One node per cluster, largest first, with one weighted edge per linked pair. */
export function clusterOverview(
	graph: RrdGraphView,
	limit: number = MAX_DETAILED_NODES,
): DrillView {
	const groups = new Map<string, { label: string; size: number }>();
	const anchorByRecord = new Map<string, string>();
	for (const node of graph.nodes) {
		const anchor = anchorOf(graph, node);
		anchorByRecord.set(node.id, anchor);
		const group = groups.get(anchor);
		if (group) {
			group.size += 1;
		} else {
			const label =
				anchor === UNLINKED_ANCHOR
					? "Unlinked records"
					: (graph.clusters[node.cluster]?.label ?? anchor);
			groups.set(anchor, { label, size: 1 });
		}
	}
	// Unlinked records come last: they are the least informative group.
	const ordered = [...groups.entries()].sort(
		([a, left], [b, right]) =>
			Number(a === UNLINKED_ANCHOR) - Number(b === UNLINKED_ANCHOR) ||
			right.size - left.size ||
			a.localeCompare(b),
	);
	const kept = ordered.slice(0, limit);
	const keptAnchors = new Set(kept.map(([anchor]) => anchor));
	const weights = new Map<string, { from: string; to: string; weight: number }>();
	for (const edge of graph.edges) {
		const from = anchorByRecord.get(edge.from);
		const to = anchorByRecord.get(edge.to);
		if (!from || !to || from === to || !keptAnchors.has(from) || !keptAnchors.has(to)) {
			continue;
		}
		const [first, second] = from < to ? [from, to] : [to, from];
		const key = `${first}\n${second}`;
		const pair = weights.get(key);
		if (pair) pair.weight += 1;
		else weights.set(key, { from: first, to: second, weight: 1 });
	}
	return {
		nodes: kept.map(([anchor, group]) => ({
			id: groupNodeId(anchor),
			label: `${group.label} (${group.size})`,
		})),
		edges: [...weights.entries()].map(([key, pair]) => ({
			id: `group-edge:${key}`,
			from: groupNodeId(pair.from),
			to: groupNodeId(pair.to),
			weight: pair.weight,
		})),
		hidden: ordered.slice(limit).reduce((sum, [, group]) => sum + group.size, 0),
	};
}

/** The records of one cluster, the most linked first when there are too many. */
export function clusterMembers(
	graph: RrdGraphView,
	anchor: string,
	limit: number = MAX_DETAILED_NODES,
): DrillView {
	const members = graph.nodes.filter((node) => anchorOf(graph, node) === anchor);
	const memberIds = new Set(members.map((node) => node.id));
	const inside = graph.edges.filter((edge) => memberIds.has(edge.from) && memberIds.has(edge.to));
	const degree = new Map<string, number>();
	for (const edge of inside) {
		degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
		degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
	}
	const kept = [...members]
		.sort(
			(left, right) =>
				(degree.get(right.id) ?? 0) - (degree.get(left.id) ?? 0) ||
				left.label.localeCompare(right.label),
		)
		.slice(0, limit);
	const keptIds = new Set(kept.map((node) => node.id));
	return {
		nodes: kept.map((node) => ({ id: node.id, label: node.label })),
		edges: inside
			.filter((edge) => keptIds.has(edge.from) && keptIds.has(edge.to))
			.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to })),
		hidden: members.length - kept.length,
	};
}

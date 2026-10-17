import type { RrdGraphView, RrdNodeView } from "~/rrflow/session";

/*
 * Color groups for the record graph and the similarity map. A grouping is
 * computed over the whole estate snapshot, so a record keeps its color in
 * every subgraph and in both maps.
 */

/** Groups that get their own color; smaller groups share the "Other" swatch. */
export const MAX_COLOR_GROUPS = 10;
/** Mantine palette names, one per colored group. */
const PALETTE = [
	"violet",
	"blue",
	"teal",
	"orange",
	"pink",
	"cyan",
	"yellow",
	"grape",
	"green",
	"red",
] as const;
/** A field can color the graph when at least this share of records has it… */
const FIELD_COVERAGE = 0.5;
/** …and it takes at most this many distinct values. */
const MAX_FIELD_VALUES = 12;
/** A field whose values are mostly paths colors by folder instead. */
const PATH_SHARE = 0.8;
/** Folder levels kept when coloring by a path-like field. */
const FOLDER_DEPTH = 2;

export const OTHER_GROUP = "other";
const UNLINKED_GROUP = "unlinked";
const MISSING_GROUP = "missing";

export interface ColorOption {
	value: string;
	label: string;
}

export interface ColorGroup {
	id: string;
	label: string;
	/** Mantine palette name; `null` draws the neutral swatch. */
	palette: string | null;
	/** Records in the group across the whole estate. */
	total: number;
}

export interface Grouping {
	/** Record identity (`kind:id`) to group id. */
	groupOf: Map<string, string>;
	/** Groups in legend order. */
	groups: ColorGroup[];
}

/** The ways the current estate can be colored, best first. */
export function colorOptions(graph: RrdGraphView): ColorOption[] {
	const options: ColorOption[] = [];
	if (graph.clusters.length > 1) {
		options.push({ value: "cluster", label: "Cluster" });
	}
	options.push({ value: "kind", label: "Kind" });
	const nodes = graph.nodes.length;
	if (nodes === 0) return options;
	const fields = new Map<string, string[]>();
	for (const node of graph.nodes) {
		for (const [name, value] of Object.entries(node.properties)) {
			fields.set(name, [...(fields.get(name) ?? []), value]);
		}
	}
	for (const [name, values] of [...fields.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		if (values.length / nodes < FIELD_COVERAGE) continue;
		const paths = values.filter((value) => value.includes("/")).length;
		if (paths / values.length >= PATH_SHARE) {
			// A folder grouping that puts everything in one folder says nothing.
			if (new Set(values.map(folderOf)).size >= 2) {
				options.push({ value: `folder:${name}`, label: `Folder (${name})` });
			}
			continue;
		}
		const distinct = new Set(values).size;
		if (distinct >= 2 && distinct <= MAX_FIELD_VALUES) {
			options.push({ value: `field:${name}`, label: `Field: ${name}` });
		}
	}
	return options;
}

/**
 * `docs/evidence/change-journals/x.md` → `docs/evidence`. A URI scheme is
 * dropped first, so `rrflow://instance/data/x` reads as `instance/data`.
 */
export function folderOf(path: string): string {
	const folders = path
		.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
		.split("/")
		.filter(Boolean)
		.slice(0, -1);
	return folders.length === 0 ? "(top level)" : folders.slice(0, FOLDER_DEPTH).join("/");
}

/** Linked records per record, counting both directions. */
export function degrees(graph: RrdGraphView): Map<string, number> {
	const counts = new Map<string, number>();
	for (const edge of graph.edges) {
		counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
		counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
	}
	return counts;
}

interface RawGroup {
	id: string;
	label: string;
	/** Neutral groups ("Unlinked", "No value") never take a palette color. */
	neutral: boolean;
	/** Order among clusters: the engine-side cluster number, largest first. */
	rank: number;
	members: string[];
}

function rawGroups(graph: RrdGraphView, option: string): RawGroup[] {
	const groups = new Map<string, RawGroup>();
	const add = (node: RrdNodeView, id: string, label: string, neutral = false, rank = 0) => {
		const group = groups.get(id) ?? { id, label, neutral, rank, members: [] };
		group.members.push(node.id);
		groups.set(id, group);
	};

	if (option === "cluster") {
		const linked = degrees(graph);
		for (const node of graph.nodes) {
			const cluster = graph.clusters[node.cluster];
			if (!cluster || (cluster.size === 1 && !linked.has(node.id))) {
				add(node, UNLINKED_GROUP, "Unlinked records", true);
			} else {
				add(node, `cluster:${cluster.id}`, cluster.label, false, cluster.id);
			}
		}
		return [...groups.values()].sort(
			(a, b) => Number(a.neutral) - Number(b.neutral) || a.rank - b.rank,
		);
	}

	const [mode, field] = option.split(":", 2);
	for (const node of graph.nodes) {
		if (mode === "folder" || mode === "field") {
			const value = node.properties[field];
			if (value === undefined) {
				add(node, MISSING_GROUP, `No ${field}`, true);
			} else {
				const label = mode === "folder" ? folderOf(value) : value;
				add(node, `${mode}:${label}`, label);
			}
		} else {
			add(node, `kind:${node.kind}`, node.kind);
		}
	}
	return [...groups.values()].sort(
		(a, b) =>
			Number(a.neutral) - Number(b.neutral) ||
			b.members.length - a.members.length ||
			a.label.localeCompare(b.label),
	);
}

/**
 * Assigns every record a color group for `option`. The largest groups get the
 * palette; the remainder merge into one "Other" group so the legend stays
 * readable at any estate size.
 */
export function grouping(graph: RrdGraphView, option: string): Grouping {
	const groupOf = new Map<string, string>();
	const groups: ColorGroup[] = [];
	let other: ColorGroup | null = null;
	let colored = 0;
	for (const group of rawGroups(graph, option)) {
		if (group.neutral) {
			groups.push({
				id: group.id,
				label: group.label,
				palette: null,
				total: group.members.length,
			});
		} else if (colored < MAX_COLOR_GROUPS) {
			groups.push({
				id: group.id,
				label: group.label,
				palette: PALETTE[colored % PALETTE.length],
				total: group.members.length,
			});
			colored += 1;
		} else {
			other ??= { id: OTHER_GROUP, label: "Other", palette: null, total: 0 };
			other.total += group.members.length;
			for (const member of group.members) groupOf.set(member, OTHER_GROUP);
			continue;
		}
		for (const member of group.members) groupOf.set(member, group.id);
	}
	if (other) groups.push(other);
	return { groupOf, groups };
}

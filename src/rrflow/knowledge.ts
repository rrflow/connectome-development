import type {
	RrdConnectionView,
	RrdKnowledgePathView,
	RrdKnowledgeTreeCatalogueView,
	RrdKnowledgeTreeView,
	RrdReplaceKnowledgeTreesRequest,
	RrdReplaceKnowledgeTreesView,
} from "./session";

export const KNOWLEDGE_TREE_CAPABILITY = "knowledge-tree-catalogue";

/** Capability negotiation is checked before any new endpoint is invoked. The
 * native bridge repeats this check and binds the accepted project and scope. */
export function knowledgeTreeAvailability(connection: RrdConnectionView): string | null {
	if (!connection.service.installed_estate) {
		return "This engine has not presented an installed project identity for knowledge trees.";
	}
	const capability = connection.service.capabilities.find(
		(candidate) => candidate.name === KNOWLEDGE_TREE_CAPABILITY,
	);
	if (
		capability?.contract_version !== 1 ||
		!["available", "experimental"].includes(capability.status)
	) {
		return (
			capability?.limitation ||
			"This estate does not offer knowledge-tree-catalogue v1. Its existing records, vectors and storage remain available."
		);
	}
	return null;
}

interface KnowledgeClient {
	knowledgeTrees(expectedInstance: string): Promise<RrdKnowledgeTreeCatalogueView>;
	replaceKnowledgeTrees(
		request: RrdReplaceKnowledgeTreesRequest,
	): Promise<RrdReplaceKnowledgeTreesView>;
}

function requireKnowledgeTrees(connection: RrdConnectionView) {
	const unavailable = knowledgeTreeAvailability(connection);
	if (unavailable) throw new Error(unavailable);
}

export function readKnowledgeTrees(client: KnowledgeClient, connection: RrdConnectionView) {
	requireKnowledgeTrees(connection);
	return client.knowledgeTrees(connection.instance);
}

export function saveKnowledgeTrees(
	client: KnowledgeClient,
	connection: RrdConnectionView,
	expectedRevision: number,
	trees: RrdKnowledgeTreeView[],
) {
	requireKnowledgeTrees(connection);
	return client.replaceKnowledgeTrees({
		expected_instance: connection.instance,
		expected_revision: expectedRevision,
		trees,
	});
}

/** IDs are generated once and kept on rename, reparent and binding edits. */
export function knowledgeId(kind: "tree" | "path" | "binding") {
	return `${kind}-${crypto.randomUUID()}`;
}

export function putKnowledgeTree(trees: RrdKnowledgeTreeView[], tree: RrdKnowledgeTreeView) {
	const existing = trees.some((candidate) => candidate.id === tree.id);
	return existing
		? trees.map((candidate) => (candidate.id === tree.id ? tree : candidate))
		: [...trees, tree];
}

export function knowledgeDescendants(tree: RrdKnowledgeTreeView, pathId: string): Set<string> {
	const removed = new Set([pathId]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const path of tree.paths) {
			if (path.parent_id && removed.has(path.parent_id) && !removed.has(path.id)) {
				removed.add(path.id);
				changed = true;
			}
		}
	}
	return removed;
}

export function knowledgeParentOptions(tree: RrdKnowledgeTreeView, pathId?: string) {
	const excluded = pathId ? knowledgeDescendants(tree, pathId) : new Set<string>();
	return tree.paths.filter((path) => path.binding.kind === "group" && !excluded.has(path.id));
}

/** Keep orphaned or cyclic paths editable after concurrent structural edits. */
export function knowledgeUnplacedPaths(tree: RrdKnowledgeTreeView) {
	const reachable = new Set<string>();
	let changed = true;
	while (changed) {
		changed = false;
		for (const path of tree.paths) {
			if (
				!reachable.has(path.id) &&
				(path.parent_id === null || reachable.has(path.parent_id))
			) {
				reachable.add(path.id);
				changed = true;
			}
		}
	}
	return tree.paths.filter((path) => !reachable.has(path.id));
}

export function putKnowledgePath(tree: RrdKnowledgeTreeView, path: RrdKnowledgePathView) {
	if (
		path.parent_id &&
		!knowledgeParentOptions(tree, path.id).some((parent) => parent.id === path.parent_id)
	) {
		throw new Error("Choose a grouping parent outside this path's descendants.");
	}
	const existing = tree.paths.find((candidate) => candidate.id === path.id);
	if (
		existing?.binding.kind === "group" &&
		path.binding.kind !== "group" &&
		tree.paths.some((child) => child.parent_id === path.id)
	) {
		throw new Error("Move or remove this group's children before changing its source kind.");
	}
	return {
		...tree,
		paths: existing
			? tree.paths.map((candidate) => (candidate.id === path.id ? path : candidate))
			: [...tree.paths, path],
	};
}

/** Removing a group removes its whole subtree, so no invisible orphan remains. */
export function removeKnowledgePath(tree: RrdKnowledgeTreeView, pathId: string) {
	const removed = knowledgeDescendants(tree, pathId);
	return { ...tree, paths: tree.paths.filter((path) => !removed.has(path.id)) };
}

function equal(left: unknown, right: unknown) {
	return JSON.stringify(left) === JSON.stringify(right);
}

/** Three-way merge by immutable identities. Disjoint estate changes survive;
 * conflicting fields retain the local draft until the operator resolves them. */
export function rebaseKnowledgeTrees(
	base: RrdKnowledgeTreeView[],
	local: RrdKnowledgeTreeView[],
	latest: RrdKnowledgeTreeView[],
): { trees: RrdKnowledgeTreeView[]; conflicts: string[] } {
	const conflicts: string[] = [];
	function field<T>(before: T, mine: T, theirs: T, label: string): T {
		if (equal(mine, before)) return theirs;
		if (equal(theirs, before) || equal(mine, theirs)) return mine;
		conflicts.push(label);
		return mine;
	}
	function mergeEntries<T extends { id: string }>(
		before: T[],
		mine: T[],
		theirs: T[],
		label: string,
		merge: (baseValue: T, localValue: T, latestValue: T) => T,
	): T[] {
		const old = new Map(before.map((entry) => [entry.id, entry]));
		const ours = new Map(mine.map((entry) => [entry.id, entry]));
		const current = new Map(theirs.map((entry) => [entry.id, entry]));
		const ids = new Set([...old.keys(), ...ours.keys(), ...current.keys()]);
		const merged: T[] = [];
		for (const id of ids) {
			const b = old.get(id);
			const l = ours.get(id);
			const r = current.get(id);
			let value: T | undefined;
			if (equal(l, b)) value = r;
			else if (equal(r, b) || equal(l, r)) value = l;
			else if (b && l && r) value = merge(b, l, r);
			else {
				conflicts.push(`${label} ${id} was removed or independently added`);
				value = l;
			}
			if (value) merged.push(value);
		}
		return merged;
	}
	const trees = mergeEntries(base, local, latest, "Tree", (before, mine, theirs) => ({
		...mine,
		name: field(before.name, mine.name, theirs.name, `Tree ${mine.name}: name`),
		paths: mergeEntries(
			before.paths,
			mine.paths,
			theirs.paths,
			`Path in ${mine.name}`,
			(old, ours, current) => ({
				...ours,
				name: field(old.name, ours.name, current.name, `Path ${ours.name}: name`),
				parent_id: field(
					old.parent_id,
					ours.parent_id,
					current.parent_id,
					`Path ${ours.name}: parent`,
				),
				binding: field(
					old.binding,
					ours.binding,
					current.binding,
					`Path ${ours.name}: source`,
				),
			}),
		),
	}));
	return { trees, conflicts };
}

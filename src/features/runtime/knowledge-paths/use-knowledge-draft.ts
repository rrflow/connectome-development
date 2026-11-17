import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	knowledgeTreeAvailability,
	putKnowledgePath,
	putKnowledgeTree,
	readKnowledgeTrees,
	rebaseKnowledgeTrees,
	removeKnowledgePath,
	saveKnowledgeTrees,
} from "~/rrflow/knowledge";
import type {
	RrdKnowledgePathView,
	RrdKnowledgeTreeCatalogueView,
	RrdKnowledgeTreeView,
} from "~/rrflow/session";
import type { RuntimeLensProps } from "../types";
import { errorText } from "./binding";

export interface Draft {
	/** The saved catalogue this draft started from, so a newer save can be rebased onto. */
	base: RrdKnowledgeTreeCatalogueView;
	trees: RrdKnowledgeTreeView[];
}

export interface Conflict {
	latest: RrdKnowledgeTreeCatalogueView;
	merged: RrdKnowledgeTreeView[];
	conflicts: string[];
}

/** What a removal in the draft targets: a whole tree, or one path and its descendants. */
export interface Removal {
	tree: RrdKnowledgeTreeView;
	path?: RrdKnowledgePathView;
}

/**
 * Reads the project's knowledge trees and keeps edits in a local draft. Nothing
 * reaches the engine until `save`, which sends the draft against the revision it
 * started from; a newer revision is merged three ways and any field both sides
 * changed is kept as a conflict for the person to settle.
 */
export function useKnowledgeDraft({ client, connection, sessionKey }: RuntimeLensProps) {
	const queryClient = useQueryClient();
	const queryKey = ["rrd-knowledge-trees", sessionKey];
	const unavailable = knowledgeTreeAvailability(connection);
	const query = useQuery({
		queryKey,
		enabled: !unavailable,
		queryFn: () => readKnowledgeTrees(client, connection),
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const vectors = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		enabled: !unavailable,
		queryFn: () => client.vectorCollections(),
	});
	const [draft, setDraft] = useState<Draft | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [conflict, setConflict] = useState<Conflict | null>(null);

	useEffect(() => {
		if (query.data && !draft) setDraft({ base: query.data, trees: query.data.trees });
	}, [query.data, draft]);

	const dirty =
		draft !== null && JSON.stringify(draft.trees) !== JSON.stringify(draft.base.trees);

	function applyLatest(latest: RrdKnowledgeTreeCatalogueView, current: Draft | null) {
		queryClient.setQueryData(queryKey, latest);
		if (!current) {
			setDraft({ base: latest, trees: latest.trees });
			return;
		}
		const merged = rebaseKnowledgeTrees(current.base.trees, current.trees, latest.trees);
		if (merged.conflicts.length) {
			setConflict({ latest, merged: merged.trees, conflicts: merged.conflicts });
			setNotice(null);
		} else {
			setDraft({ base: latest, trees: merged.trees });
			setConflict(null);
			setNotice(
				`Refreshed revision ${latest.revision}. Your draft changes were retained; review them before saving.`,
			);
		}
	}

	const save = useMutation({
		mutationFn: () => {
			if (!draft) throw new Error("Read the knowledge catalogue before saving.");
			return saveKnowledgeTrees(client, connection, draft.base.revision, draft.trees);
		},
		onSuccess: (result) => {
			queryClient.setQueryData(queryKey, result.catalogue);
			setDraft({ base: result.catalogue, trees: result.catalogue.trees });
			setError(null);
			setConflict(null);
			setNotice(
				`Saved revision ${result.catalogue.revision}. Paths are registered configuration; this does not import or synchronize data.`,
			);
		},
		onError: async (failure) => {
			setError(errorText(failure));
			setNotice(null);
			try {
				const latest = await readKnowledgeTrees(client, connection);
				if (draft && latest.revision !== draft.base.revision) applyLatest(latest, draft);
			} catch {
				// Preserve the original save refusal and all local edits.
			}
		},
	});

	const refresh = useMutation({
		mutationFn: () => readKnowledgeTrees(client, connection),
		onSuccess: (latest) => {
			applyLatest(latest, draft);
			setError(null);
		},
		onError: (failure) => setError(errorText(failure)),
	});

	const busy = save.isPending || refresh.isPending;
	const paths = draft?.trees.flatMap((tree) => tree.paths) ?? [];
	const counts = {
		trees: draft?.trees.length ?? 0,
		paths: paths.length,
		native: paths.filter((path) => path.binding.kind === "native").length,
		external: paths.filter((path) => path.binding.kind === "external").length,
	};
	const hint = !draft
		? query.isError
			? "Retry loading your trees before editing."
			: "Loading your saved trees…"
		: save.isPending
			? "Saving your changes…"
			: refresh.isPending
				? "Checking for changes; your draft is kept."
				: conflict
					? "Resolve the changes below before saving. Your draft is kept."
					: dirty
						? "Your changes are in a draft. Save changes to apply them to RRFlow."
						: "No unsaved changes. Add a tree or edit a path to get started.";

	/** Stages one tree edit in the draft; the engine sees it only after `save`. */
	function stage(trees: RrdKnowledgeTreeView[]) {
		if (!draft) return;
		setDraft({ ...draft, trees });
		setNotice(null);
	}

	/** Validates a path edit and stages it. Returns whether it was staged. */
	function applyPath(tree: RrdKnowledgeTreeView, input: RrdKnowledgePathView): boolean {
		if (!draft) return false;
		try {
			const path = { ...input, name: input.name.trim() };
			if (!path.name) throw new Error("Give this path a name.");
			if (
				path.binding.kind === "native" &&
				(!path.binding.collection_id || !path.binding.vector_name)
			) {
				throw new Error("Choose an existing native collection and named vector.");
			}
			if (path.binding.kind === "external") {
				let url: URL;
				try {
					url = new URL(path.binding.endpoint.endpoint.url);
				} catch {
					throw new Error("Enter a valid credential-free endpoint URL.");
				}
				if (url.username || url.password || url.search || url.hash) {
					throw new Error(
						"Use an endpoint without credentials, query strings or fragments.",
					);
				}
			}
			setDraft({
				...draft,
				trees: putKnowledgeTree(draft.trees, putKnowledgePath(tree, path)),
			});
			setError(null);
			setNotice(null);
			setConflict(null);
			return true;
		} catch (failure) {
			setError(errorText(failure));
			return false;
		}
	}

	function applyTree(form: { id: string; name: string }) {
		if (!draft) return;
		const existing = draft.trees.find((tree) => tree.id === form.id);
		stage(
			putKnowledgeTree(draft.trees, {
				...form,
				name: form.name.trim(),
				paths: existing?.paths ?? [],
			}),
		);
	}

	function remove(removal: Removal) {
		if (!draft) return;
		stage(
			removal.path
				? putKnowledgeTree(draft.trees, removeKnowledgePath(removal.tree, removal.path.id))
				: draft.trees.filter((tree) => tree.id !== removal.tree.id),
		);
	}

	function discard() {
		if (!draft) return;
		setDraft({ ...draft, trees: draft.base.trees });
		setConflict(null);
		setError(null);
		setNotice(null);
	}

	/** Takes the newest saved version and merges the draft's conflicting fields back in. */
	function keepMine() {
		if (!conflict) return;
		setDraft({ base: conflict.latest, trees: conflict.merged });
		setConflict(null);
		setNotice(
			"Concurrent changes were merged. Your conflicting fields were kept in the draft; review before saving.",
		);
	}

	/** Takes the newest saved version and drops the draft. */
	function takeSaved() {
		if (!conflict) return;
		setDraft({ base: conflict.latest, trees: conflict.latest.trees });
		setConflict(null);
		setError(null);
	}

	return {
		unavailable,
		query,
		vectors,
		draft,
		dirty,
		busy,
		save,
		refresh,
		counts,
		hint,
		error,
		notice,
		conflict,
		stage,
		applyPath,
		applyTree,
		remove,
		discard,
		keepMine,
		takeSaved,
	};
}

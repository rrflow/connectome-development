import { Accordion, Alert, Box, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { knowledgeId } from "~/rrflow/knowledge";
import type { RrdKnowledgePathView } from "~/rrflow/session";
import type { RuntimeLensProps } from "../types";
import { errorText } from "./binding";
import { ConflictAlert } from "./conflict-alert";
import { type PathForm, PathModal } from "./path-modal";
import { StatusBar } from "./status-bar";
import { RemoveModal, type TreeForm, TreeModal } from "./tree-and-remove-modals";
import { TreeCard } from "./tree-card";
import { type Removal, useKnowledgeDraft } from "./use-knowledge-draft";

/**
 * Knowledge trees and paths: how a project organizes what it knows, and which
 * sources each part points at. Edits stay in a draft until saved; saving
 * registers references and never imports or synchronizes data.
 */
export function KnowledgeTab(props: RuntimeLensProps) {
	const knowledge = useKnowledgeDraft(props);
	const { unavailable, query, vectors, draft, dirty, busy, conflict } = knowledge;
	const [treeForm, setTreeForm] = useState<TreeForm | null>(null);
	const [pathForm, setPathForm] = useState<PathForm | null>(null);
	const [removal, setRemoval] = useState<Removal | null>(null);
	const locked = busy || Boolean(conflict);
	const editingTree = draft?.trees.find((tree) => tree.id === pathForm?.treeId);

	function editPath(change: Partial<RrdKnowledgePathView>) {
		setPathForm((current) =>
			current ? { ...current, path: { ...current.path, ...change } } : null,
		);
	}

	if (unavailable)
		return (
			<Alert
				color="blue"
				title="Knowledge trees unavailable for this connection"
			>
				<Stack gap="xs">
					<Text fz="sm">{unavailable}</Text>
					<Text fz="sm">
						Tree editing is unavailable for this connection. You can continue using its
						other available views.
					</Text>
				</Stack>
			</Alert>
		);

	return (
		<Stack gap="sm">
			<Box>
				<Text
					fz="lg"
					fw={650}
					c="bright"
				>
					Knowledge trees & paths
				</Text>
				<Text
					fz="sm"
					c="slate"
				>
					Organize knowledge by topic. Each path groups other paths or points to a data
					source.
				</Text>
			</Box>
			<StatusBar knowledge={knowledge} />
			{query.isError && (
				<Alert
					color="red"
					title="Your saved trees could not be loaded"
					role="alert"
				>
					{errorText(query.error)}{" "}
					<Button
						variant="subtle"
						onClick={() => query.refetch()}
					>
						Retry
					</Button>
				</Alert>
			)}
			{vectors.isError && (
				<Alert
					color="yellow"
					title="RRFlow vector sources could not be loaded"
					role="alert"
				>
					{errorText(vectors.error)}
					<Text fz="sm">
						You can still organize groups and external service settings.
					</Text>
					<Button
						variant="subtle"
						onClick={() => vectors.refetch()}
					>
						Retry vector sources
					</Button>
				</Alert>
			)}
			{conflict && (
				<ConflictAlert
					conflict={conflict}
					onKeepMine={knowledge.keepMine}
					onTakeSaved={knowledge.takeSaved}
				/>
			)}
			{draft && (
				<>
					<Group justify="space-between">
						<Text
							fz="sm"
							c="slate"
						>
							Changes take effect after you save.
						</Text>
						<Group gap="xs">
							<Button
								variant="subtle"
								disabled={!dirty || busy}
								onClick={knowledge.discard}
							>
								Discard draft
							</Button>
							<Button
								variant="light"
								disabled={locked}
								onClick={() => setTreeForm({ id: knowledgeId("tree"), name: "" })}
							>
								Add tree
							</Button>
						</Group>
					</Group>
					{draft.trees.length === 0 && (
						<Paper
							withBorder
							p="lg"
						>
							<Text c="slate">
								Start with a tree for a topic or project, then add groups or source
								paths. Saving organizes source references; it does not import
								documents or start sync.
							</Text>
						</Paper>
					)}
					{draft.trees.map((tree) => (
						<TreeCard
							key={tree.id}
							tree={tree}
							locked={locked}
							onAddPath={() =>
								setPathForm({
									treeId: tree.id,
									path: {
										id: knowledgeId("path"),
										name: "",
										parent_id: null,
										binding: { kind: "group" },
									},
								})
							}
							onRename={() => setTreeForm({ id: tree.id, name: tree.name })}
							onRemoveTree={() => setRemoval({ tree })}
							onEditPath={(path) =>
								setPathForm({ treeId: tree.id, path: structuredClone(path) })
							}
							onRemovePath={(path) => setRemoval({ tree, path })}
						/>
					))}
					<Accordion variant="separated">
						<Accordion.Item value="catalogue">
							<Accordion.Control>Project and saved revision</Accordion.Control>
							<Accordion.Panel>
								<Text
									fz="xs"
									c="slate"
									style={{ overflowWrap: "anywhere" }}
								>
									Project: {draft.base.project_id} · Scope: {draft.base.scope} ·
									Revision: {draft.base.revision}
								</Text>
							</Accordion.Panel>
						</Accordion.Item>
					</Accordion>
				</>
			)}
			<TreeModal
				form={treeForm}
				onChange={setTreeForm}
				onApply={knowledge.applyTree}
			/>
			<PathModal
				form={pathForm}
				tree={editingTree}
				vectors={vectors}
				error={knowledge.error}
				onEdit={editPath}
				onApply={() => {
					if (pathForm && editingTree && knowledge.applyPath(editingTree, pathForm.path))
						setPathForm(null);
				}}
				onClose={() => setPathForm(null)}
			/>
			<RemoveModal
				removal={removal}
				onClose={() => setRemoval(null)}
				onRemove={knowledge.remove}
			/>
		</Stack>
	);
}

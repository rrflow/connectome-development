import { Alert, Box, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { knowledgeUnplacedPaths } from "~/rrflow/knowledge";
import type { RrdKnowledgePathView, RrdKnowledgeTreeView } from "~/rrflow/session";
import { PathRows } from "./path-rows";

export interface TreeCardProps {
	tree: RrdKnowledgeTreeView;
	/** Edits are held while a save is in flight or a conflict is open. */
	locked: boolean;
	onAddPath: () => void;
	onRename: () => void;
	onRemoveTree: () => void;
	onEditPath: (path: RrdKnowledgePathView) => void;
	onRemovePath: (path: RrdKnowledgePathView) => void;
}

/** One tree: its paths nested under their groups, and any path left without a group. */
export function TreeCard({
	tree,
	locked,
	onAddPath,
	onRename,
	onRemoveTree,
	onEditPath,
	onRemovePath,
}: TreeCardProps) {
	const unplaced = knowledgeUnplacedPaths(tree);
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack gap="sm">
				<Group
					justify="space-between"
					align="flex-start"
				>
					<Box>
						<Text
							fw={650}
							fz="lg"
						>
							{tree.name}
						</Text>
						<Text
							fz="xs"
							c="slate"
						>
							{tree.paths.length} {tree.paths.length === 1 ? "path" : "paths"}
						</Text>
					</Box>
					<Group gap="xs">
						<Button
							variant="light"
							size="xs"
							disabled={locked}
							onClick={onAddPath}
						>
							Add path
						</Button>
						<Button
							variant="subtle"
							size="xs"
							disabled={locked}
							onClick={onRename}
						>
							Rename
						</Button>
						<Button
							variant="subtle"
							color="red"
							size="xs"
							disabled={locked}
							onClick={onRemoveTree}
						>
							Remove tree
						</Button>
					</Group>
				</Group>
				<PathRows
					tree={tree}
					parentId={null}
					disabled={locked}
					onEdit={onEditPath}
					onRemove={onRemovePath}
				/>
				{tree.paths.length === 0 && (
					<Text
						fz="sm"
						c="slate"
					>
						Add a path to organize a group or choose a data source.
					</Text>
				)}
				{unplaced.length > 0 && (
					<Alert
						color="yellow"
						title="Some paths need a new group"
					>
						<Stack gap="xs">
							<Text fz="sm">
								A group was removed or paths were placed inside one another. Your
								paths are kept below. Choose a new group or move them to the top of
								the tree before saving.
							</Text>
							{unplaced.map((path) => (
								<Group
									key={path.id}
									justify="space-between"
								>
									<Text fz="sm">{path.name}</Text>
									<Group gap="xs">
										<Button
											variant="subtle"
											size="xs"
											disabled={locked}
											onClick={() => onEditPath(path)}
										>
											Choose group
										</Button>
										<Button
											variant="subtle"
											color="red"
											size="xs"
											disabled={locked}
											onClick={() => onRemovePath(path)}
										>
											Remove
										</Button>
									</Group>
								</Group>
							))}
						</Stack>
					</Alert>
				)}
			</Stack>
		</Paper>
	);
}

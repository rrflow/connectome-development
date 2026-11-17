import { Box, Button, Group, Paper, Stack, Text } from "@mantine/core";
import type { RrdKnowledgePathView, RrdKnowledgeTreeView } from "~/rrflow/session";
import { providerNames } from "./binding";

function PathSummary({ path }: { path: RrdKnowledgePathView }) {
	if (path.binding.kind === "group")
		return (
			<Text
				fz="xs"
				c="slate"
			>
				Group · organizes other paths
			</Text>
		);
	if (path.binding.kind === "native")
		return (
			<Text
				fz="xs"
				c="slate"
				style={{ overflowWrap: "anywhere" }}
			>
				RRFlow vectors · {path.binding.collection_id} / {path.binding.vector_name} · source
				reference
			</Text>
		);
	return (
		<Text
			fz="xs"
			c="slate"
			style={{ overflowWrap: "anywhere" }}
		>
			{providerNames.get(path.binding.provider_id) ?? path.binding.provider_id} ·{" "}
			{[path.binding.namespace, path.binding.index, path.binding.collection]
				.filter(Boolean)
				.join(" / ")}{" "}
			· connection unverified
		</Text>
	);
}

export interface PathRowsProps {
	tree: RrdKnowledgeTreeView;
	parentId: string | null;
	disabled: boolean;
	depth?: number;
	onEdit: (path: RrdKnowledgePathView) => void;
	onRemove: (path: RrdKnowledgePathView) => void;
}

/** One tree's paths, nested under their groups, to a bounded depth. */
export function PathRows({ tree, parentId, disabled, onEdit, onRemove, depth = 0 }: PathRowsProps) {
	if (depth > 64) return null;
	return (
		<Stack gap="xs">
			{tree.paths
				.filter((path) => path.parent_id === parentId)
				.map((path) => (
					<Box
						key={path.id}
						ml={depth > 0 && depth < 4 ? "sm" : 0}
					>
						<Paper
							withBorder
							p="xs"
						>
							<Group
								justify="space-between"
								wrap="wrap"
								align="flex-start"
							>
								<Box
									miw={0}
									style={{ flex: "1 1 12rem", overflowWrap: "anywhere" }}
								>
									<Text fw={600}>{path.name}</Text>
									<PathSummary path={path} />
								</Box>
								<Group
									gap={4}
									wrap="nowrap"
								>
									<Button
										variant="subtle"
										size="xs"
										disabled={disabled}
										onClick={() => onEdit(path)}
									>
										Edit
									</Button>
									<Button
										variant="subtle"
										color="red"
										size="xs"
										disabled={disabled}
										onClick={() => onRemove(path)}
									>
										Remove
									</Button>
								</Group>
							</Group>
						</Paper>
						<Box mt="xs">
							<PathRows
								tree={tree}
								parentId={path.id}
								depth={depth + 1}
								disabled={disabled}
								onEdit={onEdit}
								onRemove={onRemove}
							/>
						</Box>
					</Box>
				))}
		</Stack>
	);
}

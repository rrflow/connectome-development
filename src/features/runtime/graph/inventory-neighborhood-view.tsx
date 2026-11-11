import {
	Alert,
	Badge,
	Button,
	Group,
	Paper,
	ScrollArea,
	Select,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { describeRrdError } from "~/rrflow/runtime";
import { isRetryable, type RrdSessionClient } from "~/rrflow/session";
import { GraphCanvas } from "./graph";
import {
	INVENTORY_LIMITS,
	inventoryCheckpoint,
	inventoryNeighborhood,
	inventoryRoot,
} from "./inventory-neighborhood";

/** Explore actual source-containment edges at one stored Inventory checkpoint. */
export function InventoryNeighborhood({
	client,
	sessionKey,
	connected,
}: {
	client: RrdSessionClient;
	sessionKey: string;
	connected: boolean;
}) {
	const [limit, setLimit] = useState("20");
	const [selection, setSelection] = useState<{
		sessionKey: string;
		checkpoint: string;
		cursor: string;
		id: string;
	} | null>(null);
	const checkpoint = useQuery({
		queryKey: ["rrd-inventory-checkpoint", sessionKey],
		enabled: connected,
		retry: (failures, error) => failures < 3 && isRetryable(error),
		retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
		queryFn: async () => {
			const value = await inventoryCheckpoint(client);
			return value ? { value, root: await inventoryRoot(client, value) } : null;
		},
	});
	const observed = connected && !checkpoint.isError ? checkpoint.data : null;
	const current = observed?.value;
	const selected =
		current &&
		selection?.sessionKey === sessionKey &&
		selection.checkpoint === current.digest &&
		selection.cursor === current.cursor
			? selection.id
			: observed?.root;
	const neighborhood = useQuery({
		queryKey: [
			"rrd-inventory-neighborhood",
			sessionKey,
			current?.digest,
			current?.cursor,
			selected,
			limit,
		],
		enabled: connected && Boolean(current && selected),
		retry: false,
		queryFn: () => {
			if (!current || !selected) throw new Error("No Inventory checkpoint selected");
			return inventoryNeighborhood(client, current, selected, Number(limit));
		},
	});
	const view = connected && !neighborhood.isError ? neighborhood.data : undefined;
	const groupOf = new Map(view?.nodes.map((node) => [node.id, "entries"]) ?? []);
	const groups = [
		{ id: "entries", label: "Source entries", palette: "teal", total: view?.nodes.length ?? 0 },
	];
	const select = (id: string | null) => {
		const node = view?.nodes.find((entry) => entry.id === id);
		if (node && current)
			setSelection({
				sessionKey,
				checkpoint: current.digest,
				cursor: current.cursor,
				id: node.key,
			});
	};
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack
				gap="sm"
				aria-label="Inventory neighborhood"
			>
				<Group
					justify="space-between"
					align="flex-start"
				>
					<div>
						<Title order={5}>Project inventory relationships</Title>
						<Text
							size="sm"
							c="dimmed"
						>
							One stored Inventory checkpoint, read through RRFlow. This is a
							historical view; it does not verify the current project or show parsed
							code.
						</Text>
					</div>
					<Button
						variant="light"
						size="xs"
						disabled={!connected}
						onClick={() => {
							void checkpoint.refetch();
						}}
					>
						Refresh checkpoint
					</Button>
				</Group>
				{!connected && (
					<Text size="sm">
						Connect a native session to inspect the project inventory.
					</Text>
				)}
				{connected && checkpoint.isError && (
					<Alert
						color="red"
						title="Inventory checkpoint unavailable"
					>
						{describeRrdError(checkpoint.error)}
					</Alert>
				)}
				{connected && checkpoint.isFetching && !observed && (
					<Text size="sm">Reading the stored project inventory…</Text>
				)}
				{connected &&
					!checkpoint.isFetching &&
					!checkpoint.isError &&
					checkpoint.data === null && (
						<Text size="sm">
							No completed Inventory checkpoint was found in the returned job page.
						</Text>
					)}
				{observed && current && (
					<>
						<Text size="sm">
							Job {current.jobId} · checkpoint {current.digest.slice(0, 12)}… · cursor{" "}
							{current.cursor} · valid time {current.validAt}
						</Text>
						{current.laterJobsNotScanned && (
							<Alert color="yellow">
								Additional job pages were not scanned. This view may not be the
								newest checkpoint.
							</Alert>
						)}
						<Group align="end">
							<Button
								variant="light"
								size="xs"
								disabled={selected === observed.root}
								onClick={() => setSelection(null)}
							>
								Project root
							</Button>
							<Select
								label="Maximum relationships"
								size="xs"
								w={170}
								value={limit}
								data={INVENTORY_LIMITS.map(String)}
								allowDeselect={false}
								onChange={(value) => {
									if (value && INVENTORY_LIMITS.map(String).includes(value))
										setLimit(value);
								}}
							/>
							{view && (
								<Badge variant="outline">
									{view.edges.length} returned · {view.keysExamined} traversal
									keys
								</Badge>
							)}
						</Group>
						{neighborhood.isError && (
							<Alert
								color="red"
								title="Inventory neighborhood unavailable"
							>
								{describeRrdError(neighborhood.error)}
							</Alert>
						)}
						{neighborhood.isFetching && !view && (
							<Text size="sm">Reading this neighborhood…</Text>
						)}
						{view && (
							<>
								<Text
									size="sm"
									c="dimmed"
								>
									Showing the selected entry and its returned outgoing containment
									relationships.{" "}
									{view.mayHaveMore
										? "The limit was reached or the engine truncated the result; more may exist."
										: "This is one neighborhood, not the complete project graph."}
								</Text>
								<GraphCanvas
									h={300}
									nodes={view.nodes.map(({ id, label }) => ({ id, label }))}
									edges={view.edges}
									directed
									groupOf={groupOf}
									groups={groups}
									legendTitle="Source records"
									selected={selected ? `source-tree-entry:${selected}` : null}
									dimUnselected={false}
									onSelect={select}
									hint="Choose a source entry to read its outgoing relationships"
									renderHover={(id) => (
										<Text size="sm">
											{view.nodes.find((node) => node.id === id)?.label ?? id}
										</Text>
									)}
								/>
								<details>
									<summary>Choose a source entry using the keyboard</summary>
									<ScrollArea.Autosize mah={180}>
										<Stack gap={2}>
											{view.nodes.map((node) => (
												<Button
													key={node.id}
													variant="subtle"
													size="compact-sm"
													justify="flex-start"
													onClick={() => select(node.id)}
												>
													{node.label}
												</Button>
											))}
										</Stack>
									</ScrollArea.Autosize>
								</details>
							</>
						)}
					</>
				)}
			</Stack>
		</Paper>
	);
}

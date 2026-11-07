import {
	Alert,
	Badge,
	Box,
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
import { useMemo, useState } from "react";
import { describeRrdError } from "~/rrflow/runtime";
import type { RrdPromptFlightDetailView, RrdSessionClient } from "~/rrflow/session";
import { formatCount, formatTime } from "./format";
import { GraphCanvas } from "./graph";
import { grouping } from "./groups";
import { StoragePipeline } from "./pipeline";
import { databaseQuery } from "./queries";
import classes from "./style.module.scss";

/** The preview is bounded independently of the full graph lens. */
const PREVIEW_LIMITS = ["20", "40", "80"];
const MAX_PREVIEW_RELATIONS = 200;

export function ProjectVisuals({
	client,
	sessionKey,
	connected,
	onOpenGraph,
	onOpenStorage,
	onSelectRecord,
}: {
	client: RrdSessionClient;
	sessionKey: string;
	connected: boolean;
	onOpenGraph: () => void;
	onOpenStorage: () => void;
	onSelectRecord: (record: string) => void;
}) {
	const [limit, setLimit] = useState("40");
	const database = useQuery({ ...databaseQuery(client, sessionKey), enabled: connected });
	const storage = useQuery({
		queryKey: ["rrd-storage", sessionKey],
		queryFn: () => client.storage(),
		enabled: connected,
		retry: false,
	});
	const preview = useMemo(() => {
		const graph = database.data?.graph;
		if (!graph) return null;
		const nodes = graph.nodes.slice(0, Number(limit));
		const ids = new Set(nodes.map((node) => node.id));
		const eligible = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
		const edges = eligible.slice(0, MAX_PREVIEW_RELATIONS);
		const shown = { ...graph, nodes, edges };
		return {
			graph,
			nodes,
			edges,
			canvasNodes: nodes.map((node) => ({ id: node.id, label: node.label })),
			canvasEdges: edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to })),
			eligible: eligible.length,
			groups: grouping(shown, "kind"),
		};
	}, [database.data, limit]);

	return (
		<Stack
			gap="md"
			aria-label="Project visualizations"
		>
			<Group
				justify="space-between"
				align="flex-start"
			>
				<Box>
					<Title order={4}>Project visualizations</Title>
					<Text
						size="sm"
						c="dimmed"
					>
						Graph and storage are separate engine reads, not one atomic snapshot.
					</Text>
				</Box>
				<Button
					variant="light"
					disabled={!connected}
					onClick={() => {
						void database.refetch();
						void storage.refetch();
					}}
				>
					Refresh visualizations
				</Button>
			</Group>
			{!connected ? (
				<Alert title="Connect a native session">
					Open a session to read this project's graph and storage.
				</Alert>
			) : (
				<>
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
									<Title order={5}>Documents and relationships</Title>
									<Text
										size="sm"
										c="dimmed"
									>
										A bounded preview of records and edges returned by the
										engine. Positions are a display layout.
									</Text>
								</Box>
								<Button
									variant="light"
									size="xs"
									onClick={onOpenGraph}
								>
									Open full graph
								</Button>
							</Group>
							{database.isError && (
								<Alert
									color="red"
									title="Graph read failed"
								>
									{describeRrdError(database.error)}
								</Alert>
							)}
							{!preview ? (
								<Text size="sm">
									{database.isFetching
										? "Reading project graph…"
										: "No graph observation is available."}
								</Text>
							) : (
								<>
									<Group
										justify="space-between"
										align="end"
									>
										<Text size="sm">
											Showing {formatCount(preview.nodes.length)} of{" "}
											{formatCount(preview.graph.nodes.length)} returned
											records and {formatCount(preview.edges.length)} of{" "}
											{formatCount(preview.graph.edges.length)} returned
											relationships · graph cursor{" "}
											{formatCount(preview.graph.known_at_cursor)} · read{" "}
											{formatTime(database.data?.observed_at_unix_ms)}
										</Text>
										<Select
											label="Preview record limit"
											size="xs"
											w={135}
											value={limit}
											data={PREVIEW_LIMITS}
											allowDeselect={false}
											onChange={(value) => {
												if (value && PREVIEW_LIMITS.includes(value))
													setLimit(value);
											}}
										/>
									</Group>
									{preview.eligible > preview.edges.length && (
										<Text
											size="xs"
											c="dimmed"
										>
											The preview also limits displayed relationships; use the
											full graph for more.
										</Text>
									)}
									{preview.nodes.length === 0 ? (
										<Text size="sm">
											The engine returned no records for this graph view.
										</Text>
									) : (
										<>
											<GraphCanvas
												h={300}
												nodes={preview.canvasNodes}
												edges={preview.canvasEdges}
												directed
												groupOf={preview.groups.groupOf}
												groups={preview.groups.groups}
												legendTitle="Record kind"
												selected={null}
												dimUnselected={false}
												onSelect={(id) => {
													if (id) onSelectRecord(id);
												}}
												hint="Click a record to inspect it in the graph lens"
												renderHover={(id) => {
													const node = preview.nodes.find(
														(item) => item.id === id,
													);
													return node ? (
														<Text size="sm">
															{node.label} · {node.id}
														</Text>
													) : null;
												}}
											/>
											<details>
												<summary>
													Choose a record using the keyboard
												</summary>
												<ScrollArea.Autosize mah={180}>
													<Stack gap={2}>
														{preview.nodes.map((node) => (
															<Button
																key={node.id}
																variant="subtle"
																size="compact-sm"
																justify="flex-start"
																onClick={() =>
																	onSelectRecord(node.id)
																}
															>
																{node.label} · {node.id}
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
									<Title order={5}>
										{storage.data?.physical.profile === "rrflow_kv"
											? "rrflowKV storage path"
											: "Storage path"}
									</Title>
									<Text
										size="sm"
										c="dimmed"
									>
										Process-local measurements, independent of the graph cursor.
									</Text>
								</Box>
								<Button
									variant="light"
									size="xs"
									onClick={onOpenStorage}
								>
									Open storage details
								</Button>
							</Group>
							{storage.isError && (
								<Alert
									color="red"
									title="Storage read failed"
								>
									{describeRrdError(storage.error)}
								</Alert>
							)}
							{storage.data ? (
								<>
									<Text size="sm">
										Observed{" "}
										{formatTime(storage.data.physical.observed_at_unix_ms)} ·{" "}
										{storage.data.physical.evidence_level}
									</Text>
									<ScrollArea>
										<Box miw={720}>
											<StoragePipeline view={storage.data.physical} />
										</Box>
									</ScrollArea>
								</>
							) : (
								<Text size="sm">
									{storage.isFetching
										? "Reading storage observation…"
										: "No storage observation is available."}
								</Text>
							)}
						</Stack>
					</Paper>
				</>
			)}
		</Stack>
	);
}

/** Events are ordered by the engine; connecting lines do not assert network hops. */
export function FlightEventMap({ flight }: { flight: RrdPromptFlightDetailView }) {
	return (
		<Box>
			<Group gap="xs">
				<Title order={5}>Recorded event flow</Title>
				<Badge variant="outline">
					{flight.events.length} returned / {flight.event_count} recorded
				</Badge>
			</Group>
			<Text
				size="sm"
				c="dimmed"
			>
				The sequence shows returned event order, not inferred MCP hops or model decisions.
			</Text>
			{flight.events.length === 0 ? (
				<Text size="sm">No events were returned for this flight.</Text>
			) : (
				<ol
					className={classes.eventFlow}
					aria-label="Recorded flight event sequence"
				>
					{flight.events.map((event) => (
						<li key={event.ordinal}>
							<Paper
								withBorder
								p="sm"
								h="100%"
							>
								<Text
									size="xs"
									c="dimmed"
								>
									{event.ordinal} · {event.elapsed_ms} ms elapsed
								</Text>
								<Text fw={700}>{event.stage}</Text>
								<Text size="sm">{event.label}</Text>
								<Text
									size="xs"
									c="dimmed"
								>
									{event.detail}
								</Text>
							</Paper>
						</li>
					))}
				</ol>
			)}
		</Box>
	);
}

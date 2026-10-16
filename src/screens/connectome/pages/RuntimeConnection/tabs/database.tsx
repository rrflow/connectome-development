import {
	Alert,
	Badge,
	Box,
	Button,
	Grid,
	Group,
	Loader,
	MultiSelect,
	Paper,
	ScrollArea,
	SegmentedControl,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
	Textarea,
} from "@mantine/core";
import {
	Icon,
	iconErrorCircle,
	iconQuery,
	iconRefresh,
	iconRelation,
	iconSearch,
} from "@rrflow/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Label } from "~/components/Label";
import { Section } from "~/components/Section";
import type { RrdDatabaseView, RrdNodeView } from "~/rrflow/session";
import { formatCount, formatSize, formatTime } from "../format";
import { RecordGraph } from "../graph";
import { Stat } from "../stat";
import { type GraphDirection, type GraphScope, kinds, selectSubgraph } from "../subgraph";
import type { RuntimeLensProps } from "../types";

/** Default row bound for console queries; the estate's query budget still applies. */
const CONSOLE_ROW_LIMIT = 50;
const TRAVERSAL_DEPTH = 2;
const NEIGHBOURHOOD_DEPTHS = ["1", "2", "3"];
/** Widest console cell before truncation; the full value shows on hover. */
const CONSOLE_CELL_WIDTH = 320;

function recordTables(view: RrdDatabaseView) {
	return view.tables.filter((table) => table.model === "relational");
}

function relationTables(view: RrdDatabaseView) {
	return view.tables.filter((table) => table.model === "graph_relation");
}

function defaultQuery(view: RrdDatabaseView): string {
	const table = recordTables(view)[0]?.name ?? view.graph.nodes[0]?.kind;
	return table
		? `FROM record:${table} AT VALID ${Date.now()} KNOWN HEAD PROJECT * LIMIT ${CONSOLE_ROW_LIMIT}`
		: "";
}

function recordQuery(node: RrdNodeView): string {
	return `FROM record:${node.kind} AT VALID ${Date.now()} KNOWN HEAD WHERE id = "${node.key}" PROJECT *`;
}

function traversalQuery(node: RrdNodeView, relation: string): string {
	return `FROM traverse:${relation} START ${node.kind}:${node.key} DIRECTION OUTGOING DEPTH ${TRAVERSAL_DEPTH} AT VALID ${Date.now()} KNOWN HEAD PROJECT node_id, depth, path`;
}

export function DatabaseTab({ client, sessionKey }: RuntimeLensProps) {
	const database = useQuery({
		queryKey: ["rrd-database", sessionKey],
		queryFn: () => client.database(),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [selected, setSelected] = useState<string | null>(null);
	const [scope, setScope] = useState<GraphScope>("estate");
	const [depth, setDepth] = useState(1);
	const [direction, setDirection] = useState<GraphDirection>("both");
	const [recordKinds, setRecordKinds] = useState<string[]>([]);
	const [relationKinds, setRelationKinds] = useState<string[]>([]);
	const [draft, setDraft] = useState<string | null>(null);
	const execution = useMutation({
		mutationFn: (query: string) => client.query(query),
	});

	const view = database.data;
	const node = useMemo(
		() => view?.graph.nodes.find((candidate) => candidate.id === selected) ?? null,
		[view, selected],
	);
	const degree = useMemo(() => {
		if (!view || !selected) return { outgoing: 0, incoming: 0 };
		return {
			outgoing: view.graph.edges.filter((edge) => edge.from === selected).length,
			incoming: view.graph.edges.filter((edge) => edge.to === selected).length,
		};
	}, [view, selected]);
	const query = draft ?? (view ? defaultQuery(view) : "");
	const allRecordKinds = useMemo(() => (view ? kinds(view.graph.nodes) : []), [view]);
	const allRelationKinds = useMemo(() => (view ? kinds(view.graph.edges) : []), [view]);
	const drawn = useMemo(
		() =>
			view
				? selectSubgraph(view.graph, {
						scope,
						focus: selected,
						depth,
						direction,
						recordKinds,
						relationKinds,
					})
				: null,
		[view, scope, selected, depth, direction, recordKinds, relationKinds],
	);
	const recordOptions = useMemo(
		() =>
			view?.graph.nodes.map((candidate) => ({
				value: candidate.id,
				label:
					candidate.label === candidate.key
						? candidate.id
						: `${candidate.label} — ${candidate.id}`,
			})) ?? [],
		[view],
	);

	if (database.isPending) {
		return (
			<Group justify="center">
				<Loader />
			</Group>
		);
	}

	if (database.isError || !view) {
		return (
			<Alert
				color="red"
				title="Database read failed"
				icon={<Icon path={iconErrorCircle} />}
			>
				{database.error instanceof Error ? database.error.message : "Unknown RRD error"}
			</Alert>
		);
	}

	const relations = relationTables(view);

	return (
		<Stack gap="xl">
			<Section
				title="Instance database"
				description={`Schema registry, records, and relations at runtime cursor ${formatCount(view.runtime_cursor)}, observed ${formatTime(view.observed_at_unix_ms)}`}
				rightSection={
					<Button
						variant="light"
						size="xs"
						leftSection={<Icon path={iconRefresh} />}
						loading={database.isFetching}
						onClick={() => database.refetch()}
					>
						Refresh
					</Button>
				}
			>
				<SimpleGrid cols={{ base: 2, md: 5 }}>
					<Stat
						label="Schema revision"
						value={formatCount(view.schema_revision)}
					/>
					<Stat
						label="Tables"
						value={formatCount(view.tables.length)}
					/>
					<Stat
						label="Records"
						value={formatCount(view.graph.nodes.length)}
					/>
					<Stat
						label="Relations"
						value={formatCount(view.graph.edges.length)}
					/>
					<Stat
						label="Graph cursor"
						value={formatCount(view.graph.known_at_cursor)}
					/>
				</SimpleGrid>

				<Select
					mt="md"
					searchable
					clearable
					limit={50}
					placeholder="Find a record by title or identity"
					nothingFoundMessage="No record matches"
					leftSection={<Icon path={iconSearch} />}
					data={recordOptions}
					value={selected}
					onChange={setSelected}
				/>

				<Group
					mt="md"
					gap="sm"
					align="flex-end"
				>
					<SegmentedControl
						value={scope}
						onChange={(value) => setScope(value as GraphScope)}
						data={[
							{ value: "estate", label: "Estate graph" },
							{ value: "neighbourhood", label: "Record neighbourhood" },
						]}
					/>
					{scope === "neighbourhood" && (
						<>
							<SegmentedControl
								value={String(depth)}
								onChange={(value) => setDepth(Number(value))}
								data={NEIGHBOURHOOD_DEPTHS.map((value) => ({
									value,
									label: `${value} hop${value === "1" ? "" : "s"}`,
								}))}
							/>
							<SegmentedControl
								value={direction}
								onChange={(value) => setDirection(value as GraphDirection)}
								data={[
									{ value: "both", label: "Both" },
									{ value: "outgoing", label: "Outgoing" },
									{ value: "incoming", label: "Incoming" },
								]}
							/>
						</>
					)}
					<MultiSelect
						flex={1}
						miw={180}
						clearable
						placeholder={recordKinds.length ? undefined : "All record kinds"}
						data={allRecordKinds}
						value={recordKinds}
						onChange={setRecordKinds}
					/>
					<MultiSelect
						flex={1}
						miw={180}
						clearable
						placeholder={relationKinds.length ? undefined : "All relation kinds"}
						data={allRelationKinds}
						value={relationKinds}
						onChange={setRelationKinds}
					/>
				</Group>
				<Text
					fz="xs"
					c="slate"
					mt={6}
				>
					Drawing {formatCount(drawn?.nodes.length)} of{" "}
					{formatCount(view.graph.nodes.length)} records and{" "}
					{formatCount(drawn?.edges.length)} of {formatCount(view.graph.edges.length)}{" "}
					relations
					{scope === "neighbourhood" && node ? ` around ${node.label}` : ""}.
				</Text>

				<Grid mt="xs">
					<Grid.Col span={{ base: 12, lg: 8 }}>
						<Paper
							h={560}
							style={{ overflow: "hidden" }}
						>
							{view.graph.nodes.length === 0 ? (
								<Group
									h="100%"
									justify="center"
								>
									<Text c="slate">This instance holds no records yet.</Text>
								</Group>
							) : scope === "neighbourhood" && !node ? (
								<Group
									h="100%"
									justify="center"
								>
									<Text c="slate">
										Find or click a record to draw its neighbourhood.
									</Text>
								</Group>
							) : drawn && drawn.nodes.length > 0 ? (
								<RecordGraph
									h="100%"
									graph={drawn}
									kinds={allRecordKinds}
									selected={selected}
									onSelect={setSelected}
								/>
							) : (
								<Group
									h="100%"
									justify="center"
								>
									<Text c="slate">No record matches the selected kinds.</Text>
								</Group>
							)}
						</Paper>
					</Grid.Col>
					<Grid.Col span={{ base: 12, lg: 4 }}>
						<Paper
							p="md"
							h={560}
						>
							{node ? (
								<Stack
									h="100%"
									gap="sm"
								>
									<Box>
										<Label>Selected record</Label>
										<Text
											fw={700}
											c="bright"
										>
											{node.label}
										</Text>
										<Text
											ff="monospace"
											fz="sm"
										>
											{node.id}
										</Text>
									</Box>
									<Group gap="xs">
										<Badge variant="light">{degree.outgoing} outgoing</Badge>
										<Badge variant="light">{degree.incoming} incoming</Badge>
										<Badge variant="outline">
											valid from {formatCount(node.valid_from_unix_ms)}
										</Badge>
									</Group>
									<ScrollArea flex={1}>
										<Table fz="sm">
											<Table.Tbody>
												{Object.entries(node.properties).map(
													([name, value]) => (
														<Table.Tr key={name}>
															<Table.Td
																ff="monospace"
																c="slate"
																w="35%"
															>
																{name}
															</Table.Td>
															<Table.Td
																style={{ wordBreak: "break-word" }}
															>
																{value}
															</Table.Td>
														</Table.Tr>
													),
												)}
											</Table.Tbody>
										</Table>
									</ScrollArea>
									<Group gap="xs">
										{scope === "estate" && (
											<Button
												size="xs"
												variant="light"
												leftSection={<Icon path={iconRelation} />}
												onClick={() => setScope("neighbourhood")}
											>
												Open neighbourhood
											</Button>
										)}
										<Button
											size="xs"
											variant="light"
											leftSection={<Icon path={iconQuery} />}
											onClick={() => {
												const text = recordQuery(node);
												setDraft(text);
												execution.mutate(text);
											}}
										>
											Query record
										</Button>
										{relations.map((relation) => (
											<Button
												key={relation.name}
												size="xs"
												variant="light"
												leftSection={<Icon path={iconRelation} />}
												onClick={() => {
													const text = traversalQuery(
														node,
														relation.name,
													);
													setDraft(text);
													execution.mutate(text);
												}}
											>
												Traverse {relation.name}
											</Button>
										))}
									</Group>
								</Stack>
							) : (
								<Stack gap="sm">
									<Label>Schema registry</Label>
									<Table fz="sm">
										<Table.Thead>
											<Table.Tr>
												<Table.Th>Table</Table.Th>
												<Table.Th>Model</Table.Th>
												<Table.Th>Mode</Table.Th>
											</Table.Tr>
										</Table.Thead>
										<Table.Tbody>
											{view.tables.map((table) => (
												<Table.Tr key={table.name}>
													<Table.Td ff="monospace">{table.name}</Table.Td>
													<Table.Td>{table.model}</Table.Td>
													<Table.Td>{table.mode}</Table.Td>
												</Table.Tr>
											))}
										</Table.Tbody>
									</Table>
									<Text
										fz="sm"
										c="slate"
									>
										Select a record in the graph to inspect its properties and
										relations.
									</Text>
								</Stack>
							)}
						</Paper>
					</Grid.Col>
				</Grid>
			</Section>

			<Section
				title="RRFlowQL console"
				description="Read-only queries execute through the native session under the estate's configured query budget."
			>
				<Stack gap="sm">
					<Textarea
						ff="monospace"
						autosize
						minRows={2}
						value={query}
						onChange={(event) => setDraft(event.currentTarget.value)}
						onKeyDown={(event) => {
							if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
								execution.mutate(query);
							}
						}}
					/>
					<Group justify="space-between">
						<Text
							fz="xs"
							c="slate"
						>
							Ctrl/⌘ + Enter runs the query.
						</Text>
						<Button
							size="xs"
							leftSection={<Icon path={iconQuery} />}
							loading={execution.isPending}
							disabled={!query.trim()}
							onClick={() => execution.mutate(query)}
						>
							Run query
						</Button>
					</Group>
					{execution.isError && (
						<Alert
							color="red"
							title="Query rejected"
							icon={<Icon path={iconErrorCircle} />}
						>
							{execution.error instanceof Error
								? execution.error.message
								: "Unknown RRD error"}
						</Alert>
					)}
					{execution.data && (
						<Paper p="md">
							<Group
								gap="xs"
								mb="sm"
							>
								<Badge variant="light">
									{formatCount(execution.data.returned_rows)} rows
								</Badge>
								<Badge variant="light">
									{formatCount(execution.data.keys_examined)} keys examined
								</Badge>
								<Badge variant="light">
									{formatSize(execution.data.output_bytes)} output
								</Badge>
								<Badge variant="outline">
									cursor {formatCount(execution.data.known_at_cursor)}
								</Badge>
								{execution.data.truncated && (
									<Badge color="orange">truncated</Badge>
								)}
							</Group>
							<Text
								ff="monospace"
								fz="xs"
								c="slate"
								mb="sm"
							>
								{execution.data.canonical_query}
							</Text>
							<ScrollArea.Autosize
								mah={480}
								type="auto"
							>
								<Table
									fz="sm"
									striped
									stickyHeader
									style={{ whiteSpace: "nowrap" }}
								>
									<Table.Thead>
										<Table.Tr>
											<Table.Th>identity</Table.Th>
											{execution.data.columns.map((column) => (
												<Table.Th key={column}>{column}</Table.Th>
											))}
										</Table.Tr>
									</Table.Thead>
									<Table.Tbody>
										{execution.data.rows.map((row) => (
											<Table.Tr key={row.identity}>
												<Table.Td
													ff="monospace"
													maw={CONSOLE_CELL_WIDTH}
													title={row.identity}
													style={{
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{row.identity}
												</Table.Td>
												{execution.data.columns.map((column) => (
													<Table.Td
														key={column}
														maw={CONSOLE_CELL_WIDTH}
														title={row.values[column]}
														style={{
															overflow: "hidden",
															textOverflow: "ellipsis",
														}}
													>
														{row.values[column] ?? ""}
													</Table.Td>
												))}
											</Table.Tr>
										))}
									</Table.Tbody>
								</Table>
							</ScrollArea.Autosize>
						</Paper>
					)}
				</Stack>
			</Section>
		</Stack>
	);
}

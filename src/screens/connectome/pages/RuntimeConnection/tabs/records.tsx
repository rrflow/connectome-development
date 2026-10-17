import {
	Alert,
	Badge,
	Box,
	Button,
	Collapse,
	Divider,
	Grid,
	Group,
	Loader,
	MultiSelect,
	Paper,
	Popover,
	ScrollArea,
	SegmentedControl,
	Select,
	Stack,
	Table,
	Text,
	Textarea,
	UnstyledButton,
} from "@mantine/core";
import {
	Icon,
	iconChevronDown,
	iconChevronUp,
	iconErrorCircle,
	iconFilter,
	iconQuery,
	iconRefresh,
	iconRelation,
	iconSearch,
	iconTarget,
} from "@rrflow/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Label } from "~/components/Label";
import { Section } from "~/components/Section";
import type { RrdEdgeView, RrdNodeView } from "~/rrflow/session";
import { plural } from "~/shared/util/helpers";
import { formatCount, formatSize, formatTime } from "../format";
import { Term } from "../glossary";
import { type CanvasEdge, type CanvasNode, GraphCanvas } from "../graph";
import { colorOptions, degrees, grouping } from "../groups";
import { ReadNotice } from "../notice";
import { databaseQuery } from "../queries";
import classes from "../style.module.scss";
import { type GraphDirection, type GraphScope, kinds, selectSubgraph } from "../subgraph";
import type { RecordFocusProps, RuntimeLensProps } from "../types";

/** Default row bound for console queries; the estate's query budget still applies. */
const CONSOLE_ROW_LIMIT = 50;
const TRAVERSAL_DEPTH = 2;
const NEIGHBOURHOOD_DEPTHS = ["1", "2", "3"];
/** Widest console cell before truncation; the full value shows on hover. */
const CONSOLE_CELL_WIDTH = 320;
/** Most-linked records offered as starting points. */
const START_HERE_RECORDS = 8;
/** Linked records listed per direction before the list says how many remain. */
const MAX_LINKED_LISTED = 50;
const CANVAS_HEIGHT = 620;

function recordQuery(node: RrdNodeView): string {
	return `FROM record:${node.kind} AT VALID ${Date.now()} KNOWN HEAD WHERE id = "${node.key}" PROJECT *`;
}

function traversalQuery(node: RrdNodeView, relation: string): string {
	return `FROM traverse:${relation} START ${node.kind}:${node.key} DIRECTION OUTGOING DEPTH ${TRAVERSAL_DEPTH} AT VALID ${Date.now()} KNOWN HEAD PROJECT node_id, depth, path`;
}

function defaultQuery(tables: string[], fallbackKind: string | undefined): string {
	const table = tables[0] ?? fallbackKind;
	return table
		? `FROM record:${table} AT VALID ${Date.now()} KNOWN HEAD PROJECT * LIMIT ${CONSOLE_ROW_LIMIT}`
		: "";
}

interface LinkedRecord {
	relation: RrdEdgeView;
	record: RrdNodeView;
}

interface LinkedListProps {
	title: string;
	links: LinkedRecord[];
	showRelationKind: boolean;
	colorOf: (record: string) => string;
	onSelect: (record: string) => void;
}

function LinkedList({ title, links, showRelationKind, colorOf, onSelect }: LinkedListProps) {
	return (
		<Box>
			<Label>
				{title} ({formatCount(links.length)})
			</Label>
			{links.length === 0 ? (
				<Text
					fz="sm"
					c="slate"
				>
					None.
				</Text>
			) : (
				<Stack gap={2}>
					{links.slice(0, MAX_LINKED_LISTED).map(({ relation, record }) => (
						<RecordRow
							key={relation.id}
							record={record}
							color={colorOf(record.id)}
							detail={showRelationKind ? relation.kind : undefined}
							onSelect={onSelect}
						/>
					))}
					{links.length > MAX_LINKED_LISTED && (
						<Text
							fz="xs"
							c="slate"
						>
							and {formatCount(links.length - MAX_LINKED_LISTED)} more — open the
							neighbourhood to see them all.
						</Text>
					)}
				</Stack>
			)}
		</Box>
	);
}

interface RecordRowProps {
	record: RrdNodeView;
	color: string;
	detail?: string;
	onSelect: (record: string) => void;
}

export function RecordRow({ record, color, detail, onSelect }: RecordRowProps) {
	return (
		<UnstyledButton
			px={6}
			py={4}
			onClick={() => onSelect(record.id)}
			className={classes.row}
		>
			<Group
				gap={8}
				wrap="nowrap"
			>
				<Box
					w={9}
					h={9}
					bg={color}
					style={{ borderRadius: "50%", flexShrink: 0 }}
				/>
				<Text
					fz="sm"
					truncate
					title={record.label}
				>
					{record.label}
				</Text>
				{detail && (
					<Text
						fz="xs"
						c="slate"
						ml="auto"
						style={{ flexShrink: 0 }}
					>
						{detail}
					</Text>
				)}
			</Group>
		</UnstyledButton>
	);
}

export function RecordsTab({
	client,
	sessionKey,
	selected,
	onSelect,
	colorBy,
	onColorBy,
	onOpenLens,
}: RuntimeLensProps & RecordFocusProps) {
	const database = useQuery(databaseQuery(client, sessionKey));
	const [scope, setScope] = useState<GraphScope>("estate");
	const [depth, setDepth] = useState(1);
	const [direction, setDirection] = useState<GraphDirection>("both");
	const [recordKinds, setRecordKinds] = useState<string[]>([]);
	const [relationKinds, setRelationKinds] = useState<string[]>([]);
	const [consoleOpen, setConsoleOpen] = useState(false);
	const [schemaOpen, setSchemaOpen] = useState(false);
	const [draft, setDraft] = useState<string | null>(null);
	const consoleRef = useRef<HTMLDivElement>(null);
	const execution = useMutation({
		mutationFn: (query: string) => client.query(query),
	});

	const view = database.data;
	const graph = view?.graph;
	const options = useMemo(() => (graph ? colorOptions(graph) : []), [graph]);
	const colorOption = options.find((option) => option.value === colorBy) ?? options[0];
	const groups = useMemo(
		() => (graph && colorOption ? grouping(graph, colorOption.value) : null),
		[graph, colorOption],
	);
	const byId = useMemo(() => new Map(graph?.nodes.map((node) => [node.id, node]) ?? []), [graph]);
	const degree = useMemo(() => (graph ? degrees(graph) : new Map<string, number>()), [graph]);
	const node = selected ? (byId.get(selected) ?? null) : null;
	const allRecordKinds = useMemo(() => (graph ? kinds(graph.nodes) : []), [graph]);
	const allRelationKinds = useMemo(() => (graph ? kinds(graph.edges) : []), [graph]);
	const focus = scope === "neighbourhood" ? selected : null;
	const drawn = useMemo(
		() =>
			graph
				? selectSubgraph(graph, {
						scope,
						focus,
						depth,
						direction,
						recordKinds,
						relationKinds,
					})
				: null,
		[graph, scope, focus, depth, direction, recordKinds, relationKinds],
	);
	const canvasNodes = useMemo<CanvasNode[]>(
		() => drawn?.nodes.map((record) => ({ id: record.id, label: record.label })) ?? [],
		[drawn],
	);
	const canvasEdges = useMemo<CanvasEdge[]>(
		() =>
			drawn?.edges.map((relation) => ({
				id: relation.id,
				from: relation.from,
				to: relation.to,
			})) ?? [],
		[drawn],
	);
	const linked = useMemo(() => {
		const outgoing: LinkedRecord[] = [];
		const incoming: LinkedRecord[] = [];
		if (graph && selected) {
			for (const relation of graph.edges) {
				const to = byId.get(relation.to);
				const from = byId.get(relation.from);
				if (relation.from === selected && to) outgoing.push({ relation, record: to });
				if (relation.to === selected && from) incoming.push({ relation, record: from });
			}
		}
		return { outgoing, incoming };
	}, [graph, byId, selected]);
	const startHere = useMemo(
		() =>
			graph
				? [...graph.nodes]
						.sort(
							(a, b) =>
								(degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
								a.label.localeCompare(b.label),
						)
						.slice(0, START_HERE_RECORDS)
				: [],
		[graph, degree],
	);
	const recordOptions = useMemo(
		() =>
			graph?.nodes.map((candidate) => ({
				value: candidate.id,
				label:
					candidate.label === candidate.key
						? candidate.id
						: `${candidate.label} — ${candidate.id}`,
			})) ?? [],
		[graph],
	);

	if (database.isPending) {
		return (
			<Stack align="center">
				<Loader />
				<ReadNotice query={database} />
			</Stack>
		);
	}

	if (!view || !graph || !groups) {
		return (
			<Alert
				color="red"
				title="The estate could not be read"
				icon={<Icon path={iconErrorCircle} />}
			>
				{database.error instanceof Error ? database.error.message : "Unknown RRD error"}
			</Alert>
		);
	}

	const tables = view.tables.filter((table) => table.model === "relational").map((t) => t.name);
	const relations = view.tables.filter((table) => table.model === "graph_relation");
	const query = draft ?? defaultQuery(tables, graph.nodes[0]?.kind);
	const groupLabel = (record: string) =>
		groups.groups.find((group) => group.id === groups.groupOf.get(record))?.label;
	const palette = new Map(groups.groups.map((group) => [group.id, group.palette]));
	const colorOf = (record: string) => {
		const name = palette.get(groups.groupOf.get(record) ?? "");
		return name ? `var(--mantine-color-${name}-6)` : "var(--mantine-color-obsidian-4)";
	};
	const filters = recordKinds.length + relationKinds.length;
	const runQuery = (text: string) => {
		setDraft(text);
		setConsoleOpen(true);
		execution.mutate(text);
		requestAnimationFrame(() =>
			consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
		);
	};

	return (
		<Stack gap="xl">
			<Section
				title="Records & relations"
				description={
					<>
						This <Term id="estate">estate</Term> holds {formatCount(graph.nodes.length)}{" "}
						<Term id="record">records</Term> linked by {formatCount(graph.edges.length)}{" "}
						<Term id="relation">relations</Term>. Each dot is a record and each arrow a
						relation; bigger dots have more relations.
					</>
				}
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
				<ReadNotice
					query={database}
					observedAt={view.observed_at_unix_ms}
				/>
				<Group
					gap="sm"
					align="flex-end"
				>
					<Select
						w={340}
						searchable
						clearable
						limit={50}
						label="Find a record"
						placeholder="Type a title or identity"
						nothingFoundMessage="No record matches"
						leftSection={<Icon path={iconSearch} />}
						data={recordOptions}
						value={selected}
						onChange={onSelect}
					/>
					<Stack gap={4}>
						<Label mb={0}>Show</Label>
						<SegmentedControl
							value={scope}
							onChange={(value) => setScope(value as GraphScope)}
							data={[
								{ value: "estate", label: "Whole estate" },
								{ value: "neighbourhood", label: "Around the selection" },
							]}
						/>
					</Stack>
					{scope === "neighbourhood" && (
						<>
							<Stack gap={4}>
								<Label mb={0}>Steps away</Label>
								<SegmentedControl
									value={String(depth)}
									onChange={(value) => setDepth(Number(value))}
									data={NEIGHBOURHOOD_DEPTHS}
								/>
							</Stack>
							<Stack gap={4}>
								<Label mb={0}>Follow links</Label>
								<SegmentedControl
									value={direction}
									onChange={(value) => setDirection(value as GraphDirection)}
									data={[
										{ value: "both", label: "Both ways" },
										{ value: "outgoing", label: "Out" },
										{ value: "incoming", label: "In" },
									]}
								/>
							</Stack>
						</>
					)}
					<Select
						w={220}
						label="Color by"
						allowDeselect={false}
						data={options}
						value={colorOption?.value ?? null}
						onChange={(value) => value && onColorBy(value)}
					/>
					{(allRecordKinds.length > 1 || allRelationKinds.length > 1) && (
						<Popover
							width={320}
							position="bottom-end"
							shadow="md"
						>
							<Popover.Target>
								<Button
									variant="light"
									leftSection={<Icon path={iconFilter} />}
								>
									{filters > 0 ? `Kinds (${filters})` : "Kinds"}
								</Button>
							</Popover.Target>
							<Popover.Dropdown>
								<Stack gap="sm">
									<MultiSelect
										label="Record kinds"
										clearable
										placeholder={
											recordKinds.length ? undefined : "All record kinds"
										}
										data={allRecordKinds}
										value={recordKinds}
										onChange={setRecordKinds}
									/>
									<MultiSelect
										label="Relation kinds"
										clearable
										placeholder={
											relationKinds.length ? undefined : "All relation kinds"
										}
										data={allRelationKinds}
										value={relationKinds}
										onChange={setRelationKinds}
									/>
								</Stack>
							</Popover.Dropdown>
						</Popover>
					)}
				</Group>
				<Text
					fz="xs"
					c="slate"
				>
					Drawing {formatCount(drawn?.nodes.length)} of {formatCount(graph.nodes.length)}{" "}
					records and {formatCount(drawn?.edges.length)} of{" "}
					{formatCount(graph.edges.length)} relations
					{scope === "neighbourhood" && node ? ` around “${node.label}”` : ""}, read at{" "}
					<Term id="cursor">cursor</Term> {formatCount(graph.known_at_cursor)}.
				</Text>

				<Grid>
					<Grid.Col span={{ base: 12, lg: 8 }}>
						<Paper
							h={CANVAS_HEIGHT}
							style={{ overflow: "hidden" }}
						>
							{graph.nodes.length === 0 ? (
								<Group
									h="100%"
									justify="center"
								>
									<Text c="slate">This estate holds no records yet.</Text>
								</Group>
							) : scope === "neighbourhood" && !node ? (
								<Stack
									h="100%"
									justify="center"
									align="center"
									gap="xs"
								>
									<Text c="slate">Pick a record to draw what is around it.</Text>
									<Text
										fz="sm"
										c="slate"
									>
										Search above, choose one under “Start here”, or click a dot
										in the whole estate.
									</Text>
								</Stack>
							) : canvasNodes.length > 0 ? (
								<GraphCanvas
									h="100%"
									nodes={canvasNodes}
									edges={canvasEdges}
									directed
									groupOf={groups.groupOf}
									groups={groups.groups}
									legendTitle={`Color: ${colorOption?.label ?? "Kind"}`}
									selected={selected}
									dimUnselected={scope === "estate"}
									onSelect={onSelect}
									hint="Scroll to zoom · drag to move · click a dot for details"
									renderHover={(id) => {
										const record = byId.get(id);
										if (!record) return null;
										const outgoing = graph.edges.filter(
											(edge) => edge.from === id,
										).length;
										const incoming = graph.edges.filter(
											(edge) => edge.to === id,
										).length;
										const group = groupLabel(id);
										return (
											<Stack gap={4}>
												<Text
													fw={700}
													c="bright"
													lineClamp={2}
												>
													{record.label}
												</Text>
												<Group gap={6}>
													<Badge
														size="xs"
														variant="light"
													>
														{record.kind}
													</Badge>
													<Text
														fz="xs"
														c="slate"
													>
														{outgoing} out · {incoming} in
													</Text>
												</Group>
												{group && (
													<Text
														fz="xs"
														c="slate"
														truncate
													>
														{colorOption?.label}: {group}
													</Text>
												)}
												<Text
													fz="xs"
													c="slate"
												>
													Click for details
												</Text>
											</Stack>
										);
									}}
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
							h={CANVAS_HEIGHT}
						>
							{node ? (
								<Stack
									h="100%"
									gap="sm"
								>
									<Box>
										<Group
											gap={6}
											mb={4}
										>
											<Badge variant="light">{node.kind}</Badge>
											{groupLabel(node.id) && (
												<Group
													gap={6}
													wrap="nowrap"
													miw={0}
													flex={1}
												>
													<Box
														w={9}
														h={9}
														bg={colorOf(node.id)}
														style={{
															borderRadius: "50%",
															flexShrink: 0,
														}}
													/>
													<Text
														fz="xs"
														c="slate"
														truncate
													>
														{groupLabel(node.id)}
													</Text>
												</Group>
											)}
										</Group>
										<Text
											fw={700}
											fz="lg"
											c="bright"
											lineClamp={3}
										>
											{node.label}
										</Text>
										<Text
											ff="monospace"
											fz="xs"
											c="slate"
										>
											{node.id}
										</Text>
									</Box>
									<Group gap="xs">
										{scope === "estate" ? (
											<Button
												size="xs"
												variant="light"
												leftSection={<Icon path={iconRelation} />}
												onClick={() => setScope("neighbourhood")}
											>
												Show what is around it
											</Button>
										) : (
											<Button
												size="xs"
												variant="light"
												leftSection={<Icon path={iconRelation} />}
												onClick={() => setScope("estate")}
											>
												Back to whole estate
											</Button>
										)}
										<Button
											size="xs"
											variant="light"
											leftSection={<Icon path={iconTarget} />}
											onClick={() => onOpenLens("vectors")}
										>
											Similar records
										</Button>
										<Button
											size="xs"
											variant="subtle"
											leftSection={<Icon path={iconQuery} />}
											onClick={() => runQuery(recordQuery(node))}
										>
											Query
										</Button>
									</Group>
									<Divider />
									<ScrollArea
										flex={1}
										type="auto"
									>
										<Stack gap="md">
											<LinkedList
												title="Links to"
												links={linked.outgoing}
												showRelationKind={allRelationKinds.length > 1}
												colorOf={colorOf}
												onSelect={onSelect}
											/>
											<LinkedList
												title="Linked from"
												links={linked.incoming}
												showRelationKind={allRelationKinds.length > 1}
												colorOf={colorOf}
												onSelect={onSelect}
											/>
											<Box>
												<Label>Fields</Label>
												<Table
													fz="sm"
													verticalSpacing={4}
												>
													<Table.Tbody>
														{Object.entries(node.properties).map(
															([name, value]) => (
																<Table.Tr key={name}>
																	<Table.Td
																		c="slate"
																		w="32%"
																		style={{
																			verticalAlign: "top",
																		}}
																	>
																		{name}
																	</Table.Td>
																	<Table.Td
																		style={{
																			wordBreak: "break-word",
																		}}
																	>
																		{value}
																	</Table.Td>
																</Table.Tr>
															),
														)}
														<Table.Tr>
															<Table.Td
																c="slate"
																w="32%"
															>
																valid from
															</Table.Td>
															<Table.Td
																title={String(
																	node.valid_from_unix_ms,
																)}
															>
																{formatTime(
																	node.valid_from_unix_ms,
																)}
															</Table.Td>
														</Table.Tr>
													</Table.Tbody>
												</Table>
											</Box>
										</Stack>
									</ScrollArea>
								</Stack>
							) : (
								<Stack
									h="100%"
									gap="sm"
								>
									<Box>
										<Label>Start here</Label>
										<Text
											fz="sm"
											c="slate"
										>
											The most linked records. Click one to see what it links
											to and what links to it.
										</Text>
									</Box>
									<Stack gap={2}>
										{startHere.map((record) => (
											<RecordRow
												key={record.id}
												record={record}
												color={colorOf(record.id)}
												detail={`${formatCount(degree.get(record.id) ?? 0)} links`}
												onSelect={onSelect}
											/>
										))}
									</Stack>
									<Divider />
									{colorOption?.value === "cluster" && (
										<Text
											fz="sm"
											c="slate"
										>
											Colors show <Term id="cluster">clusters</Term>: records
											that link to each other more than to the rest. Click a
											color in the legend to show only that cluster.
										</Text>
									)}
									<Box mt="auto">
										<Button
											variant="subtle"
											size="compact-sm"
											rightSection={
												<Icon
													path={
														schemaOpen ? iconChevronUp : iconChevronDown
													}
												/>
											}
											onClick={() => setSchemaOpen((open) => !open)}
										>
											<Term id="schema">Schema registry</Term>
										</Button>
										<Collapse in={schemaOpen}>
											<Table
												fz="sm"
												mt="xs"
											>
												<Table.Thead>
													<Table.Tr>
														<Table.Th>Kind</Table.Th>
														<Table.Th>Model</Table.Th>
														<Table.Th>Mode</Table.Th>
													</Table.Tr>
												</Table.Thead>
												<Table.Tbody>
													{view.tables.map((table) => (
														<Table.Tr key={table.name}>
															<Table.Td ff="monospace">
																{table.name}
															</Table.Td>
															<Table.Td>{table.model}</Table.Td>
															<Table.Td>{table.mode}</Table.Td>
														</Table.Tr>
													))}
												</Table.Tbody>
											</Table>
										</Collapse>
									</Box>
								</Stack>
							)}
						</Paper>
					</Grid.Col>
				</Grid>
			</Section>

			<Box ref={consoleRef}>
				<Section
					title={<Term id="query">RRFlowQL console</Term>}
					description="Read-only queries in RRFlow's query language, run through this session under the estate's query budget."
					rightSection={
						<Button
							variant="light"
							size="xs"
							rightSection={
								<Icon path={consoleOpen ? iconChevronUp : iconChevronDown} />
							}
							onClick={() => setConsoleOpen((open) => !open)}
						>
							{consoleOpen ? "Hide console" : "Open console"}
						</Button>
					}
				>
					<Collapse in={consoleOpen}>
						<Stack gap="sm">
							<Textarea
								// The input draws its own font, so the family is set on it directly.
								styles={{
									input: { fontFamily: "var(--mantine-font-family-monospace)" },
								}}
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
								<Group gap="xs">
									{node &&
										relations.map((relation) => (
											<Button
												key={relation.name}
												size="xs"
												variant="light"
												leftSection={<Icon path={iconRelation} />}
												onClick={() =>
													runQuery(traversalQuery(node, relation.name))
												}
											>
												Traverse {relation.name} from the selection
											</Button>
										))}
									<Text
										fz="xs"
										c="slate"
									>
										Ctrl/⌘ + Enter runs the query.
									</Text>
								</Group>
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
											{formatCount(execution.data.returned_rows)}{" "}
											{plural(execution.data.returned_rows, "row")}
										</Badge>
										<Badge variant="light">
											{formatCount(execution.data.keys_examined)}{" "}
											{plural(execution.data.keys_examined, "key")} examined
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
					</Collapse>
				</Section>
			</Box>
		</Stack>
	);
}

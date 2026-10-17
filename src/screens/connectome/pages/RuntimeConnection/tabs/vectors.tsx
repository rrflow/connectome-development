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
	Paper,
	Progress,
	ScrollArea,
	SegmentedControl,
	Select,
	Stack,
	Table,
	Text,
	UnstyledButton,
} from "@mantine/core";
import {
	Icon,
	iconChevronDown,
	iconChevronUp,
	iconErrorCircle,
	iconRefresh,
	iconRelation,
} from "@rrflow/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Label } from "~/components/Label";
import { Section } from "~/components/Section";
import type { RrdNodeView, RrdReference } from "~/rrflow/session";
import { formatCount, formatTime } from "../format";
import { Term } from "../glossary";
import { type CanvasEdge, type CanvasNode, GraphCanvas } from "../graph";
import { type ColorGroup, colorOptions, grouping } from "../groups";
import classes from "../style.module.scss";
import { databaseQueryKey, type RecordFocusProps, type RuntimeLensProps } from "../types";

/** Points requested per page while browsing; the contract bounds the maximum natively. */
const POINT_PAGE_SIZE = 50;
const SIMILAR_COUNTS = ["5", "10", "20"];
const CANVAS_HEIGHT = 620;
const NO_RECORD_GROUP = "no-record";

function referenceText(reference: RrdReference) {
	return `${reference.kind}:${reference.id}`;
}

function formatScore(score: number) {
	return score.toFixed(3);
}

function formatDuration(ms: number) {
	return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function VectorsTab({
	client,
	sessionKey,
	selected,
	onSelect,
	colorBy,
	onOpenLens,
}: RuntimeLensProps & RecordFocusProps) {
	const catalogue = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		queryFn: () => client.vectorCollections(),
	});
	const database = useQuery({
		queryKey: databaseQueryKey(sessionKey),
		queryFn: () => client.database(),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [collectionId, setCollectionId] = useState<string | null>(null);
	const [vectorName, setVectorName] = useState<string | null>(null);
	const [similarCount, setSimilarCount] = useState("10");
	const [browseOpen, setBrowseOpen] = useState(false);

	const collections = catalogue.data?.collections ?? [];
	const collection =
		collections.find((candidate) => candidate.collection_id === collectionId) ?? collections[0];
	const vector =
		collection?.vectors.find((candidate) => candidate.name === vectorName) ??
		collection?.vectors[0];

	const map = useQuery({
		queryKey: ["rrd-vector-map", sessionKey, collection?.collection_id, vector?.name],
		enabled: Boolean(collection && vector),
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: () =>
			client.vectorMap({
				collection_id: collection?.collection_id ?? "",
				vector_name: vector?.name ?? "",
			}),
	});

	const graph = database.data?.graph;
	const records = useMemo(
		() => new Map<string, RrdNodeView>(graph?.nodes.map((node) => [node.id, node]) ?? []),
		[graph],
	);
	const colorOption = useMemo(() => {
		const options = graph ? colorOptions(graph) : [];
		return options.find((option) => option.value === colorBy) ?? options[0];
	}, [graph, colorBy]);
	const recordGroups = useMemo(
		() => (graph && colorOption ? grouping(graph, colorOption.value) : null),
		[graph, colorOption],
	);

	const points = map.data?.points;
	const pointIds = useMemo(
		() => points?.map((point) => referenceText(point.reference)) ?? [],
		[points],
	);
	const subjectOf = useMemo(
		() =>
			new Map(
				points?.map((point) => [
					referenceText(point.reference),
					referenceText(point.subject),
				]) ?? [],
			),
		[points],
	);
	const labelOf = (point: string) => {
		const subject = subjectOf.get(point) ?? point;
		return records.get(subject)?.label ?? subject;
	};
	const canvasNodes = useMemo<CanvasNode[]>(
		() =>
			points?.map((point) => {
				const subject = referenceText(point.subject);
				return {
					id: referenceText(point.reference),
					label: records.get(subject)?.label ?? subject,
				};
			}) ?? [],
		[points, records],
	);
	const canvasEdges = useMemo<CanvasEdge[]>(() => {
		const data = map.data;
		if (!data) return [];
		// One line per pair; nearer neighbours pull harder. Rank, not score,
		// sets the pull so every metric lays out the same way.
		const pairs = new Map<string, CanvasEdge>();
		for (const link of data.links) {
			const [a, b] = [pointIds[link.from], pointIds[link.to]].sort();
			const key = `${a}|${b}`;
			const weight = (data.neighbours + 1 - link.rank) / data.neighbours;
			const existing = pairs.get(key);
			if (!existing || (existing.weight ?? 0) < weight) {
				pairs.set(key, { id: key, from: a, to: b, weight });
			}
		}
		return [...pairs.values()];
	}, [map.data, pointIds]);
	const mapGroups = useMemo(() => {
		const groupOf = new Map<string, string>();
		let unmatched = 0;
		for (const [point, subject] of subjectOf) {
			const group = recordGroups?.groupOf.get(subject);
			if (group) {
				groupOf.set(point, group);
			} else {
				groupOf.set(point, NO_RECORD_GROUP);
				unmatched += 1;
			}
		}
		const groups: ColorGroup[] = [...(recordGroups?.groups ?? [])];
		if (unmatched > 0) {
			groups.push({
				id: NO_RECORD_GROUP,
				label: "Record not in the graph",
				palette: null,
				total: unmatched,
			});
		}
		return { groupOf, groups };
	}, [subjectOf, recordGroups]);
	const colorOfPoint = (point: string) => {
		const group = mapGroups.groups.find(
			(candidate) => candidate.id === mapGroups.groupOf.get(point),
		);
		return group?.palette
			? `var(--mantine-color-${group.palette}-6)`
			: "var(--mantine-color-obsidian-4)";
	};

	const selectedPoint = useMemo(
		() =>
			selected
				? points?.find((point) => referenceText(point.subject) === selected)
				: undefined,
		[points, selected],
	);
	const selectedPointId = selectedPoint ? referenceText(selectedPoint.reference) : null;
	const search = useQuery({
		queryKey: [
			"rrd-vector-search",
			sessionKey,
			collection?.collection_id,
			vector?.name,
			selectedPointId,
			similarCount,
		],
		enabled: Boolean(collection && vector && selectedPoint),
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: () => {
			if (!selectedPoint) throw new Error("No vector is selected");
			return client.vectorSearch({
				collection_id: collection?.collection_id ?? "",
				vector_name: vector?.name ?? "",
				example: selectedPoint.reference,
				// The query point is its own best match.
				top_k: Number(similarCount) + 1,
			});
		},
	});
	const similar = useMemo(
		() =>
			search.data?.hits
				.filter((hit) => referenceText(hit.reference) !== selectedPointId)
				.slice(0, Number(similarCount)) ?? [],
		[search.data, selectedPointId, similarCount],
	);
	const highlighted = useMemo(
		() => new Set(similar.map((hit) => referenceText(hit.reference))),
		[similar],
	);

	const browse = useInfiniteQuery({
		queryKey: ["rrd-vector-points", sessionKey, collection?.collection_id, vector?.name],
		enabled: Boolean(collection && vector && browseOpen),
		initialPageParam: null as RrdReference | null,
		queryFn: ({ pageParam }) =>
			client.vectorPoints({
				collection_id: collection?.collection_id ?? "",
				vector_name: vector?.name ?? "",
				after: pageParam,
				limit: POINT_PAGE_SIZE,
			}),
		getNextPageParam: (page) => page.next_after ?? undefined,
	});

	if (catalogue.isPending) {
		return (
			<Group justify="center">
				<Loader />
			</Group>
		);
	}

	if (catalogue.isError) {
		return (
			<Alert
				color="red"
				title="The vector catalogue could not be read"
				icon={<Icon path={iconErrorCircle} />}
			>
				{catalogue.error instanceof Error ? catalogue.error.message : "Unknown RRD error"}
			</Alert>
		);
	}

	if (!collection || !vector) {
		return (
			<Section
				title="Vectors"
				description={
					<>
						This estate has no vector <Term id="collection">collections</Term> yet.
					</>
				}
			/>
		);
	}

	const loaded = browse.data?.pages.flatMap((page) => page.points) ?? [];
	const topScore = similar[0]?.score ?? 1;
	const data = map.data;
	const selectedRecord = selected ? records.get(selected) : undefined;

	return (
		<Stack gap="xl">
			<Section
				title="Vectors"
				description={
					<>
						Collection{" "}
						<Text
							span
							inherit
							fw={700}
						>
							{collection.collection_id}
						</Text>{" "}
						keeps a <Term id="vector">vector</Term> for each record:{" "}
						{formatCount(vector.dimensions)} numbers computed by the{" "}
						<Term id="embedding">embedding model</Term> and compared by {vector.metric}{" "}
						<Term id="similarity">similarity</Term>. Records whose vectors sit close
						together have similar content.
					</>
				}
				rightSection={
					<Button
						variant="light"
						size="xs"
						leftSection={<Icon path={iconRefresh} />}
						loading={catalogue.isFetching || map.isFetching}
						onClick={() => {
							catalogue.refetch();
							map.refetch();
						}}
					>
						Refresh
					</Button>
				}
			>
				<Group
					gap="sm"
					align="flex-end"
				>
					{collections.length > 1 && (
						<Select
							w={260}
							label="Collection"
							data={collections.map((candidate) => candidate.collection_id)}
							value={collection.collection_id}
							allowDeselect={false}
							onChange={(value) => {
								setCollectionId(value);
								setVectorName(null);
							}}
						/>
					)}
					{collection.vectors.length > 1 && (
						<Select
							w={220}
							label="Named vector"
							data={collection.vectors.map((candidate) => candidate.name)}
							value={vector.name}
							allowDeselect={false}
							onChange={setVectorName}
						/>
					)}
					<Group gap={6}>
						<Badge
							variant="light"
							tt="none"
						>
							{vector.name}
						</Badge>
						<Badge variant="light">{formatCount(vector.dimensions)} numbers each</Badge>
						<Badge variant="light">{vector.metric}</Badge>
						<Badge variant="light">{vector.memory_tier} tier</Badge>
						<Badge
							variant="outline"
							tt="none"
							title={vector.embedding_model_digest ?? undefined}
							maw={420}
						>
							{vector.embedding_model ?? "caller-supplied vectors"}
						</Badge>
					</Group>
				</Group>

				<Grid>
					<Grid.Col span={{ base: 12, lg: 8 }}>
						<Paper
							h={CANVAS_HEIGHT}
							style={{ overflow: "hidden" }}
						>
							{map.isPending ? (
								<Stack
									h="100%"
									justify="center"
									align="center"
									gap="xs"
								>
									<Loader />
									<Text c="slate">
										Asking the engine for every vector's nearest neighbours…
									</Text>
								</Stack>
							) : map.isError ? (
								<Box p="md">
									<Alert
										color="red"
										title="The similarity map could not be built"
										icon={<Icon path={iconErrorCircle} />}
									>
										{map.error instanceof Error
											? map.error.message
											: "Unknown RRD error"}
									</Alert>
								</Box>
							) : canvasNodes.length === 0 ? (
								<Group
									h="100%"
									justify="center"
								>
									<Text c="slate">This collection holds no vectors yet.</Text>
								</Group>
							) : (
								<GraphCanvas
									h="100%"
									nodes={canvasNodes}
									edges={canvasEdges}
									directed={false}
									groupOf={mapGroups.groupOf}
									groups={mapGroups.groups}
									legendTitle={`Color: ${colorOption?.label ?? "Kind"}`}
									selected={selectedPointId}
									highlighted={highlighted}
									dimUnselected
									onSelect={(point) =>
										onSelect(point ? (subjectOf.get(point) ?? null) : null)
									}
									hint="Close dots have similar vectors · click one to find its nearest"
									renderHover={(point) => {
										const index = pointIds.indexOf(point);
										const nearest = data?.links.find(
											(link) => link.from === index && link.rank === 1,
										);
										return (
											<Stack gap={4}>
												<Text
													fw={700}
													c="bright"
													lineClamp={2}
												>
													{labelOf(point)}
												</Text>
												{nearest && (
													<Text fz="xs">
														Nearest: {labelOf(pointIds[nearest.to])} (
														{formatScore(nearest.score)})
													</Text>
												)}
												<Text
													fz="xs"
													c="slate"
												>
													Click to list its most similar records
												</Text>
											</Stack>
										);
									}}
								/>
							)}
						</Paper>
					</Grid.Col>
					<Grid.Col span={{ base: 12, lg: 4 }}>
						<Paper
							p="md"
							h={CANVAS_HEIGHT}
						>
							{selected ? (
								<Stack
									h="100%"
									gap="sm"
								>
									<Box>
										<Group justify="space-between">
											<Label mb={0}>Selected record</Label>
											<Button
												variant="subtle"
												size="compact-xs"
												color="obsidian"
												onClick={() => onSelect(null)}
											>
												Clear
											</Button>
										</Group>
										<Text
											fw={700}
											fz="lg"
											c="bright"
											lineClamp={3}
										>
											{selectedRecord?.label ?? selected}
										</Text>
										<Text
											ff="monospace"
											fz="xs"
											c="slate"
										>
											{selectedPointId ?? selected}
										</Text>
									</Box>
									<Group gap="xs">
										<Button
											size="xs"
											variant="light"
											leftSection={<Icon path={iconRelation} />}
											onClick={() => onOpenLens("records")}
										>
											Show its relations
										</Button>
									</Group>
									<Divider />
									{!selectedPoint ? (
										<Text
											fz="sm"
											c="slate"
										>
											{data?.truncated
												? "This record's vector is beyond the part of the collection the map draws."
												: "This record has no vector in this collection."}
										</Text>
									) : (
										<>
											<Group
												justify="space-between"
												align="flex-end"
											>
												<Box>
													<Label mb={0}>Most similar records</Label>
													<Text
														fz="xs"
														c="slate"
													>
														<Term id="exact">Exact search</Term> by the
														engine
													</Text>
												</Box>
												<SegmentedControl
													size="xs"
													value={similarCount}
													onChange={setSimilarCount}
													data={SIMILAR_COUNTS}
												/>
											</Group>
											{search.isPending ? (
												<Group justify="center">
													<Loader size="sm" />
												</Group>
											) : search.isError ? (
												<Alert
													color="red"
													title="Search rejected"
													icon={<Icon path={iconErrorCircle} />}
												>
													{search.error instanceof Error
														? search.error.message
														: "Unknown RRD error"}
												</Alert>
											) : (
												<ScrollArea
													flex={1}
													type="auto"
												>
													<Stack gap={2}>
														{similar.map((hit) => {
															const point = referenceText(
																hit.reference,
															);
															const subject = referenceText(
																hit.subject,
															);
															return (
																<UnstyledButton
																	key={point}
																	px={6}
																	py={4}
																	className={classes.row}
																	onClick={() =>
																		onSelect(subject)
																	}
																>
																	<Group
																		gap={8}
																		wrap="nowrap"
																	>
																		<Box
																			w={9}
																			h={9}
																			bg={colorOfPoint(point)}
																			style={{
																				borderRadius: "50%",
																				flexShrink: 0,
																			}}
																		/>
																		<Text
																			fz="sm"
																			truncate
																			title={
																				records.get(subject)
																					?.label ??
																				subject
																			}
																		>
																			{records.get(subject)
																				?.label ?? subject}
																		</Text>
																		<Text
																			fz="xs"
																			ff="monospace"
																			ml="auto"
																		>
																			{formatScore(hit.score)}
																		</Text>
																	</Group>
																	<Progress
																		mt={4}
																		size="xs"
																		value={
																			topScore > 0
																				? Math.max(
																						0,
																						(hit.score /
																							topScore) *
																							100,
																					)
																				: 0
																		}
																		color="violet"
																	/>
																</UnstyledButton>
															);
														})}
													</Stack>
												</ScrollArea>
											)}
											{search.data && (
												<Text
													fz="xs"
													c="slate"
												>
													{search.data.exact ? "Exact" : "Approximate"} ·{" "}
													{formatCount(search.data.keys_examined)} keys
													examined ·{" "}
													{formatCount(search.data.selected_candidates)}{" "}
													of{" "}
													{formatCount(search.data.canonical_candidates)}{" "}
													candidates compared · cursor{" "}
													{formatCount(search.data.known_at_cursor)}
												</Text>
											)}
										</>
									)}
								</Stack>
							) : (
								<Stack gap="sm">
									<Label>How to read this map</Label>
									<Text fz="sm">
										Each dot is one record's vector. Lines join every vector to
										its {data?.neighbours ?? 5}{" "}
										<Term id="neighbours">nearest neighbours</Term>, as the
										engine's <Term id="exact">exact search</Term> returned them,
										so dots that sit together have similar content.
									</Text>
									<Text fz="sm">
										Colors match Records &amp; relations: you can see whether
										records that link to each other also read alike.
									</Text>
									{data && (
										<>
											<Divider />
											<Table
												fz="sm"
												verticalSpacing={4}
											>
												<Table.Tbody>
													<Table.Tr>
														<Table.Td c="slate">Vectors drawn</Table.Td>
														<Table.Td ta="right">
															{formatCount(data.points.length)}
															{data.truncated ? " (first part)" : ""}
														</Table.Td>
													</Table.Tr>
													<Table.Tr>
														<Table.Td c="slate">
															Exact searches
														</Table.Td>
														<Table.Td ta="right">
															{formatCount(data.searches)}
														</Table.Td>
													</Table.Tr>
													<Table.Tr>
														<Table.Td c="slate">Keys examined</Table.Td>
														<Table.Td ta="right">
															{formatCount(data.keys_examined)}
														</Table.Td>
													</Table.Tr>
													<Table.Tr>
														<Table.Td c="slate">Built in</Table.Td>
														<Table.Td ta="right">
															{formatDuration(data.elapsed_ms)}
														</Table.Td>
													</Table.Tr>
													<Table.Tr>
														<Table.Td c="slate">
															<Term id="cursor">Cursor</Term>
														</Table.Td>
														<Table.Td ta="right">
															{formatCount(data.known_at_cursor_min)}
															{data.known_at_cursor_max !==
															data.known_at_cursor_min
																? `–${formatCount(data.known_at_cursor_max)}`
																: ""}
														</Table.Td>
													</Table.Tr>
												</Table.Tbody>
											</Table>
											{data.truncated && (
												<Text
													fz="xs"
													c="slate"
												>
													The collection holds more vectors than the map
													draws; the map shows the first{" "}
													{formatCount(data.points.length)} in reference
													order.
												</Text>
											)}
											{data.unsearchable > 0 && (
												<Text
													fz="xs"
													c="slate"
												>
													{formatCount(data.unsearchable)} vectors are not
													dense, so they are drawn without neighbours.
												</Text>
											)}
										</>
									)}
								</Stack>
							)}
						</Paper>
					</Grid.Col>
				</Grid>
			</Section>

			<Section
				title={
					<>
						Stored <Term id="point">points</Term>
					</>
				}
				description={`Every vector in ${collection.collection_id}, in reference order, with its first numbers.`}
				rightSection={
					<Button
						variant="light"
						size="xs"
						rightSection={<Icon path={browseOpen ? iconChevronUp : iconChevronDown} />}
						onClick={() => setBrowseOpen((open) => !open)}
					>
						{browseOpen ? "Hide points" : "Browse points"}
					</Button>
				}
			>
				<Collapse in={browseOpen}>
					{browse.isError && (
						<Alert
							color="red"
							title="Point scroll failed"
							icon={<Icon path={iconErrorCircle} />}
						>
							{browse.error instanceof Error
								? browse.error.message
								: "Unknown RRD error"}
						</Alert>
					)}
					<Paper p="md">
						<ScrollArea.Autosize mah={480}>
							<Table
								fz="sm"
								striped
								stickyHeader
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Point</Table.Th>
										<Table.Th>Record</Table.Th>
										<Table.Th>Numbers</Table.Th>
										<Table.Th>Length ‖v‖</Table.Th>
										<Table.Th>First numbers</Table.Th>
										<Table.Th>Cursor</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{loaded.map((point) => {
										const subject = referenceText(point.subject);
										return (
											<Table.Tr key={referenceText(point.reference)}>
												<Table.Td ff="monospace">
													{point.reference.id}
												</Table.Td>
												<Table.Td>
													<UnstyledButton
														onClick={() => onSelect(subject)}
														title={subject}
													>
														<Text
															fz="sm"
															truncate
															maw={260}
														>
															{records.get(subject)?.label ?? subject}
														</Text>
													</UnstyledButton>
												</Table.Td>
												<Table.Td>{formatCount(point.dimensions)}</Table.Td>
												<Table.Td ff="monospace">
													{point.norm.toFixed(4)}
												</Table.Td>
												<Table.Td
													ff="monospace"
													fz="xs"
												>
													{point.preview
														.map((component) => component.toFixed(3))
														.join("  ")}
												</Table.Td>
												<Table.Td>
													{formatCount(point.source_cursor)}
												</Table.Td>
											</Table.Tr>
										);
									})}
								</Table.Tbody>
							</Table>
						</ScrollArea.Autosize>
						<Group
							justify="space-between"
							mt="sm"
						>
							<Text
								fz="xs"
								c="slate"
							>
								{formatCount(loaded.length)} loaded · updated{" "}
								{formatTime(collection.updated_at_unix_ms)}
							</Text>
							<Button
								size="xs"
								variant="light"
								disabled={!browse.hasNextPage}
								loading={browse.isFetchingNextPage || browse.isPending}
								onClick={() => browse.fetchNextPage()}
							>
								{browse.hasNextPage ? "Load more" : "All points loaded"}
							</Button>
						</Group>
					</Paper>
				</Collapse>
			</Section>
		</Stack>
	);
}

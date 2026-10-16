import {
	Alert,
	Badge,
	Button,
	Group,
	Loader,
	NumberInput,
	Paper,
	Progress,
	ScrollArea,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { Icon, iconErrorCircle, iconRefresh, iconSearch } from "@rrflow/ui";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Label } from "~/components/Label";
import { Section } from "~/components/Section";
import type { RrdReference } from "~/rrflow/session";
import { formatCount, formatSize, formatTime, shortDigest } from "../format";
import { Stat } from "../stat";
import type { RuntimeLensProps } from "../types";

/** Points requested per page; the contract bounds the maximum natively. */
const POINT_PAGE_SIZE = 50;
const DEFAULT_TOP_K = 10;
const MAX_TOP_K = 100;

function referenceText(reference: RrdReference) {
	return `${reference.kind}:${reference.id}`;
}

export function VectorsTab({ client, sessionKey }: RuntimeLensProps) {
	const catalogue = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		queryFn: () => client.vectorCollections(),
	});
	const [collectionId, setCollectionId] = useState<string | null>(null);
	const [vectorName, setVectorName] = useState<string | null>(null);
	const [topK, setTopK] = useState<number>(DEFAULT_TOP_K);

	const collections = catalogue.data?.collections ?? [];
	const collection =
		collections.find((candidate) => candidate.collection_id === collectionId) ?? collections[0];
	const vector =
		collection?.vectors.find((candidate) => candidate.name === vectorName) ??
		collection?.vectors[0];

	useEffect(() => {
		if (collection && collection.collection_id !== collectionId) {
			setCollectionId(collection.collection_id);
		}
	}, [collection, collectionId]);

	const points = useInfiniteQuery({
		queryKey: ["rrd-vector-points", sessionKey, collection?.collection_id, vector?.name],
		enabled: Boolean(collection && vector),
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

	const search = useMutation({
		mutationFn: (example: RrdReference) =>
			client.vectorSearch({
				collection_id: collection?.collection_id ?? "",
				vector_name: vector?.name ?? "",
				example,
				top_k: topK,
			}),
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
				title="Vector catalogue read failed"
				icon={<Icon path={iconErrorCircle} />}
			>
				{catalogue.error instanceof Error ? catalogue.error.message : "Unknown RRD error"}
			</Alert>
		);
	}

	const loaded = points.data?.pages.flatMap((page) => page.points) ?? [];
	const lastPage = points.data?.pages.at(-1);
	const topScore = search.data?.hits[0]?.score ?? 1;

	return (
		<Stack gap="xl">
			<Section
				title="Vector collections"
				description={`Catalogue revision ${formatCount(catalogue.data?.revision)}: named vectors, points, and exact similarity search.`}
				rightSection={
					<Button
						variant="light"
						size="xs"
						leftSection={<Icon path={iconRefresh} />}
						loading={catalogue.isFetching || points.isFetching}
						onClick={() => {
							catalogue.refetch();
							points.refetch();
						}}
					>
						Refresh
					</Button>
				}
			>
				{!collection || !vector ? (
					<Text c="slate">This instance has no vector collections yet.</Text>
				) : (
					<Stack gap="md">
						<Group grow>
							<Select
								label="Collection"
								data={collections.map((candidate) => candidate.collection_id)}
								value={collection.collection_id}
								allowDeselect={false}
								onChange={(value) => {
									setCollectionId(value);
									setVectorName(null);
									search.reset();
								}}
							/>
							<Select
								label="Named vector"
								data={collection.vectors.map((candidate) => candidate.name)}
								value={vector.name}
								allowDeselect={false}
								onChange={(value) => {
									setVectorName(value);
									search.reset();
								}}
							/>
						</Group>
						<SimpleGrid cols={{ base: 2, md: 4, xl: 8 }}>
							<Stat
								label="Kind"
								value={vector.kind}
							/>
							<Stat
								label="Dimensions"
								value={formatCount(vector.dimensions)}
							/>
							<Stat
								label="Metric"
								value={vector.metric}
							/>
							<Stat
								label="Memory tier"
								value={vector.memory_tier}
							/>
							<Stat
								label="Field"
								value={vector.field}
							/>
							<Stat
								label="Generation"
								value={formatCount(collection.generation)}
							/>
							<Stat
								label="Payload indexes"
								value={formatCount(collection.payload_indexes)}
							/>
							<Stat
								label="Configuration"
								value={shortDigest(collection.configuration_sha256)}
								title={collection.configuration_sha256}
							/>
						</SimpleGrid>
						<Paper p="md">
							<Label>Embedding model</Label>
							{vector.embedding_model ? (
								<>
									<Text
										ff="monospace"
										fz="sm"
										style={{ wordBreak: "break-all" }}
									>
										{vector.embedding_model}
									</Text>
									<Text
										ff="monospace"
										fz="xs"
										c="slate"
									>
										sha256 {vector.embedding_model_digest}
									</Text>
								</>
							) : (
								<Text
									fz="sm"
									c="slate"
								>
									Not model-bound: points carry caller-supplied vectors.
								</Text>
							)}
							<Text
								fz="xs"
								c="slate"
								mt="xs"
							>
								Updated {formatTime(collection.updated_at_unix_ms)}
							</Text>
						</Paper>
					</Stack>
				)}
			</Section>

			{collection && vector && (
				<Section
					title="Points"
					description={`Scrolled in reference order at cursor ${formatCount(lastPage?.known_at_cursor)}; ${formatCount(loaded.length)} loaded.`}
				>
					{points.isError && (
						<Alert
							color="red"
							title="Point scroll failed"
							icon={<Icon path={iconErrorCircle} />}
						>
							{points.error instanceof Error
								? points.error.message
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
										<Table.Th>Subject</Table.Th>
										<Table.Th>Dims</Table.Th>
										<Table.Th>‖v‖</Table.Th>
										<Table.Th>Leading components</Table.Th>
										<Table.Th>Cursor</Table.Th>
										<Table.Th />
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{loaded.map((point) => (
										<Table.Tr key={referenceText(point.reference)}>
											<Table.Td ff="monospace">{point.reference.id}</Table.Td>
											<Table.Td ff="monospace">
												{referenceText(point.subject)}
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
											<Table.Td>{formatCount(point.source_cursor)}</Table.Td>
											<Table.Td>
												<Button
													size="compact-xs"
													variant="light"
													leftSection={<Icon path={iconSearch} />}
													loading={
														search.isPending &&
														search.variables?.id === point.reference.id
													}
													onClick={() => search.mutate(point.reference)}
												>
													Similar
												</Button>
											</Table.Td>
										</Table.Tr>
									))}
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
								{formatCount(lastPage?.keys_examined)} keys examined on the last
								page
							</Text>
							<Button
								size="xs"
								variant="light"
								disabled={!points.hasNextPage}
								loading={points.isFetchingNextPage}
								onClick={() => points.fetchNextPage()}
							>
								{points.hasNextPage ? "Load more" : "All points loaded"}
							</Button>
						</Group>
					</Paper>
				</Section>
			)}

			{collection && vector && (
				<Section
					title="Similarity search"
					description="Query by example: the selected point's stored vector searches its collection exactly."
					rightSection={
						<NumberInput
							size="xs"
							w={120}
							label="Top k"
							min={1}
							max={MAX_TOP_K}
							value={topK}
							onChange={(value) =>
								setTopK(typeof value === "number" ? value : DEFAULT_TOP_K)
							}
						/>
					}
				>
					{search.isError && (
						<Alert
							color="red"
							title="Search rejected"
							icon={<Icon path={iconErrorCircle} />}
						>
							{search.error instanceof Error
								? search.error.message
								: "Unknown RRD error"}
						</Alert>
					)}
					{search.data ? (
						<Paper p="md">
							<Group
								gap="xs"
								mb="sm"
							>
								<Badge variant="light">
									query {referenceText(search.data.query)}
								</Badge>
								<Badge variant="light">{search.data.access_path}</Badge>
								<Badge
									variant="light"
									color={search.data.exact ? "green" : "orange"}
								>
									{search.data.exact ? "exact" : "approximate"}
								</Badge>
								<Badge variant="outline">
									{formatCount(search.data.keys_examined)} keys examined
								</Badge>
								<Badge variant="outline">
									{formatCount(search.data.selected_candidates)} /{" "}
									{formatCount(search.data.canonical_candidates)} candidates
								</Badge>
								<Badge variant="outline">
									{formatSize(search.data.loaded_artifact_bytes)} artifacts loaded
								</Badge>
							</Group>
							<Table fz="sm">
								<Table.Thead>
									<Table.Tr>
										<Table.Th w={48}>#</Table.Th>
										<Table.Th>Subject</Table.Th>
										<Table.Th>Score</Table.Th>
										<Table.Th w="30%" />
										<Table.Th>Cursor</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{search.data.hits.map((hit, index) => (
										<Table.Tr key={referenceText(hit.reference)}>
											<Table.Td>{index + 1}</Table.Td>
											<Table.Td ff="monospace">
												{referenceText(hit.subject)}
											</Table.Td>
											<Table.Td ff="monospace">
												{hit.score.toFixed(4)}
											</Table.Td>
											<Table.Td>
												<Progress
													value={
														topScore > 0
															? (hit.score / topScore) * 100
															: 0
													}
													color="violet"
												/>
											</Table.Td>
											<Table.Td>{formatCount(hit.source_cursor)}</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</Paper>
					) : (
						<Text c="slate">Choose “Similar” on a point to search its neighbours.</Text>
					)}
				</Section>
			)}
		</Stack>
	);
}

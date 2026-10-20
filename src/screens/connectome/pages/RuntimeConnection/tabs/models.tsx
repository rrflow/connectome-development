import {
	Alert,
	Badge,
	Button,
	Code,
	Group,
	Paper,
	ScrollArea,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { RrdSessionClient } from "~/rrflow/session";
import type { RuntimeLens } from "../types";

// Presentation examples for the engine's existing native query grammar.
// Execution, type checking, authorization and budgets remain in RrdEngine.
const sources: Record<string, string> = {
	document: "record",
	relational: "record",
	graph_node: "record",
	key_value: "record",
	graph_relation: "relation",
	event: "event",
	lifecycle_event: "event",
	reasoning_event: "event",
	reasoning_record: "record",
	lifecycle_record: "record",
	time_series: "series",
	geo: "geo",
};
const purposes: Record<string, string> = {
	document: "Flexible structured documents",
	relational: "Typed rows with schema constraints",
	graph_node: "Entities in a relationship graph",
	graph_relation: "Connections between entities",
	key_value: "Named values",
	vector: "Embeddings for similarity search",
	event: "Events over time",
	time_series: "Timestamped measurements",
	geo: "Spatial shapes and locations",
	object: "Object metadata and content references",
	reasoning_claim: "Grounded claims",
	reasoning_record: "Reasoning records",
	reasoning_event: "Reasoning events",
	lifecycle_record: "Engine lifecycle records",
	lifecycle_event: "Engine lifecycle events",
};
export function ModelsTab({
	client,
	sessionKey,
	onOpenLens,
}: {
	client: RrdSessionClient;
	sessionKey: string;
	onOpenLens: (lens: RuntimeLens) => void;
}) {
	const schema = useQuery({
		queryKey: ["rrd-schema", sessionKey],
		queryFn: () => client.schema(),
		retry: false,
	});
	const [selected, setSelected] = useState<string | null>(null);
	const [seriesKind, setSeriesKind] = useState<string | null>(null);
	const table = schema.data?.tables.find((entry) => entry.name === selected);
	const source = table ? sources[table.model] : undefined;
	const sourceKind = table?.model === "time_series" ? seriesKind : table?.name;
	const registered =
		source === "record" || source === "relation" || source === "event"
			? Boolean(table?.properties[source])
			: true;
	const canQuery = Boolean(
		source && registered && sourceKind && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(sourceKind),
	);
	const rows = useMutation({
		mutationFn: () => {
			if (!canQuery || !table)
				throw new Error("Select a table with an available native query source");
			return client.query(
				`FROM ${source}:${sourceKind} AT VALID ${Date.now()} KNOWN HEAD PROJECT * LIMIT 50`,
			);
		},
	});
	const families = [...new Set(schema.data?.tables.map((entry) => entry.model) ?? [])];
	return (
		<Stack>
			<Group justify="space-between">
				<Text
					size="xl"
					fw={700}
				>
					Explore native data models
				</Text>
				<Button
					variant="light"
					loading={schema.isFetching}
					onClick={() => {
						rows.reset();
						schema.refetch();
					}}
				>
					Refresh schema
				</Button>
			</Group>
			<Text>
				rrflowQL asks the questions. rrflowDB owns your typed data and transactions.
				rrflowKV persists the results. Every view here reads that same engine.
			</Text>
			{schema.isError && (
				<Alert
					color="red"
					title="Cannot read the catalogue"
				>
					{schema.error.message}
				</Alert>
			)}
			{schema.isLoading && <Text>Reading the authenticated schema...</Text>}
			{schema.data && (
				<>
					<Group>
						<Badge>Schema {schema.data.schema_revision ?? "not installed"}</Badge>
						<Badge>Read cursor {schema.data.known_at_cursor}</Badge>
						<Text size="sm">{schema.data.tables.length} tables in this preview</Text>
					</Group>
					{schema.data.truncated && (
						<Alert color="yellow">
							This preview is limited to the first 256 tables. It is not a complete
							catalogue listing.
						</Alert>
					)}
					<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
						{families.map((family) => (
							<Paper
								key={family}
								withBorder
								p="md"
							>
								<Text fw={600}>{family.replaceAll("_", " ")}</Text>
								<Text size="sm">
									{purposes[family] ?? "Engine-defined data model"}
								</Text>
							</Paper>
						))}
					</SimpleGrid>
					{schema.data.tables.length === 0 && (
						<Alert title="Your database is ready for a schema">
							No application tables are defined. Use the native RRFlow SDK to add a
							schema and commit records, then refresh here.
						</Alert>
					)}
					<Select
						searchable
						label="Choose a native table"
						placeholder="Search tables by name or model"
						data={schema.data.tables.map((entry) => ({
							value: entry.name,
							label: `${entry.name} - ${entry.model.replaceAll("_", " ")}`,
						}))}
						value={selected}
						onChange={(value) => {
							setSelected(value);
							setSeriesKind(null);
							rows.reset();
						}}
					/>
				</>
			)}
			{table && (
				<Paper
					withBorder
					p="md"
				>
					<Stack gap="sm">
						<Text fw={600}>
							{table.name} - {table.mode}
						</Text>
						<Text size="sm">{purposes[table.model] ?? table.model}</Text>
						{table.model === "time_series" && (
							<>
								<Text size="sm">
									Samples belong to a series record. Choose that record's kind;
									the native query reads samples for that series kind, not the
									sample table name.
								</Text>
								<Select
									label="Series record kind"
									searchable
									value={seriesKind}
									onChange={(value) => {
										setSeriesKind(value);
										rows.reset();
									}}
									data={(schema.data?.tables ?? [])
										.filter((entry) => sources[entry.model] === "record")
										.map((entry) => entry.name)}
								/>
							</>
						)}
						<Group>
							<Button
								disabled={!canQuery}
								loading={rows.isPending}
								onClick={() => rows.mutate()}
							>
								Browse up to 50 rows
							</Button>
							{table.model === "vector" && (
								<Button onClick={() => onOpenLens("vectors")}>
									Open vector search
								</Button>
							)}
							{table.model === "graph_relation" && (
								<Button
									variant="light"
									onClick={() => onOpenLens("records")}
								>
									Explore relationships
								</Button>
							)}
						</Group>
						{!canQuery && table.model !== "time_series" && (
							<Text size="sm">
								{table.model === "vector"
									? "Use the Vectors view for bounded point and similarity access."
									: "This table has no registered row-query source in the current native interface. Its schema is shown; no data query has been run."}
							</Text>
						)}
						<details>
							<summary>Table properties</summary>
							<Code block>{JSON.stringify(table.properties, null, 2)}</Code>
						</details>
					</Stack>
				</Paper>
			)}
			{rows.isError && (
				<Alert
					color="red"
					title="Query was not completed"
				>
					{rows.error.message}
				</Alert>
			)}
			{rows.data && (
				<>
					<Code block>{rows.data.canonical_query}</Code>
					<Text size="sm">
						{rows.data.returned_rows} rows; read cursor {rows.data.known_at_cursor};{" "}
						{rows.data.keys_examined} storage keys examined. Results are a bounded
						preview, not a total table count.
					</Text>
					{rows.data.truncated && (
						<Alert color="yellow">
							The engine truncated this result at its configured limit.
						</Alert>
					)}
					<ScrollArea>
						<Table
							striped
							withTableBorder
						>
							<Table.Thead>
								<Table.Tr>
									{rows.data.columns.map((column) => (
										<Table.Th key={column}>{column}</Table.Th>
									))}
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{rows.data.rows.map((row) => (
									<Table.Tr key={row.identity}>
										{rows.data?.columns.map((column) => (
											<Table.Td key={column}>
												<Text
													size="sm"
													style={{
														maxWidth: 320,
														overflowWrap: "anywhere",
													}}
												>
													{row.values[column] ?? "(empty)"}
												</Text>
											</Table.Td>
										))}
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</ScrollArea>
				</>
			)}
			<Alert
				title="Multimodal data and AI models"
				color="blue"
			>
				Records can describe text, images, audio and video; relationships connect them and
				vectors support similarity. Media understanding or generation requires an explicitly
				configured model. This view does not activate a provider, cloud account or
				synchronization.
			</Alert>
		</Stack>
	);
}

import {
	Alert,
	Badge,
	Box,
	Button,
	Grid,
	Group,
	Loader,
	NavLink,
	Paper,
	ScrollArea,
	Stack,
	Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import type { RrdSchemaView, RrdTableView } from "~/rrflow/session";
import { iconErrorCircle, iconRefresh } from "~/shared/assets/icons";
import { databaseQuery } from "../api/queries";
import { ReadNotice } from "../components/notice";
import { useProject } from "../project/context";
import { formatCount, formatMoment } from "../utils/format";
import { isQueryableName, needsRegistration, rowSource } from "./row-query";
import { TableRows } from "./table-rows";

const words = (value: string) => value.replaceAll("_", " ");

/** The project's table catalogue, and the current rows of the chosen table. */
export function TablesView() {
	const { session, client, sessionKey, open } = useProject();
	const database = useQuery({ ...databaseQuery(client, sessionKey), enabled: Boolean(session) });
	// The Data models view reads the same schema under the same key.
	const schema = useQuery({
		queryKey: ["rrd-schema", sessionKey],
		enabled: Boolean(session),
		queryFn: () => client.schema(),
		retry: false,
	});
	const [chosen, setChosen] = useState<string | null>(null);

	if (!session) return null;

	const tables = database.data?.tables ?? [];
	const table = tables.find((entry) => entry.name === chosen) ?? tables[0];

	return (
		<Stack gap="lg">
			<Group
				justify="space-between"
				align="flex-start"
			>
				<Box flex={1}>
					<PrimaryTitle>Tables</PrimaryTitle>
					<Text mt={4}>
						A table is one named set of the project's data. On the left is every table
						the engine lists; choose one to see the rows it holds right now.
					</Text>
				</Box>
				<Button
					variant="light"
					size="xs"
					leftSection={<Icon path={iconRefresh} />}
					loading={database.isFetching}
					onClick={() => {
						database.refetch();
						schema.refetch();
					}}
				>
					Read the list again
				</Button>
			</Group>

			<ReadNotice
				query={database}
				observedAt={database.data?.observed_at_unix_ms}
			/>
			{database.isPending && (
				<Group>
					<Loader size="sm" />
					<Text c="slate">Reading the list of tables…</Text>
				</Group>
			)}
			{database.isError && !database.data && (
				<Alert
					color="red"
					title="The list of tables could not be read"
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(database.error)}
				</Alert>
			)}

			{database.data && (
				<>
					<Text
						fz="sm"
						c="slate"
					>
						{formatCount(tables.length)} {tables.length === 1 ? "table" : "tables"} ·
						schema revision{" "}
						{database.data.schema_revision === null
							? "none installed"
							: formatCount(database.data.schema_revision)}{" "}
						· list read {formatMoment(database.data.observed_at_unix_ms)}
					</Text>
					{tables.length === 0 ? (
						<Text c="slate">The engine listed zero tables for this project.</Text>
					) : (
						<Grid>
							<Grid.Col span={{ base: 12, md: 4, xl: 3 }}>
								<Paper p="xs">
									<ScrollArea.Autosize mah={640}>
										{tables.map((entry) => (
											<NavLink
												key={entry.name}
												label={entry.name}
												description={`${words(entry.model)} · ${words(entry.mode)}`}
												active={entry.name === table?.name}
												onClick={() => setChosen(entry.name)}
											/>
										))}
									</ScrollArea.Autosize>
								</Paper>
							</Grid.Col>
							<Grid.Col span={{ base: 12, md: 8, xl: 9 }}>
								{table && (
									<TableDetail
										key={table.name}
										table={table}
										schema={schema.data}
										onOpen={open}
									/>
								)}
							</Grid.Col>
						</Grid>
					)}
				</>
			)}
		</Stack>
	);
}

interface TableDetailProps {
	table: RrdTableView;
	schema: RrdSchemaView | undefined;
	onOpen: (path: string) => void;
}

function TableDetail({ table, schema, onOpen }: TableDetailProps) {
	const { client, sessionKey } = useProject();
	const source = rowSource(table.model);
	const declared = schema?.tables.find((entry) => entry.name === table.name);
	// A table whose schema does not name the row source cannot be read through it.
	const unregistered =
		source !== undefined &&
		needsRegistration(source) &&
		declared !== undefined &&
		!declared.properties[source];
	const readable = source !== undefined && isQueryableName(table.name) && !unregistered;

	return (
		<Paper p="md">
			<Stack gap="sm">
				<Group gap="xs">
					<Text
						fw={700}
						fz="lg"
						ff="monospace"
					>
						{table.name}
					</Text>
					<Badge variant="light">Model: {words(table.model)}</Badge>
					<Badge
						variant="light"
						color="gray"
					>
						Mode: {words(table.mode)}
					</Badge>
				</Group>
				{readable && source ? (
					<TableRows
						client={client}
						sessionKey={sessionKey}
						table={table}
						source={source}
					/>
				) : (
					<Unreadable
						table={table}
						source={source}
						unregistered={unregistered}
						onOpen={onOpen}
					/>
				)}
			</Stack>
		</Paper>
	);
}

interface UnreadableProps {
	table: RrdTableView;
	source: string | undefined;
	unregistered: boolean;
	onOpen: (path: string) => void;
}

/** Why no rows were read for a table, and where its contents can be seen instead. */
function Unreadable({ table, source, unregistered, onOpen }: UnreadableProps) {
	if (table.model === "vector") {
		return (
			<Stack
				gap="xs"
				align="flex-start"
			>
				<Text fz="sm">
					This table holds vectors, which are read by similarity search rather than as
					rows. No rows were read here.
				</Text>
				<Button
					variant="light"
					size="xs"
					onClick={() => onOpen("knowledge/vectors")}
				>
					Open Vectors
				</Button>
			</Stack>
		);
	}
	if (table.model === "time_series") {
		return (
			<Stack
				gap="xs"
				align="flex-start"
			>
				<Text fz="sm">
					This table holds measurements over time. They are read through the record they
					belong to, not by this table's name, so no rows were read here. The Data models
					view lets you choose that record.
				</Text>
				<Button
					variant="light"
					size="xs"
					onClick={() => onOpen("knowledge/models")}
				>
					Open Data models
				</Button>
			</Stack>
		);
	}
	return (
		<Text fz="sm">
			{unregistered
				? `The project's schema does not register a ${source} source for this table, so its rows cannot be queried. No rows were read.`
				: source
					? "This table's name cannot be written in a row query, so no rows were read."
					: `Connectome has no row query for tables of the ${words(table.model)} model, so no rows were read.`}
		</Text>
	);
}

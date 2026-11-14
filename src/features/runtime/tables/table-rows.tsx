import { Alert, Button, Code, Group, Loader, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "~/components/Icon";
import { describeRrdError } from "~/rrflow/runtime";
import type { RrdSessionClient, RrdTableView } from "~/rrflow/session";
import { iconErrorCircle, iconRefresh } from "~/shared/assets/icons";
import { formatCount } from "../utils/format";
import { TABLE_ROW_LIMIT, tableRowsQuery } from "./row-query";

/** Widest cell before the text wraps. */
const CELL_WIDTH = 320;

export interface TableRowsProps {
	client: RrdSessionClient;
	sessionKey: string;
	table: RrdTableView;
	/** The rrflowQL source that reads this table's rows. */
	source: string;
}

/** The rows the engine returns for one table right now. */
export function TableRows({ client, sessionKey, table, source }: TableRowsProps) {
	const rows = useQuery({
		queryKey: ["rrd-table-rows", sessionKey, source, table.name],
		enabled: Boolean(sessionKey),
		queryFn: () => client.query(tableRowsQuery(source, table.name)),
		retry: false,
	});

	if (rows.isPending) {
		return (
			<Group>
				<Loader size="sm" />
				<Text c="slate">Reading the rows of {table.name}…</Text>
			</Group>
		);
	}

	const view = rows.data;

	return (
		<Stack gap="sm">
			{rows.isError && (
				<Alert
					color="red"
					title={
						view
							? "The latest read failed; these are the rows read before it"
							: "The engine did not return this table's rows"
					}
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(rows.error)}
				</Alert>
			)}
			{view && (
				<>
					<Group
						justify="space-between"
						align="flex-start"
					>
						<Text
							fz="sm"
							flex={1}
						>
							{view.returned_rows === 0
								? "The engine returned zero rows for this table."
								: `${formatCount(view.returned_rows)} ${view.returned_rows === 1 ? "row" : "rows"} returned.`}{" "}
							Read at cursor {formatCount(view.known_at_cursor)}, schema revision{" "}
							{formatCount(view.schema_revision)}; {formatCount(view.keys_examined)}{" "}
							storage keys examined. This read asks for at most {TABLE_ROW_LIMIT}{" "}
							rows, so it is not a count of the whole table.
						</Text>
						<Button
							variant="light"
							size="xs"
							leftSection={<Icon path={iconRefresh} />}
							loading={rows.isFetching}
							onClick={() => rows.refetch()}
						>
							Read again
						</Button>
					</Group>
					{view.truncated && (
						<Alert color="yellow">
							The engine cut this result short at its limit, so more rows matched than
							are shown here.
						</Alert>
					)}
					<Code block>{view.canonical_query}</Code>
					{view.rows.length > 0 && (
						<ScrollArea>
							<Table
								fz="sm"
								striped
								withTableBorder
							>
								<Table.Thead>
									<Table.Tr>
										{view.columns.map((column) => (
											<Table.Th key={column}>{column}</Table.Th>
										))}
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{view.rows.map((row) => (
										<Table.Tr key={row.identity}>
											{view.columns.map((column) => (
												<Table.Td key={column}>
													<Text
														fz="sm"
														maw={CELL_WIDTH}
														c={
															row.values[column] === undefined
																? "dimmed"
																: undefined
														}
														style={{ overflowWrap: "anywhere" }}
													>
														{row.values[column] ?? "(no value)"}
													</Text>
												</Table.Td>
											))}
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</ScrollArea>
					)}
				</>
			)}
		</Stack>
	);
}

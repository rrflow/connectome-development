import { Badge, Group, Paper, ScrollArea, Table, Text } from "@mantine/core";
import { nativeQueryTable } from "~/rrflow/client/query-presentation";
import type { RrdQueryView } from "~/rrflow/session";
import { plural } from "~/shared/util/text/helpers";
import { formatCount } from "../utils/format";

/** Widest cell before truncation; the full value shows on hover. */
const CELL_WIDTH = 320;
const CELL_STYLE = { overflow: "hidden", textOverflow: "ellipsis" } as const;

export interface QueryRowsProps {
	result: RrdQueryView;
	/** Time from sending the query to holding its answer, measured in this window. */
	roundTripMs?: number;
}

/** The rows the engine returned for one query, exactly as it returned them. */
export function QueryRows({ result, roundTripMs }: QueryRowsProps) {
	// Cells are read as the row's own values, so a column a row lacks is empty
	// rather than a property every JavaScript object inherits.
	const table = nativeQueryTable(result);
	return (
		<Paper p="md">
			<Group
				gap="xs"
				mb="sm"
			>
				<Badge variant="light">
					{formatCount(result.returned_rows)} {plural(result.returned_rows, "row")}
				</Badge>
				{result.truncated && (
					<Badge color="orange">truncated: more rows matched than were returned</Badge>
				)}
				{roundTripMs !== undefined && (
					<Badge
						variant="light"
						color="slate"
						title="Measured in this window, from sending the query to holding its answer. The engine reports its own time only for EXPLAIN ANALYZE."
					>
						answered in {roundTripMs.toFixed(1)} ms round trip
					</Badge>
				)}
			</Group>
			<Text
				ff="monospace"
				fz="xs"
				c="slate"
				mb="sm"
				title="The query as the engine understood it"
			>
				{result.canonical_query}
			</Text>
			{table === null ? (
				<Text c="red">
					The answer does not have the shape of a query result, so no rows are shown.
				</Text>
			) : table.rows.length === 0 ? (
				<Text c="slate">The engine returned zero rows for this query.</Text>
			) : (
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
								{table.columns.map((column) => (
									<Table.Th key={column}>{column}</Table.Th>
								))}
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{table.rows.map((row) => (
								<Table.Tr key={row.identity}>
									<Table.Td
										ff="monospace"
										maw={CELL_WIDTH}
										title={row.identity}
										style={CELL_STYLE}
									>
										{row.identity}
									</Table.Td>
									{row.cells.map((cell, index) => (
										<Table.Td
											key={table.columns[index]}
											maw={CELL_WIDTH}
											title={cell ?? undefined}
											style={CELL_STYLE}
										>
											{cell ?? ""}
										</Table.Td>
									))}
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				</ScrollArea.Autosize>
			)}
		</Paper>
	);
}

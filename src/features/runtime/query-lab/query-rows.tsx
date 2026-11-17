import { Badge, Group, Paper, ScrollArea, Table, Text } from "@mantine/core";
import type { RrdQueryView } from "~/rrflow/session";
import { plural } from "~/shared/util/text/helpers";
import { formatCount } from "../utils/format";

/** Widest cell before truncation; the full value shows on hover. */
const CELL_WIDTH = 320;
const CELL_STYLE = { overflow: "hidden", textOverflow: "ellipsis" } as const;

/** The rows the engine returned for one query, exactly as it returned them. */
export function QueryRows({ result }: { result: RrdQueryView }) {
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
			{result.rows.length === 0 ? (
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
								{result.columns.map((column) => (
									<Table.Th key={column}>{column}</Table.Th>
								))}
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{result.rows.map((row) => (
								<Table.Tr key={row.identity}>
									<Table.Td
										ff="monospace"
										maw={CELL_WIDTH}
										title={row.identity}
										style={CELL_STYLE}
									>
										{row.identity}
									</Table.Td>
									{result.columns.map((column) => (
										<Table.Td
											key={column}
											maw={CELL_WIDTH}
											title={row.values[column]}
											style={CELL_STYLE}
										>
											{row.values[column] ?? ""}
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

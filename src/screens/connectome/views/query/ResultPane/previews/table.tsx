import { Box, Center, Divider, Group, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { isArray, isObject } from "radash";
import { useLayoutEffect, useMemo } from "react";
import { DataTable } from "~/components/DataTable";
import { Pagination } from "~/components/Pagination";
import { usePagination } from "~/components/Pagination/hook";
import { useSetting } from "~/hooks/config";
import { nativeQueryTable } from "../../../../../../rrflow/client/query-presentation";
import { Icon, iconTable } from "../../../../../../rrflow/ui/index";
import type { PreviewProps } from ".";

export function TablePreview({ responses, selected }: PreviewProps) {
	const { success, result } = responses[selected] ?? { result: null };
	const [editorScale] = useSetting("appearance", "editorScale");

	const native = useMemo(() => nativeQueryTable(result), [result]);
	const results: any[] = useMemo(() => (isArray(result) ? result : []), [result]);
	const pagination = usePagination();
	const rowCount = native?.rows.length ?? results.length;

	const textSize = Math.floor(15 * (editorScale / 100));
	const startAt = (pagination.currentPage - 1) * pagination.pageSize;
	const pageSlice = results.slice(startAt, startAt + pagination.pageSize);
	const nativePage = native?.rows.slice(startAt, startAt + pagination.pageSize);

	const isValid = useMemo(() => {
		return native !== null || (results.length > 0 && results.every((r) => isObject(r)));
	}, [native, results]);

	useLayoutEffect(() => {
		pagination.setTotal(rowCount);
	}, [pagination.setTotal, rowCount]);

	return success ? (
		isValid ? (
			<Stack
				flex={1}
				gap="xs"
				align="center"
			>
				<Box
					w="100%"
					flex={1}
					pos="relative"
				>
					{native ? (
						<ScrollArea
							h="100%"
							scrollbars="xy"
						>
							<Table
								striped
								highlightOnHover
								aria-label="RRFlow query rows"
							>
								<Table.Thead>
									<Table.Tr>
										{native.columns.map((column) => (
											<Table.Th key={column}>{column}</Table.Th>
										))}
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{nativePage?.map((row, index) => (
										<Table.Tr key={`${startAt + index}:${row.identity}`}>
											{row.cells.map((cell, cellIndex) => (
												<Table.Td key={native.columns[cellIndex]}>
													<Text
														size="sm"
														style={{
															whiteSpace: "pre-wrap",
															userSelect: "text",
														}}
													>
														{cell ?? "—"}
													</Text>
												</Table.Td>
											))}
										</Table.Tr>
									))}
									{native.rows.length === 0 && (
										<Table.Tr>
											<Table.Td colSpan={Math.max(1, native.columns.length)}>
												<Text
													size="sm"
													c="dimmed"
												>
													No rows returned
												</Text>
											</Table.Td>
										</Table.Tr>
									)}
								</Table.Tbody>
							</Table>
						</ScrollArea>
					) : (
						<DataTable data={pageSlice} />
					)}
				</Box>
				{native && (
					<Text
						size="xs"
						c="dimmed"
					>
						{native.returnedRows} returned rows · read at cursor {native.knownAtCursor}
						{native.truncated ? " · response truncated" : ""}
					</Text>
				)}

				<Divider w="100%" />

				{rowCount > 0 && (
					<Group>
						<Pagination store={pagination} />
					</Group>
				)}
			</Stack>
		) : (
			<Center
				h="100%"
				mih={80}
				c="obsidian"
			>
				<Stack>
					<Icon
						path={iconTable}
						mx="auto"
						size="lg"
					/>
					This response cannot be displayed as a table
				</Stack>
			</Center>
		)
	) : (
		<Text
			pl="md"
			pt="sm"
			fz={textSize}
			c="red"
			ff="mono"
			style={{ whiteSpace: "pre-wrap", userSelect: "text" }}
		>
			{result}
		</Text>
	);
}

import { Badge, Paper, ScrollArea, Stack, Table, Text } from "@mantine/core";
import type { RrdEngramOperationView } from "~/rrflow/session";
import { formatCount, formatTime } from "../utils/format";
import { Digest, Line, stateColor } from "./instances";

/** Newest first by creation, then by last update; the engine's order breaks ties. */
function newestFirst(operations: RrdEngramOperationView[]): RrdEngramOperationView[] {
	return [...operations].sort(
		(a, b) =>
			b.created_at_unix_ms - a.created_at_unix_ms ||
			b.updated_at_unix_ms - a.updated_at_unix_ms,
	);
}

/** The lifecycle operations the engine recorded, as the engram's history. */
export function Operations({ operations }: { operations: RrdEngramOperationView[] }) {
	if (operations.length === 0) {
		return <Text c="slate">The engine returned zero recorded operations for this engram.</Text>;
	}
	return (
		<Paper p="md">
			<ScrollArea>
				<Table
					verticalSpacing="sm"
					miw={1100}
				>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Operation</Table.Th>
							<Table.Th>State</Table.Th>
							<Table.Th>Created</Table.Th>
							<Table.Th>Last updated</Table.Th>
							<Table.Th>Target instance</Table.Th>
							<Table.Th>Worker lease</Table.Th>
							<Table.Th>Receipts</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{newestFirst(operations).map((operation) => (
							<Table.Tr
								key={operation.id}
								style={{ verticalAlign: "top" }}
							>
								<Table.Td>
									<Stack gap={2}>
										<Text fw={650}>{operation.kind}</Text>
										<Text
											ff="monospace"
											fz="sm"
										>
											{operation.id}
										</Text>
										<Line label="request">
											<Digest value={operation.request_sha256} />
										</Line>
									</Stack>
								</Table.Td>
								<Table.Td>
									<Stack gap={2}>
										<Badge
											variant="light"
											color={stateColor(operation.state)}
										>
											{operation.state}
										</Badge>
										<Line label="attempts">
											{formatCount(operation.attempts)}
										</Line>
										{operation.error && (
											<Text
												fz="sm"
												c="red"
											>
												{operation.error}
											</Text>
										)}
									</Stack>
								</Table.Td>
								<Table.Td>{formatTime(operation.created_at_unix_ms)}</Table.Td>
								<Table.Td>{formatTime(operation.updated_at_unix_ms)}</Table.Td>
								<Table.Td>
									<Stack gap={2}>
										<Text
											ff="monospace"
											fz="sm"
										>
											{operation.instance_id}
										</Text>
										<Line label="for generation">
											{formatCount(operation.desired_generation)}
										</Line>
									</Stack>
								</Table.Td>
								<Table.Td>
									{operation.lease ? (
										<Stack gap={2}>
											<Text
												ff="monospace"
												fz="sm"
											>
												{operation.lease.owner}
											</Text>
											<Line label="epoch">
												{formatCount(operation.lease.epoch)}
											</Line>
											<Line label="taken">
												{formatTime(operation.lease.acquired_at_unix_ms)}
											</Line>
											<Line label="expires">
												{formatTime(operation.lease.expires_at_unix_ms)}
											</Line>
										</Stack>
									) : (
										<Text
											fz="sm"
											c="slate"
										>
											none held
										</Text>
									)}
								</Table.Td>
								<Table.Td>
									{operation.receipts.length === 0 ? (
										<Text
											fz="sm"
											c="slate"
										>
											none recorded
										</Text>
									) : (
										<Stack gap={2}>
											{operation.receipts.map((receipt) => (
												<Text
													key={`${receipt.boundary}-${receipt.lease_epoch}-${receipt.at_unix_ms}`}
													fz="sm"
												>
													<Badge
														size="sm"
														variant="outline"
														color={stateColor(receipt.boundary)}
													>
														{receipt.boundary}
													</Badge>{" "}
													{formatTime(receipt.at_unix_ms)} · epoch{" "}
													{formatCount(receipt.lease_epoch)} ·{" "}
													<Digest value={receipt.evidence_sha256} />
												</Text>
											))}
										</Stack>
									)}
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Paper>
	);
}

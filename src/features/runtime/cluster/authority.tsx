import { Badge, Paper, ScrollArea, Stack, Table, Text } from "@mantine/core";
import type {
	RrdEngramAuthorityReceiptView,
	RrdEngramAuthorityResourceView,
} from "~/rrflow/session";
import { formatCount, formatTime } from "../utils/format";
import { Digest, Line, stateColor } from "./instances";

/** A list of ids, or the plain fact that the engine listed none. */
function ids(values: string[]): string {
	return values.length === 0 ? "none" : values.join(", ");
}

/** The resources this engram is the authority for. */
export function AuthorityResources({ resources }: { resources: RrdEngramAuthorityResourceView[] }) {
	if (resources.length === 0) {
		return (
			<Text
				c="slate"
				mt="md"
			>
				The engine returned zero authority resources for this engram.
			</Text>
		);
	}
	return (
		<Paper
			p="md"
			mt="md"
		>
			<Text
				fw={650}
				mb="xs"
			>
				Resources
			</Text>
			<ScrollArea>
				<Table
					verticalSpacing="sm"
					miw={980}
				>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>Resource</Table.Th>
							<Table.Th>Belongs to</Table.Th>
							<Table.Th>Asked for</Table.Th>
							<Table.Th>Last observed</Table.Th>
							<Table.Th>Created / updated</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{resources.map((resource) => (
							<Table.Tr
								key={resource.id}
								style={{ verticalAlign: "top" }}
							>
								<Table.Td>
									<Stack gap={2}>
										<Text fw={650}>{resource.name}</Text>
										<Badge
											size="sm"
											variant="outline"
										>
											{resource.kind}
										</Badge>
										<Text
											ff="monospace"
											fz="sm"
										>
											{resource.id}
										</Text>
										<Line label="spec">
											<Digest value={resource.spec_sha256} />
										</Line>
									</Stack>
								</Table.Td>
								<Table.Td>
									<Stack gap={2}>
										<Line label="parents">{ids(resource.parent_ids)}</Line>
										<Line label="secret references">
											{ids(resource.secret_reference_ids)}
										</Line>
									</Stack>
								</Table.Td>
								<Table.Td>
									{resource.desired ? (
										<Stack gap={2}>
											<Line label="generation">
												{formatCount(resource.desired.generation)}
											</Line>
											<Line label="spec">
												<Digest value={resource.desired.spec_sha256} />
											</Line>
											<Line label="asked">
												{formatTime(resource.desired.updated_at_unix_ms)}
											</Line>
										</Stack>
									) : (
										<Text
											fz="sm"
											c="slate"
										>
											nothing recorded
										</Text>
									)}
								</Table.Td>
								<Table.Td>
									{resource.observed ? (
										<Stack gap={2}>
											<Badge
												variant="light"
												color={stateColor(resource.observed.status)}
											>
												{resource.observed.status}
											</Badge>
											<Line label="generation">
												{formatCount(resource.observed.generation)}
											</Line>
											<Line label="evidence">
												<Digest value={resource.observed.evidence_sha256} />
											</Line>
											<Line label="observed">
												{formatTime(resource.observed.observed_at_unix_ms)}
											</Line>
											{resource.observed.error && (
												<Text
													fz="sm"
													c="red"
												>
													{resource.observed.error}
												</Text>
											)}
										</Stack>
									) : (
										<Text
											fz="sm"
											c="slate"
										>
											nothing recorded
										</Text>
									)}
								</Table.Td>
								<Table.Td>
									<Stack gap={2}>
										<Line label="created">
											{formatTime(resource.created_at_unix_ms)}
										</Line>
										<Line label="updated">
											{formatTime(resource.updated_at_unix_ms)}
										</Line>
									</Stack>
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Paper>
	);
}

/** The receipts the engine kept for authority changes, newest first. */
export function AuthorityReceipts({ receipts }: { receipts: RrdEngramAuthorityReceiptView[] }) {
	if (receipts.length === 0) {
		return (
			<Text
				c="slate"
				mt="md"
			>
				The engine returned zero authority receipts for this engram.
			</Text>
		);
	}
	const ordered = [...receipts].sort((a, b) => b.at_unix_ms - a.at_unix_ms);
	return (
		<Paper
			p="md"
			mt="md"
		>
			<Text
				fw={650}
				mb="xs"
			>
				Receipts
			</Text>
			<ScrollArea>
				<Table
					verticalSpacing="xs"
					miw={980}
				>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>When</Table.Th>
							<Table.Th>Step reached</Table.Th>
							<Table.Th>Resource</Table.Th>
							<Table.Th>Operation</Table.Th>
							<Table.Th>Lease epoch</Table.Th>
							<Table.Th>Receipt</Table.Th>
							<Table.Th>Evidence</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{ordered.map((receipt) => (
							<Table.Tr key={receipt.id}>
								<Table.Td>{formatTime(receipt.at_unix_ms)}</Table.Td>
								<Table.Td>
									<Badge
										variant="light"
										color={stateColor(receipt.boundary)}
									>
										{receipt.boundary}
									</Badge>
								</Table.Td>
								<Table.Td ff="monospace">{receipt.resource_id}</Table.Td>
								<Table.Td ff="monospace">{receipt.operation_id}</Table.Td>
								<Table.Td>{formatCount(receipt.lease_epoch)}</Table.Td>
								<Table.Td ff="monospace">{receipt.id}</Table.Td>
								<Table.Td>
									<Digest value={receipt.evidence_sha256} />
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			</ScrollArea>
		</Paper>
	);
}

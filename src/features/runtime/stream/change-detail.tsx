import { Badge, Button, Group, Paper, Stack, Table, Text } from "@mantine/core";
import type { RrdChangeView } from "~/rrflow/session";
import { formatCount, formatTime, shortDigest } from "../utils/format";

/** A `put_record` change names its record as `kind:id`, which the graph selects by. */
export function namesRecord(change: RrdChangeView): boolean {
	return change.family === "data" && change.mutation.operation === "put_record";
}

/** Every field the engine recorded for one change. */
export function ChangeDetail({
	change,
	onOpenRecord,
}: {
	change: RrdChangeView;
	onOpenRecord: (record: string) => void;
}) {
	const { mutation } = change;
	const properties = Object.entries(mutation.properties);
	return (
		<Paper
			withBorder
			p="md"
		>
			<Stack gap="sm">
				<Group
					justify="space-between"
					align="flex-start"
				>
					<Group gap="xs">
						<Text fw={700}>Change at cursor {formatCount(change.cursor)}</Text>
						<Badge>{mutation.operation}</Badge>
						<Badge variant="outline">{change.family}</Badge>
					</Group>
					{namesRecord(change) && (
						<Button
							variant="light"
							size="xs"
							onClick={() => onOpenRecord(mutation.target)}
						>
							Open this record in the graph
						</Button>
					)}
				</Group>
				<Table
					withRowBorders={false}
					verticalSpacing={4}
				>
					<Table.Tbody>
						<Field label="What it touched">
							<Text
								ff="monospace"
								size="sm"
								style={{ overflowWrap: "anywhere" }}
							>
								{mutation.target}
							</Text>
						</Field>
						{mutation.subject !== null && (
							<Field label="Attached to">
								<Text
									ff="monospace"
									size="sm"
									style={{ overflowWrap: "anywhere" }}
								>
									{mutation.subject}
								</Text>
							</Field>
						)}
						<Field label="When">{formatTime(change.at_unix_ms)}</Field>
						<Field label="Who">{change.actor}</Field>
						<Field label="Commit">
							<Text
								span
								ff="monospace"
								size="sm"
								title={change.commit_sha256}
							>
								{shortDigest(change.commit_sha256)}
							</Text>
							, position {formatCount(change.commit_ordinal)} in that commit
						</Field>
						<Field label="Change digest">
							<Text
								span
								ff="monospace"
								size="sm"
								title={change.change_sha256}
							>
								{shortDigest(change.change_sha256)}
							</Text>
						</Field>
						{change.previous_change_sha256 !== null && (
							<Field label="Follows change">
								<Text
									span
									ff="monospace"
									size="sm"
									title={change.previous_change_sha256}
								>
									{shortDigest(change.previous_change_sha256)}
								</Text>
							</Field>
						)}
					</Table.Tbody>
				</Table>
				<Text
					size="sm"
					fw={600}
				>
					{properties.length === 0
						? "This change carried zero values."
						: "Values this change wrote"}
				</Text>
				{properties.length > 0 && (
					<Table verticalSpacing={4}>
						<Table.Tbody>
							{properties.map(([name, value]) => (
								<Table.Tr key={name}>
									<Table.Td w={200}>
										<Text
											ff="monospace"
											size="sm"
										>
											{name}
										</Text>
									</Table.Td>
									<Table.Td>
										<Text
											size="sm"
											style={{
												whiteSpace: "pre-wrap",
												overflowWrap: "anywhere",
											}}
										>
											{value}
										</Text>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				)}
			</Stack>
		</Paper>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<Table.Tr>
			<Table.Td w={160}>
				<Text
					size="sm"
					c="dimmed"
				>
					{label}
				</Text>
			</Table.Td>
			<Table.Td>
				<Text
					size="sm"
					component="div"
				>
					{children}
				</Text>
			</Table.Td>
		</Table.Tr>
	);
}

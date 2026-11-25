import { Badge, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import type { RrdFlightReadCounts, RrdPromptFlightDetailView } from "~/rrflow/session";
import { Stat } from "../components/stat";
import { formatCount } from "../utils/format";

function ReadCounts({ reads }: { reads: RrdFlightReadCounts }) {
	return (
		<SimpleGrid cols={{ base: 2, md: 3 }}>
			<Stat
				label="Keys examined / budget"
				value={`${formatCount(reads.keys_examined)} / ${formatCount(reads.key_budget)}`}
			/>
			<Stat
				label="Point reads"
				value={formatCount(reads.point_reads)}
			/>
			<Stat
				label="Range scans"
				value={formatCount(reads.range_scans)}
			/>
			<Stat
				label="Values decoded"
				value={formatCount(reads.values_decoded)}
			/>
			<Stat
				label="Bytes decoded"
				value={formatCount(reads.decoded_bytes)}
			/>
		</SimpleGrid>
	);
}

export function FlightMeasurements({ flight }: { flight: RrdPromptFlightDetailView }) {
	return (
		<Paper
			component="section"
			aria-label="Engine measurements"
			withBorder
			p="md"
			mb="md"
		>
			<Stack gap="sm">
				<Group justify="space-between">
					<Title order={5}>Engine measurements</Title>
					<Badge variant="light">{flight.provider}</Badge>
				</Group>
				<Text
					size="xs"
					c="dimmed"
					style={{ overflowWrap: "anywhere" }}
				>
					{flight.scope} · {flight.flight_id}
				</Text>
				<SimpleGrid cols={{ base: 2, md: 3 }}>
					<Stat
						label="Preparation time"
						value={`${formatCount(flight.elapsed_ms)} ms`}
					/>
					<Stat
						label="Retrieval cursor"
						value={formatCount(flight.retrieval_cursor)}
					/>
					<Stat
						label="Valid time (Unix ms)"
						value={String(flight.valid_at)}
					/>
				</SimpleGrid>
				<Text fw={650}>Context retrieval</Text>
				{flight.context_mode === "fresh" ? (
					<Text size="sm">Fresh mode withheld context.</Text>
				) : flight.context_reads ? (
					<ReadCounts reads={flight.context_reads} />
				) : (
					<Text size="sm">This flight has no recorded retrieval counters.</Text>
				)}
				{flight.stages.length > 0 && (
					<Table.ScrollContainer minWidth={480}>
						<Table aria-label="Retrieval decisions">
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Stage</Table.Th>
									<Table.Th>Decision</Table.Th>
									<Table.Th>Engine reason</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{flight.stages.map((stage) => (
									<Table.Tr key={stage.decision_sha256}>
										<Table.Td>
											{stage.kind}
											{stage.access_path && (
												<Text
													size="xs"
													c="dimmed"
												>
													{stage.access_path}
												</Text>
											)}
										</Table.Td>
										<Table.Td>{stage.status}</Table.Td>
										<Table.Td>{stage.reason}</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				)}
				{flight.uses.length > 0 && (
					<Table.ScrollContainer minWidth={400}>
						<Table aria-label="Ranked record sources">
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Packet rank</Table.Th>
									<Table.Th>Record source</Table.Th>
									<Table.Th>Matched by</Table.Th>
									<Table.Th>Score</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{flight.uses.map((use) => (
									<Table.Tr key={use.rank}>
										<Table.Td>{use.rank}</Table.Td>
										<Table.Td>
											{use.reference.kind}:{use.reference.id}
										</Table.Td>
										<Table.Td>{use.evidence.join(", ")}</Table.Td>
										<Table.Td>{use.score}</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					</Table.ScrollContainer>
				)}
				<details>
					<summary>
						Cost of reading this receipt · cursor {formatCount(flight.detail_cursor)}
					</summary>
					<ReadCounts reads={flight.detail_reads} />
				</details>
			</Stack>
		</Paper>
	);
}

import {
	Alert,
	Badge,
	Button,
	Group,
	Loader,
	Paper,
	ScrollArea,
	SimpleGrid,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { Icon, iconErrorCircle, iconRefresh } from "@rrflow/ui";
import { useQuery } from "@tanstack/react-query";
import { Section } from "~/components/Section";
import { formatCount, formatSize, formatTime, shortDigest } from "../format";
import { PhysicalStorage } from "../physical";
import { Stat } from "../stat";
import type { RuntimeLensProps } from "../types";

/** The Storage lens follows the live engine while it is open. */
const STORAGE_REFRESH_MS = 5_000;

export function StorageTab({ client, sessionKey }: RuntimeLensProps) {
	const storage = useQuery({
		queryKey: ["rrd-storage", sessionKey],
		queryFn: () => client.storage(),
		refetchInterval: STORAGE_REFRESH_MS,
	});

	if (storage.isPending) {
		return (
			<Group justify="center">
				<Loader />
			</Group>
		);
	}

	if (storage.isError) {
		return (
			<Alert
				color="red"
				title="Storage read failed"
				icon={<Icon path={iconErrorCircle} />}
			>
				{storage.error instanceof Error ? storage.error.message : "Unknown RRD error"}
			</Alert>
		);
	}

	const view = storage.data;

	return (
		<Stack gap="xl">
			<Section
				title={`Storage · ${view.storage_profile}`}
				description={`Commit, retention, and artifact state observed ${formatTime(view.observed_at_unix_ms)}; refreshes every ${STORAGE_REFRESH_MS / 1000} s.`}
				rightSection={
					<Button
						variant="light"
						size="xs"
						leftSection={<Icon path={iconRefresh} />}
						loading={storage.isFetching}
						onClick={() => storage.refetch()}
					>
						Refresh
					</Button>
				}
			>
				<SimpleGrid cols={{ base: 2, md: 4, xl: 6 }}>
					<Stat
						label="Backend"
						value={view.backend}
					/>
					<Stat
						label="Runtime cursor"
						value={formatCount(view.runtime_cursor)}
					/>
					<Stat
						label="Change head"
						value={formatCount(view.change_head_cursor)}
					/>
					<Stat
						label="Oldest retained"
						value={formatCount(view.oldest_retained_cursor)}
					/>
					<Stat
						label="Claim sequence"
						value={formatCount(view.claim_sequence)}
					/>
					<Stat
						label="Control sequence"
						value={formatCount(view.control_sequence)}
					/>
					<Stat
						label="Catalogue revision"
						value={formatCount(view.catalogue_revision)}
					/>
					<Stat
						label="Schema revision"
						value={formatCount(view.schema_revision)}
					/>
					<Stat
						label="Retention leases"
						value={formatCount(view.retention_leases)}
					/>
					<Stat
						label="Retention pins"
						value={formatCount(view.retention_pins)}
					/>
					<Stat
						label="Audit through"
						value={formatCount(view.audit_through_sequence)}
					/>
					<Stat
						label="Runtime manifest"
						value={shortDigest(view.runtime_manifest_sha256)}
						title={view.runtime_manifest_sha256}
					/>
				</SimpleGrid>
			</Section>

			<Section
				title="rrflowKV cache and storage engine"
				description={`Page cache, memtable, write-ahead log, segments, compaction, and segment I/O observed ${formatTime(view.physical.observed_at_unix_ms)}.`}
			>
				<PhysicalStorage view={view.physical} />
			</Section>

			<Section
				title="Vector artifacts"
				description="Published vector projections the engine serves search from."
			>
				<Paper p="md">
					{view.vector_artifacts.length === 0 ? (
						<Text c="slate">No vector artifacts are published.</Text>
					) : (
						<ScrollArea.Autosize mah={360}>
							<Table
								fz="sm"
								striped
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Kind</Table.Th>
										<Table.Th>Projection</Table.Th>
										<Table.Th>Generation</Table.Th>
										<Table.Th>Source cursor</Table.Th>
										<Table.Th>Size</Table.Th>
										<Table.Th>Media type</Table.Th>
										<Table.Th>Published</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{view.vector_artifacts.map((artifact) => (
										<Table.Tr
											key={`${artifact.kind}:${artifact.projection_id}:${artifact.generation}`}
										>
											<Table.Td>
												<Badge variant="light">{artifact.kind}</Badge>
											</Table.Td>
											<Table.Td ff="monospace">
												{artifact.projection_id}
											</Table.Td>
											<Table.Td>{formatCount(artifact.generation)}</Table.Td>
											<Table.Td>
												{formatCount(artifact.source_cursor)}
											</Table.Td>
											<Table.Td>
												{formatSize(artifact.object_length)}
											</Table.Td>
											<Table.Td ff="monospace">
												{artifact.media_type}
											</Table.Td>
											<Table.Td>
												{formatTime(artifact.published_at_unix_ms)}
											</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</ScrollArea.Autosize>
					)}
				</Paper>
			</Section>

			<Section
				title="Query indexes"
				description="Secondary indexes maintained for RRFlowQL."
			>
				<Paper p="md">
					{view.query_indexes.length === 0 ? (
						<Text c="slate">No query indexes are defined.</Text>
					) : (
						<Table
							fz="sm"
							striped
						>
							<Table.Thead>
								<Table.Tr>
									<Table.Th>Index</Table.Th>
									<Table.Th>Kind</Table.Th>
									<Table.Th>State</Table.Th>
									<Table.Th>Generation</Table.Th>
									<Table.Th>Rows</Table.Th>
									<Table.Th>Definition</Table.Th>
								</Table.Tr>
							</Table.Thead>
							<Table.Tbody>
								{view.query_indexes.map((index) => (
									<Table.Tr key={index.index_id}>
										<Table.Td ff="monospace">{index.index_id}</Table.Td>
										<Table.Td>{index.kind}</Table.Td>
										<Table.Td>
											<Badge variant="light">{index.state}</Badge>
										</Table.Td>
										<Table.Td>{formatCount(index.generation)}</Table.Td>
										<Table.Td>{formatCount(index.artifact_rows)}</Table.Td>
										<Table.Td
											ff="monospace"
											fz="xs"
										>
											{index.definition_query}
										</Table.Td>
									</Table.Tr>
								))}
							</Table.Tbody>
						</Table>
					)}
				</Paper>
			</Section>
		</Stack>
	);
}

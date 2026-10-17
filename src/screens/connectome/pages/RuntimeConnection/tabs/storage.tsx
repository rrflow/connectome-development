import {
	Alert,
	Badge,
	Button,
	Collapse,
	Group,
	Loader,
	Paper,
	ScrollArea,
	SimpleGrid,
	Stack,
	Table,
	Text,
} from "@mantine/core";
import { Icon, iconChevronDown, iconChevronUp, iconErrorCircle, iconRefresh } from "@surrealdb/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Section } from "~/components/Section";
import { formatCount, formatSize, formatTime, shortDigest } from "../format";
import { Term } from "../glossary";
import { ReadNotice } from "../notice";
import { PhysicalStorage } from "../physical";
import { StoragePipeline } from "../pipeline";
import { busyRetry } from "../queries";
import { Stat } from "../stat";
import type { RuntimeLensProps } from "../types";

/** The Storage lens follows the live engine while it is open. */
const STORAGE_REFRESH_MS = 5_000;

export function StorageTab({ client, sessionKey }: RuntimeLensProps) {
	const storage = useQuery({
		queryKey: ["rrd-storage", sessionKey],
		queryFn: () => client.storage(),
		refetchInterval: STORAGE_REFRESH_MS,
		...busyRetry,
	});
	const [countersOpen, setCountersOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);

	if (storage.isPending) {
		return (
			<Stack align="center">
				<Loader />
				<ReadNotice query={storage} />
			</Stack>
		);
	}

	if (!storage.data) {
		return (
			<Alert
				color="red"
				title="The storage engine could not be read"
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
				title={
					<>
						Storage engine ·{" "}
						{view.physical.profile === "rrflow_kv" ? (
							<Term id="rrflowKV">rrflowKV</Term>
						) : (
							view.physical.profile
						)}
					</>
				}
				description={`How the engine keeps this estate safe on disk and quick to read. Live: refreshes every ${STORAGE_REFRESH_MS / 1000} s; last read ${formatTime(view.physical.observed_at_unix_ms)}.`}
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
				<ReadNotice
					query={storage}
					observedAt={view.physical.observed_at_unix_ms}
				/>
				<StoragePipeline view={view.physical} />
				<Group>
					<Button
						variant="subtle"
						size="compact-sm"
						rightSection={
							<Icon path={countersOpen ? iconChevronUp : iconChevronDown} />
						}
						onClick={() => setCountersOpen((open) => !open)}
					>
						{countersOpen ? "Hide every engine counter" : "Show every engine counter"}
					</Button>
				</Group>
				<Collapse in={countersOpen}>
					<PhysicalStorage view={view.physical} />
				</Collapse>
			</Section>

			<Section
				title="History, retention, and indexes"
				description={
					<>
						Where the estate's history stands: the <Term id="cursor">cursor</Term> of
						the latest change, what is retained, and the derived indexes the engine
						serves.
					</>
				}
				rightSection={
					<Button
						variant="light"
						size="xs"
						rightSection={<Icon path={historyOpen ? iconChevronUp : iconChevronDown} />}
						onClick={() => setHistoryOpen((open) => !open)}
					>
						{historyOpen ? "Hide details" : "Show details"}
					</Button>
				}
			>
				<Collapse in={historyOpen}>
					<Stack gap="xl">
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
															<Badge variant="light">
																{artifact.kind}
															</Badge>
														</Table.Td>
														<Table.Td ff="monospace">
															{artifact.projection_id}
														</Table.Td>
														<Table.Td>
															{formatCount(artifact.generation)}
														</Table.Td>
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
															{formatTime(
																artifact.published_at_unix_ms,
															)}
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
													<Table.Td ff="monospace">
														{index.index_id}
													</Table.Td>
													<Table.Td>{index.kind}</Table.Td>
													<Table.Td>
														<Badge variant="light">{index.state}</Badge>
													</Table.Td>
													<Table.Td>
														{formatCount(index.generation)}
													</Table.Td>
													<Table.Td>
														{formatCount(index.artifact_rows)}
													</Table.Td>
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
				</Collapse>
			</Section>
		</Stack>
	);
}

import { Alert, Badge, Box, Button, Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { describeRrdError } from "~/rrflow/runtime";
import { iconErrorCircle, iconRefresh } from "~/shared/assets/icons";
import { plural } from "~/shared/util/text/helpers";
import { busyRetry } from "../api/queries";
import { Term } from "../components/glossary";
import { ReadNotice } from "../components/notice";
import { Section } from "../components/Section";
import { Stat } from "../components/stat";
import { useProject } from "../project/context";
import { formatCount, formatSpan, formatTime, shortDigest } from "../utils/format";
import { AuthorityReceipts, AuthorityResources } from "./authority";
import { Instances } from "./instances";
import { Operations } from "./operations";

/** The view follows the engine while it is open. */
const CLUSTER_REFRESH_MS = 10_000;

/**
 * The engram's own record of the engines that serve it and of every lifecycle
 * operation recorded for them. The engine contract still names this record
 * "estate"; Connectome presents it as an engram.
 */
export function ClusterView() {
	const { session, client, sessionKey, handshake } = useProject();
	const engram = useQuery({
		queryKey: ["rrd-engram", sessionKey],
		queryFn: () => client.engram(),
		enabled: Boolean(session),
		refetchInterval: CLUSTER_REFRESH_MS,
		...busyRetry,
	});

	if (!session) return null;

	const view = engram.data;
	/** The engine's capability document answered and names no installed engram. */
	const notInstalled = handshake !== undefined && !handshake.service.installed_estate;

	return (
		<Stack gap="xl">
			<Group align="flex-start">
				<Box flex={1}>
					<PrimaryTitle fz={26}>Cluster history</PrimaryTitle>
					<Text
						fz="lg"
						mt="xs"
					>
						An <Term id="engram">engram</Term> is served by one or more engine
						instances. This is the engram's own record of those instances and of every
						start, stop, restart and upgrade recorded for them, newest first.
					</Text>
				</Box>
				<Button
					variant="light"
					leftSection={<Icon path={iconRefresh} />}
					loading={engram.isFetching}
					onClick={() => engram.refetch()}
				>
					Read again
				</Button>
			</Group>

			<ReadNotice query={engram} />

			{engram.isPending && (
				<Stack align="center">
					<Loader />
					<Text c="slate">Asking the engine for this engram's record.</Text>
				</Stack>
			)}

			{engram.isError && !view && (
				<Alert
					color="red"
					title={
						notInstalled
							? "This engine reports no installed engram"
							: "The engine did not return this engram's record"
					}
					icon={<Icon path={iconErrorCircle} />}
				>
					{describeRrdError(engram.error)}
				</Alert>
			)}

			{view && (
				<>
					<Section
						title="This engram"
						description={`Read from the engine every ${CLUSTER_REFRESH_MS / 1000} s. The revision goes up by one each time this record changes.`}
					>
						<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
							<Stat
								label="Engram id"
								value={view.id}
							/>
							<Stat
								label="Engram revision"
								value={formatCount(view.revision)}
							/>
							<Stat
								label="Created"
								value={formatTime(view.created_at_unix_ms)}
							/>
							<Stat
								label="Last updated"
								value={formatTime(view.updated_at_unix_ms)}
							/>
							<Stat
								label="Record format version"
								value={view.format_version}
							/>
							<Stat
								label="Repeat-safe requests remembered"
								value={formatCount(view.idempotency_binding_count)}
								title="idempotency_binding_count: requests the engine can recognise if they are sent again"
							/>
						</SimpleGrid>
						<Text
							fz="sm"
							c="slate"
							mt="sm"
						>
							Activity policy: an instance counts as idle after{" "}
							{formatSpan(view.activity_policy.idle_after_ms)} without activity, stale
							after {formatSpan(view.activity_policy.stale_after_ms)}, and neglected
							after {formatSpan(view.activity_policy.neglected_after_ms)}.
						</Text>
					</Section>

					<Section
						title="This engram's instances"
						description="Each engine instance: what was asked of it, what was last observed, and how recently it was active."
						rightSection={
							<Badge variant="light">
								{formatCount(view.instances.length)}{" "}
								{plural(view.instances.length, "instance")}
							</Badge>
						}
					>
						<Instances instances={view.instances} />
					</Section>

					<Section
						title="History"
						description="Every lifecycle operation the engine recorded for these instances, newest first by when it was created."
						rightSection={
							<Badge variant="light">
								{formatCount(view.operations.length)}{" "}
								{plural(view.operations.length, "operation")}
							</Badge>
						}
					>
						<Operations operations={view.operations} />
					</Section>

					<Section
						title="Authority"
						description="The catalogue of resources this engram is responsible for, and the receipts the engine kept for changes to them."
					>
						<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
							<Stat
								label="Catalogue digest"
								value={shortDigest(view.authority.catalogue_sha256)}
								title={view.authority.catalogue_sha256}
							/>
							<Stat
								label="Resources"
								value={formatCount(view.authority.resources.length)}
							/>
							<Stat
								label="Receipts"
								value={formatCount(view.authority.receipts.length)}
							/>
							<Stat
								label="Repeat-safe requests remembered"
								value={formatCount(view.authority.idempotency_binding_count)}
								title="authority.idempotency_binding_count"
							/>
						</SimpleGrid>
						<AuthorityResources resources={view.authority.resources} />
						<AuthorityReceipts receipts={view.authority.receipts} />
					</Section>
				</>
			)}
		</Stack>
	);
}

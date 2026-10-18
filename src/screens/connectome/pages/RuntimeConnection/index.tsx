import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	Progress,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import {
	Icon,
	iconBook,
	iconErrorCircle,
	iconMemory,
	iconRefresh,
	iconRelation,
	iconTarget,
} from "@surrealdb/ui";
import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { type ReactNode, useMemo, useState } from "react";
import { Redirect } from "wouter";
import { PageBreadcrumbs } from "~/components/PageBreadcrumbs";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import {
	ATTUNEMENT_ESTIMATE_MINUTES,
	ATTUNEMENT_PHASES,
	AUTOMATION_PRIMITIVES,
} from "~/rrflow/attunement";
import { describeRrdError, RrdRuntimeClient } from "~/rrflow/runtime";
import { RrdSessionClient } from "~/rrflow/session";
import { useConfigStore } from "~/shell/stores/config";
import { formatCount } from "./format";
import { GlossaryDrawer, Term } from "./glossary";
import { databaseQuery } from "./queries";
import { SESSION_QUERY_KEY, SessionPanel } from "./session";
import classes from "./style.module.scss";
import { RecordsTab } from "./tabs/records";
import { StorageTab } from "./tabs/storage";
import { VectorsTab } from "./tabs/vectors";
import type { RuntimeLens } from "./types";

interface LensCardProps {
	active: boolean;
	icon: string;
	title: string;
	purpose: string;
	reading: ReactNode;
	onOpen: () => void;
}

function LensCard({ active, icon, title, purpose, reading, onOpen }: LensCardProps) {
	return (
		<UnstyledButton
			onClick={onOpen}
			aria-pressed={active}
		>
			<Paper
				p="md"
				h="100%"
				className={classes.lens}
				data-active={active || undefined}
			>
				<Group
					gap="sm"
					wrap="nowrap"
					align="flex-start"
				>
					<Box
						c={active ? "violet" : "slate"}
						mt={2}
					>
						<Icon path={icon} />
					</Box>
					<Box miw={0}>
						<Text
							fw={700}
							c="bright"
						>
							{title}
						</Text>
						<Text
							fz="sm"
							c="slate"
						>
							{purpose}
						</Text>
						<Text
							fz="sm"
							fw={600}
							mt={6}
						>
							{reading}
						</Text>
					</Box>
				</Group>
			</Paper>
		</UnstyledButton>
	);
}

export function RuntimeConnectionPage({ id }: { id: string }) {
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === id),
	);
	const endpoint = connection
		? `${connection.authentication.protocol}://${connection.authentication.hostname}`
		: "";
	const client = useMemo(
		() => new RrdRuntimeClient(endpoint, connection?.runtimeInstance),
		[connection?.runtimeInstance, endpoint],
	);
	const query = useQuery({
		queryKey: ["rrd-runtime-handshake", id, endpoint, connection?.runtimeInstance],
		enabled: Boolean(connection && connection.target === "runtime"),
		queryFn: () => client.handshake(),
		retry: false,
	});
	const sessionClient = useMemo(() => new RrdSessionClient(), []);
	const nativeSession = useQuery({
		queryKey: SESSION_QUERY_KEY,
		enabled: isTauri(),
		queryFn: () => sessionClient.current(),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [lens, setLens] = useState<RuntimeLens>("records");
	const [selected, setSelected] = useState<string | null>(null);
	const [colorBy, setColorBy] = useState("cluster");
	const [showIdentity, setShowIdentity] = useState(false);
	const [glossaryOpen, setGlossaryOpen] = useState(false);

	const handshake = query.data;
	const current = nativeSession.data ?? null;
	const ownsSession =
		current !== null &&
		handshake !== undefined &&
		current.endpoint === endpoint &&
		current.instance === handshake.service.instance.id;
	const session = ownsSession ? current : null;
	const foreign = ownsSession ? null : current;
	const sessionKey = session ? `${session.instance}:${session.connected_at_unix_ms}` : "";

	// The lens cards read the same cached snapshots the lenses render.
	const database = useQuery({
		...databaseQuery(sessionClient, sessionKey),
		enabled: Boolean(session),
	});
	const catalogue = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		enabled: Boolean(session),
		queryFn: () => sessionClient.vectorCollections(),
	});

	if (connection?.target !== "runtime") {
		return <Redirect to="/overview" />;
	}

	// With a live session the lenses lead; the handshake evidence stays one click away.
	const identityVisible = !session || showIdentity;
	const stages = [
		{
			label: "HTTP transport",
			detail: handshake ? `Responded at ${handshake.endpoint}` : "Awaiting liveness response",
		},
		{
			label: "Engine readiness",
			detail: handshake
				? `Cursor ${handshake.readiness.runtime_cursor} on ${handshake.readiness.backend}`
				: "Awaiting ready response",
		},
		{
			label: "RRD protocol + identity",
			detail: handshake
				? `${handshake.service.instance.id} · rrd v${handshake.service.protocol_version}`
				: "Awaiting capability negotiation",
		},
	];
	const graph = database.data?.graph;
	const collections = catalogue.data?.collections;
	const namedVectors =
		collections?.reduce((count, collection) => count + collection.vectors.length, 0) ?? 0;
	const storageProfile = session?.service.storage_profile;
	const lensProps = {
		client: sessionClient,
		sessionKey,
		selected,
		onSelect: setSelected,
		colorBy,
		onColorBy: setColorBy,
		onOpenLens: setLens,
	};

	return (
		<Box
			flex={1}
			pos="relative"
		>
			<ScrollArea
				pos="absolute"
				inset={0}
				type="scroll"
				scrollbars="y"
			>
				<Stack
					px="xl"
					py="lg"
					mx="auto"
					maw={1400}
					pb={72}
				>
					<PageBreadcrumbs
						items={[
							{ label: "Connectome", href: "/overview" },
							{ label: "RRD runtimes" },
							{ label: connection.name },
						]}
					/>

					<Group
						align="flex-start"
						justify="space-between"
					>
						<Box>
							<Badge
								variant="dot"
								color={handshake ? "green" : query.isError ? "red" : "gray"}
							>
								{handshake
									? "RRD connected"
									: query.isError
										? "Rejected"
										: "Negotiating"}
							</Badge>
							<PrimaryTitle
								fz={32}
								mt="xs"
							>
								{connection.name}
							</PrimaryTitle>
							<Group
								gap={6}
								mt={4}
							>
								<Text
									ff="monospace"
									fz="sm"
								>
									{handshake?.service.instance.id ?? "instance not confirmed"}
								</Text>
								<Text
									fz="sm"
									c="slate"
								>
									· {endpoint}
								</Text>
							</Group>
						</Box>
						<Group gap="xs">
							<Button
								variant="subtle"
								color="obsidian"
								leftSection={<Icon path={iconBook} />}
								onClick={() => setGlossaryOpen(true)}
							>
								What do these words mean?
							</Button>
							{session && (
								<Button
									variant="subtle"
									color="obsidian"
									onClick={() => setShowIdentity((visible) => !visible)}
								>
									{showIdentity ? "Hide engine identity" : "Engine identity"}
								</Button>
							)}
							<Button
								variant="light"
								leftSection={<Icon path={iconRefresh} />}
								onClick={() => query.refetch()}
								loading={query.isFetching}
							>
								Reconnect
							</Button>
						</Group>
					</Group>

					{query.isError && (
						<Alert
							color="red"
							title="RRD handshake failed"
							icon={<Icon path={iconErrorCircle} />}
						>
							{describeRrdError(query.error)}
						</Alert>
					)}

					{identityVisible && (
						<SimpleGrid cols={{ base: 1, md: 3 }}>
							{stages.map((stage, index) => (
								<Paper
									key={stage.label}
									p="lg"
									className={classes.stage}
								>
									<Group justify="space-between">
										<Text fw={650}>{stage.label}</Text>
										<Badge
											variant="light"
											color={
												handshake ? "green" : query.isError ? "red" : "gray"
											}
										>
											{handshake
												? "verified"
												: query.isError
													? "stopped"
													: `${index + 1}/3`}
										</Badge>
									</Group>
									<Text
										fz="sm"
										mt="sm"
									>
										{stage.detail}
									</Text>
								</Paper>
							))}
						</SimpleGrid>
					)}

					{identityVisible && handshake && (
						<Paper
							p="lg"
							className={classes.identity}
						>
							<Group justify="space-between">
								<Box>
									<Text
										fz="xs"
										tt="uppercase"
										c="slate"
									>
										Verified engine identity
									</Text>
									<Text
										fz="xl"
										fw={700}
									>
										{handshake.service.implementation}{" "}
										{handshake.service.implementation_version}
									</Text>
									<Text fz="sm">
										{handshake.service.deployment.deployment_form} ·{" "}
										{handshake.service.deployment.storage_profile} ·{" "}
										{handshake.service.deployment.endpoint_presentation}
									</Text>
									{handshake.service.installed_estate && (
										<Text
											fz="sm"
											ff="monospace"
										>
											{handshake.service.installed_estate.project_id} ·{" "}
											{handshake.service.installed_estate.estate_id} ·
											configuration r
											{handshake.service.configuration.revision}
										</Text>
									)}
								</Box>
								<Badge variant="outline">
									{handshake.service.capabilities.length} capabilities
								</Badge>
							</Group>
							<Group
								gap="xs"
								mt="lg"
							>
								{handshake.service.capabilities.map((capability) => (
									<Badge
										key={capability.name}
										variant="light"
										color={capability.status === "available" ? "green" : "gray"}
									>
										{capability.name} · v{capability.contract_version}
									</Badge>
								))}
							</Group>
						</Paper>
					)}

					<SessionPanel
						client={sessionClient}
						connection={connection}
						endpoint={endpoint}
						handshake={handshake}
						session={session}
						foreign={foreign}
						ready={nativeSession.isFetched}
					/>

					{session && (
						<>
							<Text>
								One <Term id="estate">estate</Term>, one database: RRFlow keeps the
								records, the relations between them, and their vectors together in
								rrflowDB, and stores all of it with{" "}
								<Term id="rrflowKV">rrflowKV</Term>. The three views below are three
								ways into the same data.
							</Text>
							<SimpleGrid cols={{ base: 1, md: 3 }}>
								<LensCard
									active={lens === "records"}
									icon={iconRelation}
									title="Records & relations"
									purpose="What the estate knows and how it links together."
									reading={
										graph
											? `${formatCount(graph.nodes.length)} records · ${formatCount(graph.edges.length)} relations`
											: "Reading…"
									}
									onOpen={() => setLens("records")}
								/>
								<LensCard
									active={lens === "vectors"}
									icon={iconTarget}
									title="Vectors"
									purpose="Find records with similar content by comparing their vectors."
									reading={
										collections
											? `${formatCount(collections.length)} collection${collections.length === 1 ? "" : "s"} · ${formatCount(namedVectors)} named vector${namedVectors === 1 ? "" : "s"}`
											: "Reading…"
									}
									onOpen={() => setLens("vectors")}
								/>
								<LensCard
									active={lens === "storage"}
									icon={iconMemory}
									title="Storage engine"
									purpose="How the data is kept safe on disk and quick in memory."
									reading={`${storageProfile === "rrflow_kv" ? "rrflowKV" : storageProfile} · live counters`}
									onOpen={() => setLens("storage")}
								/>
							</SimpleGrid>

							<Box mt="md">
								{lens === "records" && (
									<RecordsTab
										connection={session}
										{...lensProps}
									/>
								)}
								{lens === "vectors" && (
									<VectorsTab
										connection={session}
										{...lensProps}
									/>
								)}
								{lens === "storage" && (
									<StorageTab
										connection={session}
										client={sessionClient}
										sessionKey={sessionKey}
									/>
								)}
							</Box>
						</>
					)}

					{!session && (
						<>
							<Box mt="md">
								<Group justify="space-between">
									<Box>
										<Text
											fz="xl"
											fw={650}
											c="bright"
										>
											Existing-project attunement
										</Text>
										<Text>
											Designed as a resumable{" "}
											{ATTUNEMENT_ESTIMATE_MINUTES.minimum}–
											{ATTUNEMENT_ESTIMATE_MINUTES.maximum} minute engine job.
										</Text>
									</Box>
									<Badge
										variant="outline"
										color="gray"
									>
										Contract pending
									</Badge>
								</Group>
								<Progress
									value={handshake ? 100 / ATTUNEMENT_PHASES.length : 0}
									mt="md"
									color="violet"
								/>
							</Box>

							<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
								{ATTUNEMENT_PHASES.map((phase) => (
									<Paper
										key={phase.id}
										p="md"
										className={classes.phase}
									>
										<Group justify="space-between">
											<Text fw={650}>{phase.label}</Text>
											<Badge
												variant="light"
												color={
													phase.state === "implemented" ? "green" : "gray"
												}
											>
												{phase.state === "implemented"
													? "available"
													: "planned"}
											</Badge>
										</Group>
										<Text
											fz="sm"
											mt="xs"
										>
											{phase.description}
										</Text>
									</Paper>
								))}
							</SimpleGrid>

							<Paper
								p="lg"
								className={classes.boundary}
							>
								<Group justify="space-between">
									<Box>
										<Text
											fz="lg"
											fw={650}
										>
											Mesh discovery boundary
										</Text>
										<Text fz="sm">
											Zuul Zero or shippin.ai mesh may resolve a devspace
											endpoint; Connectome still performs this RRD HTTP
											handshake and never treats network reachability as
											engine identity.
										</Text>
									</Box>
									<Badge variant="outline">Adapter pending</Badge>
								</Group>
								<SimpleGrid
									cols={{ base: 1, sm: 2, lg: 4 }}
									mt="lg"
								>
									{AUTOMATION_PRIMITIVES.map((primitive) => (
										<Box
											key={primitive.name}
											className={classes.primitive}
										>
											<Text fw={650}>{primitive.name}</Text>
											<Text fz="sm">{primitive.contract}</Text>
										</Box>
									))}
								</SimpleGrid>
							</Paper>
						</>
					)}
				</Stack>
			</ScrollArea>
			<GlossaryDrawer
				opened={glossaryOpen}
				onClose={() => setGlossaryOpen(false)}
			/>
		</Box>
	);
}

import {
	Alert,
	Badge,
	Box,
	Button,
	Drawer,
	Group,
	Paper,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { Redirect } from "wouter";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import { openConnectionEditModal } from "~/modals/edit-connection";
import {
	ATTUNEMENT_ESTIMATE_MINUTES,
	ATTUNEMENT_PHASES,
	AUTOMATION_PRIMITIVES,
} from "~/rrflow/attunement";
import { describeRrdError, RrdRuntimeClient } from "~/rrflow/runtime";
import { RrdSessionClient } from "~/rrflow/session";
import { useConfigStore } from "~/shell/stores/config";
import {
	Icon,
	iconBook,
	iconErrorCircle,
	iconMemory,
	iconRefresh,
	iconRelation,
	iconTarget,
} from "../../../../rrflow/ui/index";
import { formatCount } from "./format";
import { GlossaryDrawer } from "./glossary";
import { databaseQuery } from "./queries";
import { allowSessionReconnect, SESSION_QUERY_KEY, SessionPanel } from "./session";
import classes from "./style.module.scss";
import { KnowledgeTab } from "./tabs/knowledge";
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
			aria-label={title}
			title={purpose}
			className={classes.lens}
			data-active={active || undefined}
		>
			<Group
				gap="xs"
				wrap="nowrap"
			>
				<Icon path={icon} />
				<Text
					fw={650}
					fz="sm"
				>
					{title}
				</Text>
			</Group>
			<Text
				fz="xs"
				c="slate"
				mt={3}
			>
				{reading}
			</Text>
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
		() =>
			new RrdRuntimeClient(endpoint, connection?.runtimeInstance, connection?.runtimeSshHost),
		[connection?.runtimeInstance, connection?.runtimeSshHost, endpoint],
	);
	const query = useQuery({
		queryKey: [
			"rrd-runtime-handshake",
			id,
			endpoint,
			connection?.runtimeInstance,
			connection?.runtimeSshHost,
		],
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
	const viewport = useRef<HTMLDivElement>(null);

	const handshake = query.isError ? undefined : query.data;
	const current = nativeSession.isError ? null : (nativeSession.data ?? null);
	const ownsSession =
		!query.isError &&
		!nativeSession.isError &&
		current !== null &&
		handshake !== undefined &&
		current.endpoint === endpoint &&
		current.instance === handshake.service.instance.id;
	const session = ownsSession ? current : null;
	const foreign = ownsSession ? null : current;
	const sessionKey = session ? `${session.instance}:${session.connected_at_unix_ms}` : "";

	const buildingMaps = useIsFetching({ queryKey: ["rrd-vector-map", sessionKey] });
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
	const stages = [
		{
			label: "Connection reachable",
			detail: handshake ? `Responded at ${handshake.endpoint}` : "Awaiting liveness response",
		},
		{
			label: "Engine ready",
			detail: handshake
				? `Cursor ${handshake.readiness.runtime_cursor} on ${handshake.readiness.backend}`
				: "Awaiting ready response",
		},
		{
			label: "Correct RRFlow engine",
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
	const openLens = (next: RuntimeLens) => {
		setLens(next);
		viewport.current?.scrollTo({ top: 0 });
	};
	const lensProps = {
		client: sessionClient,
		sessionKey,
		selected,
		onSelect: setSelected,
		colorBy,
		onColorBy: setColorBy,
		onOpenLens: openLens,
	};

	const views = [
		{
			id: "records" as const,
			title: "Records & relations",
			icon: iconRelation,
			purpose: "Browse what RRFlow knows and how records connect.",
			reading: graph
				? `${formatCount(graph.nodes.length)} records · ${formatCount(graph.edges.length)} relations`
				: database.isError
					? "Could not read records"
					: "Reading records…",
		},
		{
			id: "vectors" as const,
			title: "Vectors",
			icon: iconTarget,
			purpose: buildingMaps
				? "A similarity map is building in the background. Open Vectors to see progress."
				: "Find similar records by comparing their vectors.",
			reading: buildingMaps
				? "Building similarity map…"
				: collections
					? `${formatCount(collections.length)} collection${collections.length === 1 ? "" : "s"} · ${formatCount(namedVectors)} vector${namedVectors === 1 ? "" : "s"}`
					: catalogue.isError
						? "Could not read vectors"
						: "Reading vectors…",
		},
		{
			id: "knowledge" as const,
			title: "Knowledge trees",
			icon: iconBook,
			purpose: "Organize knowledge sources and configure paths to external services.",
			reading: "Sources & connections",
		},
		{
			id: "storage" as const,
			title: "Storage",
			icon: iconMemory,
			purpose: "Check how RRFlow keeps your data on disk and in memory.",
			reading: `${storageProfile === "rrflow_kv" ? "rrflowKV" : (storageProfile ?? "Storage")} · live counters`,
		},
	];

	return (
		<Box
			flex={1}
			pos="relative"
			mih={0}
			miw={0}
		>
			<Box
				className={classes.workspace}
				data-testid="runtime-workspace"
			>
				<Box className={classes.workspaceHeader}>
					<Group
						justify="space-between"
						gap="sm"
						align="center"
					>
						<Box
							miw={0}
							flex={1}
						>
							<Group gap="sm">
								<PrimaryTitle
									fz={24}
									className={classes.endpoint}
								>
									{connection.name}
								</PrimaryTitle>
								<Badge
									variant="dot"
									color={
										session
											? "green"
											: query.isError
												? "red"
												: handshake
													? "blue"
													: "gray"
									}
								>
									{session
										? "Signed in"
										: query.isError
											? "Connection failed"
											: handshake
												? "Engine available"
												: "Connecting…"}
								</Badge>
							</Group>
							<Text
								fz="xs"
								c="slate"
								className={classes.endpoint}
							>
								{endpoint}
							</Text>
						</Box>
						<Group
							gap={4}
							className={classes.connectionActions}
						>
							<Button
								size="xs"
								variant="subtle"
								color="obsidian"
								onClick={() => openConnectionEditModal(connection)}
							>
								Edit connection
							</Button>
							<Button
								size="xs"
								variant="subtle"
								color="obsidian"
								onClick={() => setGlossaryOpen(true)}
								leftSection={<Icon path={iconBook} />}
							>
								Help
							</Button>
							<Button
								size="xs"
								variant="subtle"
								color="obsidian"
								onClick={() => setShowIdentity(true)}
								aria-haspopup="dialog"
							>
								Engine details
							</Button>
							<Button
								size="xs"
								variant="light"
								leftSection={<Icon path={iconRefresh} />}
								loading={query.isFetching || nativeSession.isFetching}
								onClick={() => {
									allowSessionReconnect(connection.id);
									return Promise.all([
										query.refetch(),
										isTauri() ? nativeSession.refetch() : Promise.resolve(),
									]);
								}}
							>
								Reconnect
							</Button>
						</Group>
					</Group>
					{session && (
						<Box
							component="nav"
							aria-label="RRFlow views"
							className={classes.lensNavigation}
						>
							{views.map((view) => (
								<LensCard
									key={view.id}
									active={lens === view.id}
									icon={view.icon}
									title={view.title}
									purpose={view.purpose}
									reading={view.reading}
									onOpen={() => openLens(view.id)}
								/>
							))}
						</Box>
					)}
				</Box>
				<ScrollArea
					className={classes.workspaceScroll}
					viewportRef={viewport}
					type="auto"
					scrollbars="y"
					viewportProps={{ "aria-label": "RRFlow working area", tabIndex: 0 }}
				>
					<Stack
						className={classes.workspaceContent}
						gap="md"
					>
						{query.isError && (
							<Alert
								color="red"
								title="Could not connect to RRFlow"
								icon={<Icon path={iconErrorCircle} />}
							>
								<Text fz="sm">{describeRrdError(query.error)}</Text>
								<Text
									fz="sm"
									mt="xs"
								>
									Check the address in Edit connection, then choose Reconnect to
									try this saved connection again.
								</Text>
							</Alert>
						)}
						{nativeSession.isError && (
							<Alert
								color="red"
								title="Could not check your sign-in"
								icon={<Icon path={iconErrorCircle} />}
							>
								{describeRrdError(nativeSession.error)}
							</Alert>
						)}
						<SessionPanel
							key={id}
							client={sessionClient}
							connection={connection}
							endpoint={endpoint}
							handshake={handshake}
							session={session}
							foreign={foreign}
							ready={nativeSession.isFetched && !nativeSession.isError}
						/>
						{session ? (
							<Box>
								{lens === "records" && (
									<RecordsTab
										key={sessionKey}
										connection={session}
										{...lensProps}
									/>
								)}
								{lens === "vectors" && (
									<VectorsTab
										key={sessionKey}
										connection={session}
										{...lensProps}
									/>
								)}
								<Box hidden={lens !== "knowledge"}>
									<KnowledgeTab
										key={sessionKey}
										active={lens === "knowledge"}
										connection={session}
										client={sessionClient}
										sessionKey={sessionKey}
									/>
								</Box>
								{lens === "storage" && (
									<StorageTab
										key={sessionKey}
										connection={session}
										client={sessionClient}
										sessionKey={sessionKey}
									/>
								)}
							</Box>
						) : (
							<Box>
								<Text
									fw={650}
									mb="xs"
								>
									Connection checks
								</Text>
								<Text
									fz="sm"
									c="slate"
									mb="sm"
								>
									RRFlow must answer all three checks before you can sign in and
									open your data.
								</Text>
								<SimpleGrid cols={{ base: 1, sm: 3 }}>
									{stages.map((stage) => (
										<Paper
											key={stage.label}
											p="sm"
											className={classes.stage}
										>
											<Group justify="space-between">
												<Text
													fz="sm"
													fw={650}
												>
													{stage.label}
												</Text>
												<Badge
													size="xs"
													color={
														handshake
															? "green"
															: query.isError
																? "red"
																: "gray"
													}
												>
													{handshake
														? "verified"
														: query.isError
															? "failed"
															: "waiting"}
												</Badge>
											</Group>
											<Text
												fz="xs"
												mt="xs"
												className={classes.endpoint}
											>
												{stage.detail}
											</Text>
										</Paper>
									))}
								</SimpleGrid>
							</Box>
						)}
					</Stack>
				</ScrollArea>
				<Drawer
					opened={showIdentity}
					onClose={() => setShowIdentity(false)}
					title="Engine details"
					position="right"
					size="lg"
				>
					<Stack
						gap="md"
						className={classes.inspector}
					>
						<Text fz="sm">
							These checks identify the RRFlow engine at this saved address. Signing
							in separately verifies your permission to use its data.
						</Text>
						{
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
													handshake
														? "green"
														: query.isError
															? "red"
															: "gray"
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
						}

						{handshake && (
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
											color={
												capability.status === "available" ? "green" : "gray"
											}
										>
											{capability.name} · v{capability.contract_version} ·{" "}
											{capability.status}
										</Badge>
									))}
								</Group>
							</Paper>
						)}

						{handshake && (
							<Text
								fz="sm"
								ff="monospace"
								className={classes.endpoint}
							>
								{handshake.service.instance.id}
							</Text>
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
												Planned as a resumable{" "}
												{ATTUNEMENT_ESTIMATE_MINUTES.minimum}–
												{ATTUNEMENT_ESTIMATE_MINUTES.maximum} minute engine
												job.
											</Text>
										</Box>
										<Badge
											variant="outline"
											color="gray"
										>
											Contract pending
										</Badge>
									</Group>
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
														phase.state === "implemented"
															? "green"
															: "gray"
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
				</Drawer>
				<GlossaryDrawer
					opened={glossaryOpen}
					onClose={() => setGlossaryOpen(false)}
				/>
			</Box>
		</Box>
	);
}

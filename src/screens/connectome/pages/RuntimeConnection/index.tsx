import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	Select,
	SimpleGrid,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { type ReactNode, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { Icon } from "~/components/Icon";
import { PrimaryTitle } from "~/components/PrimaryTitle";
import {
	iconBook,
	iconErrorCircle,
	iconMemory,
	iconRefresh,
	iconRelation,
	iconTarget,
} from "~/icons";
import { describeRrdError, RrdRuntimeClient } from "~/rrflow/runtime";
import { RrdSessionClient } from "~/rrflow/session";
import { dispatchIntent } from "~/shared/util/intents";
import { useConfigStore } from "~/shell/stores/config";
import { ApiReference } from "./api";
import { workspaceRoute } from "./areas";
import { formatCount } from "./format";
import { GlossaryDrawer, Term } from "./glossary";
import { GuideCards } from "./guides/cards";
import { ProjectPlanPanel } from "./plan";
import { databaseQuery } from "./queries";
import { SessionPanel, sessionQueryKey } from "./session";
import { WorkspaceShell } from "./shell";
import classes from "./style.module.scss";
import { ModelsTab } from "./tabs/models";
import { RecordsTab } from "./tabs/records";
import { StorageTab } from "./tabs/storage";
import { VectorsTab } from "./tabs/vectors";
import { TasksPanel } from "./tasks";
import type { RuntimeLens } from "./types";
import { WorkbenchPanel } from "./workbench";
import { ProjectOverview } from "./workspace";

interface LensCardProps {
	icon: string;
	title: string;
	purpose: string;
	reading: ReactNode;
	onOpen: () => void;
}

function LensCard({ icon, title, purpose, reading, onOpen }: LensCardProps) {
	return (
		<UnstyledButton onClick={onOpen}>
			<Paper
				p="md"
				h="100%"
				className={classes.lens}
			>
				<Group
					gap="sm"
					wrap="nowrap"
					align="flex-start"
				>
					<Box
						c="violet"
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

export function RuntimeConnectionPage({
	id,
	section = "overview",
	detail,
}: {
	id: string;
	section?: string;
	detail?: string;
}) {
	const [, navigate] = useLocation();
	const connections = useConfigStore((state) => state.connections);
	const route = workspaceRoute(section, detail);
	const openRoute = (next: string) => navigate(`/runtime/${id}/${next}`);
	const setLens = (next: RuntimeLens) =>
		openRoute(next === "storage" ? "system/storage" : `knowledge/${next}`);
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === id),
	);
	const endpoint = connection
		? `${connection.authentication.protocol}://${connection.authentication.hostname}`
		: "";
	const query = useQuery({
		queryKey: ["rrd-runtime-handshake", id, endpoint, connection?.runtimeInstance],
		enabled: Boolean(connection && connection.target === "runtime"),
		queryFn: () => new RrdRuntimeClient(endpoint, connection?.runtimeInstance).handshake(),
		retry: false,
	});
	const sessionClient = useMemo(() => new RrdSessionClient(id), [id]);
	const nativeSession = useQuery({
		queryKey: sessionQueryKey(id),
		enabled: isTauri(),
		queryFn: () => sessionClient.current(),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [selected, setSelected] = useState<string | null>(null);
	const [colorBy, setColorBy] = useState("cluster");
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
	const sessionKey = session ? `${id}:${session.instance}:${session.connected_at_unix_ms}` : "";

	// The lens cards read the same cached snapshots the lenses render.
	const database = useQuery({
		...databaseQuery(sessionClient, sessionKey),
		enabled: Boolean(session) && route === "overview",
	});
	const catalogue = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		enabled: Boolean(session),
		queryFn: () => sessionClient.vectorCollections(),
	});

	if (connection?.target !== "runtime") {
		return <Redirect to="/overview" />;
	}

	// An address saved before these areas opens the tab that holds its view now.
	if (route !== (detail ? `${section}/${detail}` : section)) {
		return (
			<Redirect
				to={`/runtime/${id}/${route}`}
				replace
			/>
		);
	}

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

	const sessionPanel = (
		<SessionPanel
			client={sessionClient}
			connection={connection}
			endpoint={endpoint}
			handshake={handshake}
			session={session}
			foreign={foreign}
			ready={nativeSession.isFetched}
		/>
	);

	return (
		<>
			<WorkspaceShell
				route={route}
				onOpen={openRoute}
				top={
					<>
						<Group
							gap="xs"
							wrap="nowrap"
							miw={0}
						>
							<Select
								aria-label="Selected project"
								size="xs"
								w={200}
								value={id}
								data={connections
									.filter((c) => c.target === "runtime")
									.map((c) => ({ value: c.id, label: c.name }))}
								onChange={(next) => {
									if (next) navigate(`/runtime/${next}/${route}`);
								}}
								searchable
								allowDeselect={false}
							/>
							<Text
								fz="sm"
								c="slate"
							>
								›
							</Text>
							<Text
								fz="sm"
								c="slate"
							>
								Engram
							</Text>
							<Text
								ff="monospace"
								fz="sm"
								truncate
							>
								{handshake?.service.instance.id ?? "instance not confirmed"}
							</Text>
						</Group>
						<Group
							gap="xs"
							wrap="nowrap"
						>
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
							<Button
								variant="subtle"
								color="obsidian"
								size="xs"
								leftSection={<Icon path={iconBook} />}
								onClick={() => setGlossaryOpen(true)}
							>
								What do these words mean?
							</Button>
							<Button
								variant="light"
								size="xs"
								onClick={() => dispatchIntent("toggle-serving")}
							>
								Manage project engines
							</Button>
							<Button
								variant="light"
								size="xs"
								leftSection={<Icon path={iconRefresh} />}
								onClick={() => query.refetch()}
								loading={query.isFetching}
							>
								Reconnect
							</Button>
						</Group>
					</>
				}
			>
				{query.isError && (
					<Alert
						color="red"
						title="RRD handshake failed"
						icon={<Icon path={iconErrorCircle} />}
					>
						{describeRrdError(query.error)}
					</Alert>
				)}

				{(!session || route === "system/instance") && sessionPanel}

				{session &&
					(route === "overview" || route.startsWith("knowledge/")) &&
					(database.isError || catalogue.isError) && (
						<Alert
							color="red"
							title="Project data could not be read"
						>
							{describeRrdError(database.error ?? catalogue.error)}
						</Alert>
					)}

				{route === "overview" && (
					<>
						<PrimaryTitle fz={26}>{connection.name}</PrimaryTitle>
						<Text>
							One <Term id="engram">engram</Term>, one database: RRFlow keeps the
							records, the relations between them, and their vectors together in
							rrflowDB, and stores all of it with <Term id="rrflowKV">rrflowKV</Term>.
							The views below are different ways into the same data.
						</Text>
						<SimpleGrid cols={{ base: 1, md: 2, lg: 4 }}>
							<LensCard
								icon={iconBook}
								title="Data models"
								purpose="Learn the database and browse its native tables."
								reading="Live schema and guided queries"
								onOpen={() => setLens("models")}
							/>
							<LensCard
								icon={iconRelation}
								title="Records & relations"
								purpose="What the engram knows and how it links together."
								reading={
									graph
										? `${formatCount(graph.nodes.length)} records in view · ${formatCount(graph.edges.length)} relations`
										: session
											? "Reading..."
											: "Open a native session to inspect"
								}
								onOpen={() => setLens("records")}
							/>
							<LensCard
								icon={iconTarget}
								title="Vectors"
								purpose="Find records with similar content by comparing their vectors."
								reading={
									collections
										? `${formatCount(collections.length)} collection${collections.length === 1 ? "" : "s"} · ${formatCount(namedVectors)} named vector${namedVectors === 1 ? "" : "s"}`
										: session
											? "Reading..."
											: "Open a native session to inspect"
								}
								onOpen={() => setLens("vectors")}
							/>
							<LensCard
								icon={iconMemory}
								title="Storage engine"
								purpose="How the data is kept safe on disk and quick in memory."
								reading={
									session
										? `${storageProfile === "rrflow_kv" ? "rrflowKV" : storageProfile} - live counters`
										: "Open a native session to inspect"
								}
								onOpen={() => setLens("storage")}
							/>
						</SimpleGrid>
						<GuideCards
							session={Boolean(session)}
							records={(graph?.nodes.length ?? 0) > 0}
						/>
						<ProjectOverview
							connected={Boolean(session)}
							onOpen={openRoute}
						/>
					</>
				)}

				{session && route === "knowledge/records" && (
					<RecordsTab
						connection={session}
						{...lensProps}
					/>
				)}
				{session && route === "knowledge/models" && (
					<ModelsTab
						client={sessionClient}
						sessionKey={sessionKey}
						onOpenLens={setLens}
					/>
				)}
				{session && route === "knowledge/vectors" && (
					<VectorsTab
						connection={session}
						{...lensProps}
					/>
				)}
				{session && route === "system/storage" && (
					<StorageTab
						connection={session}
						client={sessionClient}
						sessionKey={sessionKey}
					/>
				)}

				{route === "reasoning/workbench" && (
					<WorkbenchPanel
						key={id}
						client={sessionClient}
						connectionId={id}
						sessionKey={sessionKey}
						connected={Boolean(session)}
						onOpenGraph={() => setLens("records")}
						onOpenStorage={() => setLens("storage")}
						onSelectRecord={(record) => {
							setSelected(record);
							setLens("records");
						}}
					/>
				)}
				{route === "reasoning/plan" && (
					<ProjectPlanPanel
						key={sessionKey}
						client={sessionClient}
						instance={session?.instance ?? ""}
						connected={Boolean(session)}
					/>
				)}
				{route === "reasoning/tasks" && (
					<TasksPanel
						key={sessionKey}
						client={sessionClient}
						instance={session?.instance ?? ""}
						connected={Boolean(session)}
					/>
				)}

				{route === "system/api" && endpoint && (
					<ApiReference
						endpoint={endpoint}
						instance={handshake?.service.instance.id ?? connection?.runtimeInstance}
					/>
				)}

				{route === "system/instance" && (
					<>
						<Box>
							<PrimaryTitle fz={26}>{connection.name}</PrimaryTitle>
							<Text
								fz="sm"
								c="slate"
								mt={4}
							>
								{endpoint}
							</Text>
						</Box>
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
											{capability.name} · v{capability.contract_version}
										</Badge>
									))}
								</Group>
							</Paper>
						)}
					</>
				)}
			</WorkspaceShell>
			<GlossaryDrawer
				opened={glossaryOpen}
				onClose={() => setGlossaryOpen(false)}
			/>
		</>
	);
}

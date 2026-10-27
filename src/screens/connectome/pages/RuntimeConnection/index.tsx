import {
	Alert,
	Badge,
	Box,
	Button,
	Group,
	Paper,
	ScrollArea,
	Select,
	SimpleGrid,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { type ReactNode, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { Icon } from "~/components/Icon";
import { PageBreadcrumbs } from "~/components/PageBreadcrumbs";
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
import { formatCount } from "./format";
import { GlossaryDrawer, Term } from "./glossary";
import { databaseQuery } from "./queries";
import { SessionPanel, sessionQueryKey } from "./session";
import classes from "./style.module.scss";
import { ModelsTab } from "./tabs/models";
import { RecordsTab } from "./tabs/records";
import { StorageTab } from "./tabs/storage";
import { VectorsTab } from "./tabs/vectors";
import type { RuntimeLens } from "./types";
import { ProjectSection } from "./workspace";

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
	const openSection = (next: string) => navigate(`/runtime/${id}/${next}`);
	const lens: RuntimeLens =
		detail === "records" || detail === "vectors" || detail === "storage" ? detail : "models";
	const setLens = (next: RuntimeLens) => openSection(`knowledge/${next}`);
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
	const sessionKey = session ? `${id}:${session.instance}:${session.connected_at_unix_ms}` : "";

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
	const identityVisible = showIdentity;
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
							{ label: "Projects" },
							{ label: connection.name },
							{ label: section },
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
							{
								<Button
									variant="subtle"
									color="obsidian"
									onClick={() => setShowIdentity((visible) => !visible)}
								>
									{showIdentity ? "Hide advanced details" : "Advanced details"}
								</Button>
							}
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

					<Group
						align="end"
						justify="space-between"
					>
						<Select
							label="Selected project"
							description="A saved connection; engine identity is verified independently."
							value={id}
							data={connections
								.filter((c) => c.target === "runtime")
								.map((c) => ({ value: c.id, label: c.name }))}
							onChange={(next) => {
								if (next)
									navigate(
										`/runtime/${next}/${section}${detail ? `/${detail}` : ""}`,
									);
							}}
							searchable
							allowDeselect={false}
							w={320}
						/>
						<Button
							variant="light"
							onClick={() => dispatchIntent("toggle-serving")}
						>
							Manage project engines
						</Button>
					</Group>
					<Group
						component="nav"
						aria-label="Project sections"
						gap="xs"
					>
						{[
							["overview", "Overview"],
							["knowledge", "Knowledge"],
							["activity", "Activity"],
							["learning", "Learning"],
							["services", "Services"],
							["api", "API reference"],
						].map(([value, label]) => (
							<Button
								key={value}
								variant={section === value ? "filled" : "subtle"}
								aria-current={section === value ? "page" : undefined}
								onClick={() => openSection(value)}
							>
								{label}
							</Button>
						))}
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

					{(section === "overview" || section === "knowledge") && (
						<>
							<Text>
								One <Term id="estate">estate</Term>, one database: RRFlow keeps the
								records, the relations between them, and their vectors together in
								rrflowDB, and stores all of it with{" "}
								<Term id="rrflowKV">rrflowKV</Term>. The views below are different
								ways into the same data.
							</Text>
							{session && (database.isError || catalogue.isError) && (
								<Alert
									color="red"
									title="Project data could not be read"
								>
									{describeRrdError(database.error ?? catalogue.error)}
								</Alert>
							)}
							<SimpleGrid cols={{ base: 1, md: 2, lg: 4 }}>
								<LensCard
									active={
										section === "knowledge" &&
										detail !== "paths" &&
										lens === "models"
									}
									icon={iconBook}
									title="Data models"
									purpose="Learn the database and browse its native tables."
									reading="Live schema and guided queries"
									onOpen={() => setLens("models")}
								/>
								<LensCard
									active={section === "knowledge" && lens === "records"}
									icon={iconRelation}
									title="Records & relations"
									purpose="What the estate knows and how it links together."
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
									active={section === "knowledge" && lens === "vectors"}
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
									active={section === "knowledge" && lens === "storage"}
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

							<Box mt="md">
								{session &&
									section === "knowledge" &&
									detail !== "paths" &&
									lens === "models" && (
										<ModelsTab
											client={sessionClient}
											sessionKey={sessionKey}
											onOpenLens={setLens}
										/>
									)}
								{session && section === "knowledge" && lens === "records" && (
									<RecordsTab
										connection={session}
										{...lensProps}
									/>
								)}
								{session && section === "knowledge" && lens === "vectors" && (
									<VectorsTab
										connection={session}
										{...lensProps}
									/>
								)}
								{session && section === "knowledge" && lens === "storage" && (
									<StorageTab
										connection={session}
										client={sessionClient}
										sessionKey={sessionKey}
									/>
								)}
							</Box>
						</>
					)}

					{section === "api" && endpoint && (
						<ApiReference
							endpoint={endpoint}
							instance={handshake?.service.instance.id ?? connection?.runtimeInstance}
						/>
					)}

					<ProjectSection
						detail={detail}
						section={section}
						connected={Boolean(session)}
						onOpen={openSection}
					/>
				</Stack>
			</ScrollArea>
			<GlossaryDrawer
				opened={glossaryOpen}
				onClose={() => setGlossaryOpen(false)}
			/>
		</Box>
	);
}

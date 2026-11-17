import { Alert, Badge, Button, Group, Select, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useRouter } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { type MenuCounts, useMenuCounts } from "~/app/router/menu-counts";
import { projectAreas } from "~/app/router/project-menu";
import { AppRedirect } from "~/components/AppLink";
import { Icon } from "~/components/Icon";
import { useAbsoluteLocation } from "~/hooks/app/routing";
import { connectionProject } from "~/rrflow/instances";
import { describeRrdError, isUnreachable, RrdRuntimeClient } from "~/rrflow/runtime";
import { RrdSessionClient, sessionQueryKey } from "~/rrflow/session";
import { iconBook, iconErrorCircle, iconRefresh } from "~/shared/assets/icons";
import { dispatchIntent } from "~/shared/util/platform/intents";
import { useConfigStore } from "~/shell/stores/config";
import { databaseQuery } from "../api/queries";
import { GlossaryDrawer } from "../components/glossary";
import { SessionPanel } from "../session/session";
import { WorkspaceShell } from "../shell/shell";
import type { RuntimeLens } from "../types";
import { ProjectContext, type ProjectContextValue } from "./context";

/**
 * Addresses saved before the project had areas, and where their views live now.
 * The smoke suite pins this ("addresses saved before these areas still open
 * their view"). Pre-release policy says no compatibility, so whether to retire
 * it is the owner's decision at the reorganization; until then nothing that
 * opened before stops opening.
 */
const BEFORE_AREAS: Record<string, string> = {
	tasks: "reasoning/tasks",
	workbench: "reasoning/workbench",
	plan: "reasoning/plan",
	api: "system/api",
	"knowledge/storage": "system/storage",
};

/**
 * The frame every view of one project renders inside: it negotiates with the
 * project's engine, owns the native session, and hands both to the views.
 */
export function ProjectLayout({ id }: { id: string }) {
	const [location, navigate] = useAbsoluteLocation();
	const router = useRouter();
	const areas = useMemo(() => projectAreas(Object.values(router.routesById)), [router]);
	const connections = useConfigStore((state) => state.connections);
	const prefix = `/runtime/${id}`;
	const path = location.startsWith(prefix)
		? location.slice(prefix.length).replace(/^\/+|\/+$/g, "")
		: "";
	const open = (next: string) => navigate(next ? `${prefix}/${next}` : prefix);
	const openLens = (next: RuntimeLens) =>
		open(next === "storage" ? "system/storage" : `knowledge/${next}`);
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === id),
	);
	const endpoint = connection
		? `${connection.authentication.protocol}://${connection.authentication.hostname}`
		: "";
	const query = useQuery({
		queryKey: [
			"rrd-runtime-handshake",
			id,
			endpoint,
			connection?.runtimeInstance,
			connection?.runtimeSshHost,
		],
		enabled: Boolean(connection && connection.target === "runtime"),
		queryFn: () =>
			new RrdRuntimeClient(
				endpoint,
				connection?.runtimeInstance,
				connection?.runtimeSshHost,
			).handshake(),
		retry: false,
	});
	const client = useMemo(() => new RrdSessionClient(id), [id]);
	const nativeSession = useQuery({
		queryKey: sessionQueryKey(id),
		enabled: isTauri(),
		queryFn: () => client.current(),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [selected, setSelected] = useState<string | null>(null);
	const [colorBy, setColorBy] = useState("cluster");
	const [glossaryOpen, setGlossaryOpen] = useState(false);

	// The session this window owns for this project's engine, and nothing else.
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

	// Menu counts are read live; these share the views' cached reads.
	const database = useQuery({ ...databaseQuery(client, sessionKey), enabled: Boolean(session) });
	const collections = useQuery({
		queryKey: ["rrd-vector-collections", sessionKey],
		enabled: Boolean(session),
		queryFn: () => client.vectorCollections(),
	});
	const flights = useQuery({
		queryKey: ["rrd-menu-flights", sessionKey],
		enabled: Boolean(session),
		queryFn: () => client.workbenchSnapshot(0),
		refetchInterval: 10_000,
	});
	const runtimeConnections = connections.filter((c) => c.target === "runtime").length;
	const capabilities = handshake?.service.capabilities.length;
	const tables = database.data?.tables.length;
	const models = database.data?.models.length;
	const collectionCount = collections.data?.collections.length;
	const flightCount = flights.data?.flights.length;
	const report = useMenuCounts((state) => state.report);
	const clear = useMenuCounts((state) => state.clear);
	useEffect(() => {
		const counts: MenuCounts = { connections: runtimeConnections };
		if (capabilities !== undefined) counts.capabilities = capabilities;
		if (tables !== undefined) counts.tables = tables;
		if (models !== undefined) counts.models = models;
		if (collectionCount !== undefined) counts.collections = collectionCount;
		if (flightCount !== undefined) counts.flights = flightCount;
		report(id, counts);
	}, [
		id,
		report,
		runtimeConnections,
		capabilities,
		tables,
		models,
		collectionCount,
		flightCount,
	]);
	useEffect(() => () => clear(id), [id, clear]);

	if (connection?.target !== "runtime") {
		return <Navigate to="/overview" />;
	}
	if (path in BEFORE_AREAS) {
		return <AppRedirect to={`${prefix}/${BEFORE_AREAS[path]}`} />;
	}
	// An address no tab owns opens the project's first tab.
	const known = new Set(areas.flatMap((area) => [area.id, ...area.tabs.map((tab) => tab.path)]));
	if (path !== "" && areas.length > 0 && !known.has(path)) {
		return <AppRedirect to={`${prefix}/${areas[0].tabs[0].path}`} />;
	}
	// An area's own address opens its first tab, unless that tab is the address itself.
	const opening = areas.find((area) => area.id === path && area.tabs[0].path !== path);
	if (opening) {
		return <AppRedirect to={`${prefix}/${opening.tabs[0].path}`} />;
	}

	const unreachable = query.isError && isUnreachable(query.error);
	const localProject = connectionProject(connection);

	const value: ProjectContextValue = {
		id,
		connection,
		endpoint,
		handshake,
		handshakeQuery: query,
		session,
		foreign,
		sessionReady: nativeSession.isFetched,
		client,
		sessionKey,
		selected,
		onSelect: setSelected,
		colorBy,
		onColorBy: setColorBy,
		open,
		openLens,
	};

	return (
		<ProjectContext.Provider value={value}>
			<WorkspaceShell
				project={id}
				route={path || (areas[0]?.tabs[0].path ?? "")}
				onOpen={open}
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
									if (next) navigate(`/runtime/${next}/${path}`);
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
								color={
									unreachable
										? "yellow"
										: handshake
											? "green"
											: query.isError
												? "red"
												: "gray"
								}
							>
								{/* A cached handshake must not claim a connection the engine no longer answers. */}
								{unreachable
									? "Unreachable"
									: handshake
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
				{unreachable && (
					<Alert
						color="yellow"
						title={
							localProject
								? "This project's engine is not running"
								: "Connectome cannot reach this engine"
						}
						icon={<Icon path={iconErrorCircle} />}
					>
						<Stack gap="xs">
							<Text size="sm">
								{localProject
									? "Nothing answered at the address it last served. It usually stops when Connectome or the computer closes. Start it to open this project again."
									: "Nothing answered at this engine's address. Check that it is running and reachable, then reconnect."}
							</Text>
							{localProject && (
								<Group>
									<Button
										size="xs"
										onClick={() =>
											dispatchIntent("toggle-serving", {
												start: localProject,
											})
										}
									>
										Start the engine
									</Button>
								</Group>
							)}
							<Text
								size="xs"
								c="dimmed"
							>
								{describeRrdError(query.error)}
							</Text>
						</Stack>
					</Alert>
				)}
				{query.isError && !unreachable && (
					<Alert
						color="red"
						title="RRD handshake failed"
						icon={<Icon path={iconErrorCircle} />}
					>
						{describeRrdError(query.error)}
					</Alert>
				)}

				{!session && path !== "system/instance" && (
					<SessionPanel
						client={client}
						connection={connection}
						endpoint={endpoint}
						handshake={handshake}
						session={session}
						foreign={foreign}
						ready={nativeSession.isFetched}
					/>
				)}
				<Outlet />
			</WorkspaceShell>
			<GlossaryDrawer
				opened={glossaryOpen}
				onClose={() => setGlossaryOpen(false)}
			/>
		</ProjectContext.Provider>
	);
}

import { Alert, Modal, Stack, Text } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { adapter } from "~/adapter";
import { ActionButton } from "~/components/ActionButton";
import { Icon } from "~/components/Icon";
import { useAbsoluteLocation, useConnectionNavigator, useIntent } from "~/hooks/app/routing";
import { useConfirmation } from "~/providers/Confirmation";
import { connectionProject } from "~/rrflow/instances";
import {
	type ActivityMap,
	type AwaitedStart,
	beginAction,
	endAction,
	type ListedProject,
	opensWhenStarted,
	projectName,
	projectRows,
	type ProjectRow as Row,
	type RowAction,
} from "~/rrflow/project-manager";
import { describeRrdError } from "~/rrflow/runtime";
import { iconPlay } from "~/shared/assets/icons";
import type { EngramSelection, ServedEngram } from "~/shared/types";
import { persistCurrentConfig } from "~/shared/util/config/config";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";
import { AddProject } from "./add-project";
import { disconnectProject, INSTANCES_QUERY_KEY, removeProject } from "./project-actions";
import { ProjectRow, RemovalStatement, type Review } from "./project-row";
import { resolveServedConnection } from "./served-connection";

const without = <T,>(map: Record<string, T>, project: string) => {
	const { [project]: _dropped, ...rest } = map;
	return rest;
};

export function DatabaseServing() {
	const [opened, setOpened] = useState(false);
	/** Each row's own action in flight and its own last error. */
	const [activity, setActivity] = useState<ActivityMap>({});
	/** Projects added in this session that have no saved connection yet. */
	const [added, setAdded] = useState<ListedProject[]>([]);
	/** Installations waiting for review, each on its own project's row. */
	const [reviews, setReviews] = useState<Record<string, Review>>({});
	/** Rows whose action has not ended, known at once and not a render later. */
	const inFlight = useRef(new Set<string>());
	const awaited = useRef<AwaitedStart | undefined>(undefined);
	const queryClient = useQueryClient();
	const navigate = useConnectionNavigator();
	const [path] = useAbsoluteLocation();
	const location = useRef(path);
	location.current = path;
	const connections = useConfigStore((state) => state.connections);
	const checkSeconds = useConfigStore((state) => state.settings.serving.instanceCheckSeconds);
	const instances = useDatabaseStore((state) => state.instances);
	const saved = useMemo(
		() =>
			connections.flatMap((connection) => {
				const project = connectionProject(connection);
				return project ? [{ project, name: connection.name }] : [];
			}),
		[connections],
	);
	// Paused while the window is hidden and read at once when it is shown
	// again (`bindQueryFocus`); the pace is the Serving setting.
	const status = useQuery({
		queryKey: [...INSTANCES_QUERY_KEY, saved.map((entry) => entry.project)],
		queryFn: () => adapter.projectInstances(saved.map((entry) => entry.project)),
		enabled: adapter.isServeSupported,
		refetchInterval: checkSeconds * 1000,
	});
	useEffect(() => {
		if (status.data) useDatabaseStore.getState().applyStatus(status.data);
	}, [status.data]);
	const rows = useMemo(() => projectRows(saved, added, instances), [saved, added, instances]);

	/**
	 * Runs one row's action; only that row is busy, and its failure stays on
	 * it. A row does one thing at a time: asking again while its action is in
	 * flight changes nothing, so the row is busy until that action has ended.
	 */
	const act = async (project: string, action: RowAction, work: () => Promise<void>) => {
		if (inFlight.current.has(project)) return;
		inFlight.current.add(project);
		setActivity((current) => beginAction(current, project, action));
		let error: string | undefined;
		try {
			await work();
		} catch (cause) {
			error = describeRrdError(cause);
		}
		inFlight.current.delete(project);
		setActivity((current) => endAction(current, project, error));
		void queryClient.invalidateQueries({ queryKey: INSTANCES_QUERY_KEY });
	};

	/** Saves the served project's connection so it reopens; returns the connection. */
	const saveServed = async (engram: ServedEngram) => {
		const connection = resolveServedConnection(engram);
		try {
			await persistCurrentConfig();
		} catch (cause) {
			throw new Error(
				`RRFlow is running, but Connectome could not save this project for reopening: ${describeRrdError(cause)}`,
			);
		}
		return connection;
	};

	const open = (connection: string) => {
		awaited.current = undefined;
		navigate(connection);
		setOpened(false);
	};

	/** The start asked for last is the one the person is taken to. */
	const awaitStart = (project: string) => {
		awaited.current = { project, from: location.current };
	};

	const close = () => {
		// Closing the dialog is going back to work: nothing opens by itself after.
		awaited.current = undefined;
		setOpened(false);
	};

	/**
	 * Installs when a reviewed plan is given, starts the engine and saves the
	 * project. It is opened only if it is still the start being waited for.
	 */
	const start = async (project: string, selection: EngramSelection, digest?: string) => {
		const engram = await adapter.serveEngram(digest, selection);
		useDatabaseStore.getState().confirmServing(engram);
		const connection = await saveServed(engram);
		// Its saved connection lists it from here on.
		setAdded((current) => current.filter((entry) => entry.project !== project));
		if (opensWhenStarted(awaited.current, project, location.current)) open(connection);
	};

	/**
	 * Asks the engine what starting `request` takes. The resolved folder, the
	 * mode the folder called for, the executable and the identity the engine
	 * planned with are frozen, so the plan applied is the plan reviewed.
	 */
	const plan = async (request: EngramSelection): Promise<Review> => {
		const value = await adapter.previewEngram(request);
		return {
			value,
			selection: {
				...request,
				project: value.project,
				mode: value.mode ?? undefined,
				installationIdentity: value.installation_identity ?? undefined,
			},
		};
	};

	const add = async (folder: string, endpointCredentialMapping?: string) => {
		const { executable } = useConfigStore.getState().settings.serving;
		const review = await plan({ project: folder, executable, endpointCredentialMapping });
		const project = review.value.project;
		// The project is listed from this moment, with its real state.
		setAdded((current) =>
			current.some((entry) => entry.project === project) ||
			saved.some((entry) => entry.project === project)
				? current
				: [...current, { project, name: projectName(project) }],
		);
		awaitStart(project);
		// An installed project starts straight away; any other waits for review.
		if (review.value.installation) {
			setReviews((current) => ({ ...current, [project]: review }));
		} else {
			void act(project, "starting", () => start(project, review.selection));
		}
	};

	/** One action from the click to the open project, or to the review it needs. */
	const startRow = (project: string) => {
		const { executable } = useConfigStore.getState().settings.serving;
		awaitStart(project);
		void act(project, "starting", async () => {
			const review = await plan({ project, executable });
			if (review.value.installation) {
				setReviews((current) => ({ ...current, [project]: review }));
			} else {
				await start(project, review.selection);
			}
		});
	};

	const install = (project: string, review: Review) => {
		// The review is spent either way: a changed plan needs a new one.
		setReviews((current) => without(current, project));
		awaitStart(project);
		void act(project, "starting", () =>
			start(project, review.selection, review.value.installation?.installation.plan_sha256),
		);
	};

	const cancelReview = (project: string) => {
		if (awaited.current?.project === project) awaited.current = undefined;
		setReviews((current) => without(current, project));
		setAdded((current) => current.filter((entry) => entry.project !== project));
	};

	const remove = (project: string) =>
		act(project, "removing", async () => {
			await removeProject(project, queryClient);
			setAdded((current) => current.filter((entry) => entry.project !== project));
			setReviews((current) => without(current, project));
		});

	const confirmRemove = useConfirmation<Row>({
		title: "Remove this project from Connectome?",
		message: (row) => <RemovalStatement row={row} />,
		dismissText: "Keep project",
		confirmText: "Remove project",
		confirmProps: { color: "red" },
		onConfirm: (row) => void remove(row.project),
	});

	useIntent("toggle-serving", (payload) => {
		setOpened(true);
		// A page whose local engine stopped asks for that project to start.
		if (payload.start) startRow(payload.start);
	});

	return (
		<>
			<ActionButton
				label="Manage project engines"
				aria-label="Manage project engines"
				variant="subtle"
				onClick={() => setOpened(true)}
			>
				<Icon path={iconPlay} />
			</ActionButton>
			<Modal
				opened={opened}
				onClose={close}
				title="Project engines"
				size="xl"
			>
				<Stack>
					<Text>
						Each project runs its own RRFlow engine. Projects that are open or running
						together do not share their context, and each one is started, stopped and
						removed by itself. Connectome puts no limit on how many run; each engine
						uses the resources its own configuration allows.
					</Text>
					<Text
						size="sm"
						c="dimmed"
					>
						Connectome lists the projects added here. It cannot yet find an instance
						that was never added, stop an instance it did not start, or idle an
						instance.
					</Text>
					{status.error && (
						<Alert
							color="red"
							title="Connectome could not read the project instances"
						>
							{describeRrdError(status.error)}
						</Alert>
					)}
					{rows.map((row) => (
						<ProjectRow
							key={row.project}
							row={row}
							activity={activity[row.project]}
							review={reviews[row.project]}
							canServe={adapter.isServeSupported}
							onOpen={() => {
								const engram = row.instance.engram;
								if (engram)
									void act(row.project, "opening", async () =>
										open(await saveServed(engram)),
									);
							}}
							onStart={() => startRow(row.project)}
							onStop={() =>
								void act(row.project, "stopping", async () => {
									await disconnectProject(row.project, queryClient);
									await adapter.stopEngram(row.project);
								})
							}
							onDismiss={() =>
								void act(row.project, "stopping", async () => {
									await adapter.stopEngram(row.project);
								})
							}
							onRemove={() => confirmRemove(row)}
							onInstall={() => install(row.project, reviews[row.project])}
							onCancelReview={() => cancelReview(row.project)}
						/>
					))}
					{rows.length === 0 && <Text c="dimmed">No projects yet. Add one below.</Text>}
					<AddProject
						canServe={adapter.isServeSupported}
						onAdd={add}
					/>
					{!adapter.isServeSupported && (
						<Text size="sm">Starting local processes requires the desktop app.</Text>
					)}
				</Stack>
			</Modal>
		</>
	);
}

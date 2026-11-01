import {
	Alert,
	Badge,
	Button,
	Group,
	Loader,
	Modal,
	Paper,
	ScrollArea,
	Select,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import { adapter } from "~/adapter";
import { ActionButton } from "~/components/ActionButton";
import { Icon } from "~/components/Icon";
import { useConnectionNavigator, useIntent } from "~/hooks/routing";
import { iconPlay } from "~/icons";
import { connectionProject } from "~/rrflow/instances";
import { describeRrdError } from "~/rrflow/runtime";
import { RrdSessionClient } from "~/rrflow/session";
import { sessionQueryKey } from "~/screens/connectome/pages/RuntimeConnection/session";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";
import type {
	EstatePreview,
	EstateSelection,
	InstanceState,
	ProjectInstance,
	ServedEstate,
} from "~/types";
import { resolveServedConnection } from "./served-connection";

/** How often instances are looked at: while the dialog is open, and otherwise. */
const OPEN_REFRESH_MS = 2000;
const BACKGROUND_REFRESH_MS = 5000;

const STAGE_LABEL: Record<NonNullable<ProjectInstance["stage"]>, string> = {
	engine: "Resolving the engine",
	attach: "Proving a running instance",
	install: "Installing",
	serve: "Starting the engine",
	ready: "Proving readiness",
	stop: "Stopping",
};

const STATE_COLOR: Record<InstanceState, string> = {
	starting: "blue",
	ready: "green",
	stopping: "orange",
	stopped: "gray",
	failed: "red",
};

function stateLabel(instance: ProjectInstance) {
	const stage = instance.stage ? STAGE_LABEL[instance.stage] : undefined;
	switch (instance.state) {
		case "starting":
			return stage ?? "Starting";
		case "ready":
			return instance.origin === "elsewhere"
				? "Running · started outside Connectome"
				: "Running";
		case "stopping":
			return "Stopping";
		case "stopped":
			return "Stopped";
		case "failed":
			return stage ? `Failed · ${stage.toLowerCase()}` : "Failed";
	}
}

/** One project row: a known project, or an instance the registry tracks. */
interface ProjectRow {
	project: string;
	name: string;
	instance: ProjectInstance;
}

const lastSegment = (project: string) =>
	project.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ?? "Local project";

export function DatabaseServing() {
	const [opened, setOpened] = useState(false);
	const [selection, setSelection] = useState<EstateSelection>(() => ({
		...useConfigStore.getState().settings.serving,
	}));
	const [preview, setPreview] = useState<{
		value: EstatePreview;
		selection: EstateSelection;
	} | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const navigate = useConnectionNavigator();
	const connections = useConfigStore((state) => state.connections);
	const instances = useDatabaseStore((state) => state.instances);
	const known = useMemo(
		() =>
			connections.flatMap((connection) => {
				const project = connectionProject(connection);
				return project ? [{ project, name: connection.name }] : [];
			}),
		[connections],
	);
	const status = useQuery({
		queryKey: ["project-instances", known.map((entry) => entry.project)],
		queryFn: () => adapter.projectInstances(known.map((entry) => entry.project)),
		enabled: adapter.isServeSupported,
		refetchInterval: opened ? OPEN_REFRESH_MS : BACKGROUND_REFRESH_MS,
	});
	useEffect(() => {
		if (status.data) useDatabaseStore.getState().applyStatus(status.data);
	}, [status.data]);
	const rows = useMemo(() => {
		const rows: ProjectRow[] = [];
		const seen = new Set<string>();
		const stopped = (project: string): ProjectInstance => ({
			project,
			state: "stopped",
			origin: "connectome",
			detail: "Not running.",
			revision: 0,
		});
		for (const entry of known) {
			if (seen.has(entry.project)) continue;
			seen.add(entry.project);
			rows.push({
				project: entry.project,
				name: entry.name,
				instance: instances[entry.project] ?? stopped(entry.project),
			});
		}
		for (const instance of Object.values(instances)) {
			if (seen.has(instance.project) || instance.state === "stopped") continue;
			seen.add(instance.project);
			rows.push({ project: instance.project, name: lastSegment(instance.project), instance });
		}
		return rows;
	}, [known, instances]);
	const owned = Object.values(instances).filter(
		(instance) =>
			instance.origin === "connectome" &&
			(instance.state === "starting" ||
				instance.state === "ready" ||
				instance.state === "stopping"),
	).length;
	useIntent("toggle-serving", () => setOpened(true));
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["project-instances"] });
	const run = async (action: () => Promise<void>) => {
		setPending(true);
		setError(null);
		try {
			await action();
		} catch (cause) {
			setError(describeRrdError(cause));
		} finally {
			setPending(false);
			await refresh();
		}
	};
	const start = async (request: EstateSelection, digest?: string) => {
		const estate = await adapter.serveEstate(digest, request);
		setPreview(null);
		useDatabaseStore.getState().confirmServing(estate);
		navigate(resolveServedConnection(estate));
		setOpened(false);
	};
	const prepare = (request: EstateSelection) =>
		run(async () => {
			const value = await adapter.previewEstate(request);
			// Freeze the resolved directory, mode, executable and the identity the
			// engine planned with, so the plan applied is the plan reviewed.
			const resolved = {
				...request,
				project: value.project,
				installationIdentity: value.installation_identity ?? undefined,
			};
			if (value.installation) setPreview({ value, selection: resolved });
			else await start(resolved);
		});
	const startKnown = (project: string) =>
		prepare({ ...useConfigStore.getState().settings.serving, project, mode: "existing" });
	const disconnect = async (estate: ServedEstate) => {
		const profiles = useConfigStore
			.getState()
			.connections.filter(
				(c) =>
					c.target === "runtime" &&
					c.runtimeCredential === estate.credential_path &&
					`${c.authentication.protocol}://${c.authentication.hostname}` ===
						estate.endpoint,
			);
		for (const profile of profiles) {
			await new RrdSessionClient(profile.id).disconnect();
			queryClient.setQueryData(sessionQueryKey(profile.id), null);
		}
	};
	const stop = (estate: ServedEstate) =>
		run(async () => {
			await disconnect(estate);
			await adapter.stopEstate(estate.project);
		});
	const dismiss = (project: string) =>
		run(async () => {
			await adapter.stopEstate(project);
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
				onClose={() => {
					if (!pending) {
						setOpened(false);
						setPreview(null);
					}
				}}
				title="Project engines"
				size="xl"
				closeOnEscape={!pending}
				closeOnClickOutside={!pending}
			>
				<Stack>
					<Text>
						Run independent RRFlow engines for your projects. Opening or running
						projects together does not share their context.
					</Text>
					<Badge variant="light">
						Up to 4 local engines · 8 authenticated connections
					</Badge>
					<Text size="sm">
						Each engine uses its configured resources. This desktop limit does not
						reserve combined CPU or memory for your machine.
					</Text>
					{(error || status.error) && (
						<Alert
							color="red"
							title="Project operation failed"
						>
							{error ?? describeRrdError(status.error)}
						</Alert>
					)}
					{rows.map(({ project, name, instance }) => (
						<Paper
							key={project}
							withBorder
							p="md"
						>
							<Group
								justify="space-between"
								wrap="nowrap"
								align="flex-start"
							>
								<Text
									fw={600}
									style={{ overflowWrap: "anywhere" }}
								>
									{name}
								</Text>
								<Badge
									variant="light"
									color={STATE_COLOR[instance.state]}
									leftSection={
										instance.state === "starting" ||
										instance.state === "stopping" ? (
											<Loader
												size={10}
												color={STATE_COLOR[instance.state]}
											/>
										) : undefined
									}
									style={{ flexShrink: 0 }}
								>
									{stateLabel(instance)}
								</Badge>
							</Group>
							<Text
								size="xs"
								c="dimmed"
								style={{ overflowWrap: "anywhere" }}
							>
								{project}
							</Text>
							<Text
								size="sm"
								mt={4}
								style={{ overflowWrap: "anywhere" }}
							>
								{instance.detail}
							</Text>
							<Group mt="sm">
								{instance.state === "ready" && instance.estate && (
									<Button
										variant="light"
										disabled={pending}
										onClick={() => {
											if (!instance.estate) return;
											navigate(resolveServedConnection(instance.estate));
											setOpened(false);
										}}
									>
										Open project
									</Button>
								)}
								{instance.state === "ready" &&
									instance.estate &&
									(instance.origin === "connectome" ? (
										<Button
											variant="subtle"
											color="red"
											disabled={pending}
											onClick={() => instance.estate && stop(instance.estate)}
										>
											Stop this engine
										</Button>
									) : (
										<Text
											size="sm"
											c="dimmed"
										>
											Connectome did not start it, so it is stopped where it
											was started.
										</Text>
									))}
								{instance.state === "stopped" && (
									<Button
										variant="light"
										loading={pending}
										disabled={!adapter.isServeSupported || owned >= 4}
										onClick={() => startKnown(project)}
									>
										Start
									</Button>
								)}
								{instance.state === "failed" && (
									<>
										<Button
											variant="light"
											disabled={pending || owned >= 4}
											onClick={() => startKnown(project)}
										>
											Try again
										</Button>
										<Button
											variant="subtle"
											color="gray"
											disabled={pending}
											onClick={() => dismiss(project)}
										>
											Dismiss
										</Button>
									</>
								)}
							</Group>
						</Paper>
					))}
					{rows.length === 0 && (
						<Text c="dimmed">No local project engines are running.</Text>
					)}
					{preview ? (
						<>
							<Text fw={700}>Review your local RRFlow installation</Text>
							<Text style={{ overflowWrap: "anywhere" }}>
								{preview.value.project}
							</Text>
							<Alert title="Exact installation preview">
								Review the paths, permissions and configuration. Installing creates
								project-local data and credentials. It enables no cloud upload or
								training.
							</Alert>
							<ScrollArea h={260}>
								<pre
									style={{
										whiteSpace: "pre-wrap",
										overflowWrap: "anywhere",
										fontSize: 12,
									}}
								>
									{JSON.stringify(preview.value.installation, null, 2)}
								</pre>
							</ScrollArea>
							<Group>
								<Button
									variant="subtle"
									disabled={pending}
									onClick={() => setPreview(null)}
								>
									Cancel
								</Button>
								<Button
									loading={pending}
									onClick={() =>
										run(() =>
											start(
												preview.selection,
												preview.value.installation?.installation
													.plan_sha256,
											),
										)
									}
								>
									Install and open RRFlow
								</Button>
							</Group>
						</>
					) : (
						<>
							<Text fw={700}>Open another project</Text>
							<Group align="end">
								<TextInput
									flex={1}
									label="Project directory"
									description="An absolute project folder; leave empty for Connectome's local estate."
									value={selection.project}
									disabled={pending}
									onChange={(e) =>
										setSelection({
											...selection,
											project: e.currentTarget.value,
										})
									}
								/>
								<Button
									variant="light"
									disabled={!adapter.isServeSupported || pending}
									onClick={() =>
										run(async () => {
											const path = await open({
												directory: true,
												multiple: false,
											});
											if (typeof path === "string")
												setSelection({ ...selection, project: path });
										})
									}
								>
									Choose folder
								</Button>
							</Group>
							<Select
								label="Project mode"
								value={selection.mode}
								disabled={pending}
								data={[
									{ value: "fresh", label: "Fresh project" },
									{ value: "existing", label: "Existing project" },
								]}
								onChange={(mode) => {
									if (mode === "fresh" || mode === "existing")
										setSelection({ ...selection, mode });
								}}
							/>
							<Button
								loading={pending}
								disabled={!adapter.isServeSupported || owned >= 4}
								onClick={() => prepare({ ...selection })}
							>
								Preview or open project
							</Button>
						</>
					)}
					{!adapter.isServeSupported && (
						<Text size="sm">Starting local processes requires the desktop app.</Text>
					)}
				</Stack>
			</Modal>
		</>
	);
}

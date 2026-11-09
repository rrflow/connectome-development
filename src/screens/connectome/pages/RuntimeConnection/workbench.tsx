import {
	Alert,
	Badge,
	Button,
	Group,
	Paper,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
	Timeline,
	Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import { describeRrdError } from "~/rrflow/runtime";
import type { RrdSessionClient } from "~/rrflow/session";
import { newId } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import type { WorkbenchLearningEvent, WorkbenchRunKind } from "~/types";
import { formatTime } from "./format";
import { FlightEventMap, ProjectVisuals } from "./visuals";
import { WorkbenchDatasetPlans } from "./workbenchDatasetPlans";
import { runWorkbenchEventActions } from "./workbenchEventActions";
import { WorkbenchGuidedRoutes } from "./workbenchGuidedRoutes";
import { WorkbenchRuntimeActions } from "./workbenchRuntimeActions";
import { WorkbenchSources } from "./workbenchSources";
import { normalizeWorkbenchState } from "./workbenchState";
import { WorkbenchTemplateAuthoring } from "./workbenchTemplateAuthoring";
import { resolveTemplateRoute, WorkbenchTemplateLibrary } from "./workbenchTemplateLibrary";
import { WorkbenchTemplateTransfer } from "./workbenchTemplateTransfer";

/** Engine flight readback is the source of the timeline; local notes are separate. */
export function WorkbenchPanel({
	client,
	connectionId,
	sessionKey,
	connected,
	onOpenGraph,
	onOpenStorage,
	onSelectRecord,
	onOpenRoute,
}: {
	client: RrdSessionClient;
	connectionId: string;
	sessionKey: string;
	connected: boolean;
	onOpenGraph: () => void;
	onOpenStorage: () => void;
	onSelectRecord: (record: string) => void;
	onOpenRoute: (route: string) => void;
}) {
	const [prompt, setPrompt] = useState("");
	const [contextMode, setContextMode] = useState<"fresh" | "pruned">("pruned");
	const [selection, setSelection] = useState<{ sessionKey: string; id: string } | null>(null);
	const [page, setPage] = useState<{ sessionKey: string; cursor: number }>({
		sessionKey,
		cursor: 0,
	});
	const selected = selection?.sessionKey === sessionKey ? selection.id : null;
	const afterCursor = page.sessionKey === sessionKey ? page.cursor : 0;
	const [workbenchName, setWorkbenchName] = useState("");
	const [workbenchDescription, setWorkbenchDescription] = useState("");
	const [noteKind, setNoteKind] = useState<WorkbenchRunKind>("testing");
	const [noteIntent, setNoteIntent] = useState("");
	const [noteContext, setNoteContext] = useState("");
	const [noteDiagnostics, setNoteDiagnostics] = useState("");
	const [eventError, setEventError] = useState<string | null>(null);
	const [eventMessage, setEventMessage] = useState<string | null>(null);
	const [runningEvents, setRunningEvents] = useState<{ generation: number; id: string }[]>([]);
	const runningEventKeys = useRef(new Set<string>());
	const queryClient = useQueryClient();
	const local = useConfigStore(
		(state) =>
			state.connections.find((connection) => connection.id === connectionId)?.workbench,
	);
	const activeWorkbench = local?.activeWorkbenchId ?? local?.workbenches[0]?.id ?? null;
	const captureLifecycle = useRef({
		generation: 0,
		connectionId,
		sessionKey,
		connected,
		workbenchId: activeWorkbench,
	});
	useLayoutEffect(() => {
		const generation = captureLifecycle.current.generation + 1;
		captureLifecycle.current = {
			generation,
			connectionId,
			sessionKey,
			connected,
			workbenchId: activeWorkbench,
		};
		setEventError(null);
		setEventMessage(null);
		setRunningEvents([]);
		return () => {
			if (captureLifecycle.current.generation === generation) {
				captureLifecycle.current = {
					...captureLifecycle.current,
					generation: generation + 1,
					connected: false,
				};
			}
		};
	}, [connectionId, sessionKey, connected, activeWorkbench]);
	const createWorkbench = () => {
		const name = workbenchName.trim();
		const store = useConfigStore.getState();
		const connection = store.connections.find((item) => item.id === connectionId);
		if (!name || !connection) return;
		const previous = normalizeWorkbenchState(connection.workbench, newId);
		const now = Date.now();
		const id = newId();
		store.updateConnection({
			id: connectionId,
			workbench: {
				...previous,
				workbenches: [
					...previous.workbenches,
					{
						id,
						name,
						description: workbenchDescription.trim(),
						createdAtUnixMs: now,
						updatedAtUnixMs: now,
					},
				],
				activeWorkbenchId: id,
			},
		});
		setWorkbenchName("");
		setWorkbenchDescription("");
	};
	const selectWorkbench = (id: string | null) => {
		const store = useConfigStore.getState();
		const connection = store.connections.find((item) => item.id === connectionId);
		if (id && connection?.workbench)
			store.updateConnection({
				id: connectionId,
				workbench: {
					...normalizeWorkbenchState(connection.workbench, newId),
					activeWorkbenchId: id,
				},
			});
	};
	const saveNote = (
		workbenchId: string,
		intent: string,
		context: string,
		diagnostics: string,
		kind: WorkbenchRunKind = noteKind,
	) => {
		const store = useConfigStore.getState();
		const connection = store.connections.find((item) => item.id === connectionId);
		if (!connection?.workbench) throw new Error("Local workbench is no longer available");
		const current = normalizeWorkbenchState(connection.workbench, newId);
		if (!current.workbenches.some((item) => item.id === workbenchId))
			throw new Error("Local workbench is no longer available");
		const now = Date.now();
		store.updateConnection({
			id: connectionId,
			workbench: {
				...current,
				workbenches: current.workbenches.map((item) =>
					item.id === workbenchId ? { ...item, updatedAtUnixMs: now } : item,
				),
				receipts: [
					{
						id: newId(),
						workbenchId,
						kind,
						intent,
						context,
						diagnostics,
						recordedAtUnixMs: now,
					},
					...current.receipts,
				],
			},
		});
	};
	const capture = useMutation({
		mutationFn: async (request: {
			workbenchId: string;
			connectionId: string;
			sessionKey: string;
			generation: number;
			isCurrent?: () => boolean;
		}) => {
			const [capabilities, database, storage, vectors] = await Promise.all([
				client.capabilities(),
				client.database(),
				client.storage(),
				client.vectorCollections(),
			]);
			const diagnostics = `Engine ${capabilities.implementation} ${capabilities.implementation_version}; configuration revision ${capabilities.configuration_revision}; records in returned graph ${database.graph.nodes.length}; relationships in returned graph ${database.graph.edges.length}; storage cursor ${storage.runtime_cursor}; storage profile ${storage.physical.profile}; vector collections in returned catalogue ${vectors.collections.length}.`;
			const current = captureLifecycle.current;
			if (
				!request.sessionKey ||
				!current.connected ||
				request.connectionId !== current.connectionId ||
				request.sessionKey !== current.sessionKey ||
				request.workbenchId !== current.workbenchId ||
				request.generation !== current.generation ||
				(request.isCurrent && !request.isCurrent())
			)
				return;
			saveNote(
				request.workbenchId,
				noteIntent.trim() || "Engine diagnostic snapshot",
				noteContext.trim(),
				diagnostics,
			);
		},
	});
	const snapshotKey = ["rrd-workbench-snapshot", sessionKey, afterCursor];
	const snapshot = useQuery({
		queryKey: snapshotKey,
		queryFn: () => client.workbenchSnapshot(afterCursor),
		enabled: connected,
		retry: false,
	});
	const runLearningEvent = async (templateId: string, event: WorkbenchLearningEvent) => {
		const start = { ...captureLifecycle.current };
		const eventKey = JSON.stringify([templateId, event.id]);
		const eventSnapshot = JSON.stringify(event);
		const key = `${start.generation}:${eventKey}`;
		if (runningEventKeys.current.has(key)) return;
		runningEventKeys.current.add(key);
		setRunningEvents((events) => [...events, { generation: start.generation, id: eventKey }]);
		setEventError(null);
		setEventMessage(null);
		const sameLifecycle = () => {
			const now = captureLifecycle.current;
			return (
				now.generation === start.generation &&
				now.connectionId === start.connectionId &&
				now.sessionKey === start.sessionKey &&
				now.connected === start.connected &&
				now.workbenchId === start.workbenchId
			);
		};
		const isCurrent = () => {
			const connection = useConfigStore
				.getState()
				.connections.find((candidate) => candidate.id === start.connectionId);
			const workbench = connection?.workbench;
			const currentWorkbenchId =
				workbench?.activeWorkbenchId ?? workbench?.workbenches[0]?.id ?? null;
			return (
				sameLifecycle() &&
				currentWorkbenchId === start.workbenchId &&
				Boolean(
					workbench?.templates?.some(
						(template) =>
							template.id === templateId &&
							template.learningEvents?.some(
								(item) =>
									item.id === event.id && JSON.stringify(item) === eventSnapshot,
							),
					),
				)
			);
		};
		try {
			await runWorkbenchEventActions(event.actions, {
				resolveRoute: resolveTemplateRoute,
				canReadEngine: connected && Boolean(sessionKey),
				canCapture: Boolean(activeWorkbench) && !capture.isPending,
				isCurrent,
				openRoute: onOpenRoute,
				refreshStorage: async () => {
					const data = await client.storage();
					if (isCurrent()) {
						queryClient.setQueryData(["rrd-storage", sessionKey], data);
					}
				},
				refreshFlights: async () => {
					const data = await client.workbenchSnapshot(afterCursor);
					if (isCurrent()) queryClient.setQueryData(snapshotKey, data);
				},
				captureDiagnostics: async () => {
					if (!start.workbenchId) throw new Error("Local workbench is unavailable.");
					await capture.mutateAsync({
						workbenchId: start.workbenchId,
						connectionId: start.connectionId,
						sessionKey: start.sessionKey,
						generation: start.generation,
						isCurrent,
					});
				},
			});
			if (isCurrent()) {
				if (start.workbenchId) {
					const template = useConfigStore
						.getState()
						.connections.find((candidate) => candidate.id === start.connectionId)
						?.workbench?.templates?.find((candidate) => candidate.id === templateId);
					if (!template) throw new Error("Event template is no longer available.");
					saveNote(
						start.workbenchId,
						`MCPL event executed: ${event.title}`,
						`template=${template.name}; kind=${event.kind}; mode=${event.mode}; component=${event.component}`,
						`actions=${event.actions.map((action) => action.name).join(",")}; triggers=${event.triggers.map((trigger) => trigger.kind).join(",")}; catamorphism=${event.catamorphismTarget}`,
						"testing",
					);
				}
				setEventMessage(`Event "${event.title}" completed.`);
			}
		} catch (error) {
			if (sameLifecycle()) {
				const message = error instanceof Error ? error.message : String(error);
				setEventError(
					`Event stopped: ${message}. Earlier actions may already have completed.`,
				);
			}
		} finally {
			runningEventKeys.current.delete(key);
			if (sameLifecycle())
				setRunningEvents((events) =>
					events.filter(
						(item) => item.generation !== start.generation || item.id !== eventKey,
					),
				);
		}
	};
	const detail = useQuery({
		queryKey: ["rrd-prompt-flight", sessionKey, selected],
		queryFn: () => {
			if (selected === null) throw new Error("No flight selected");
			return client.readPromptFlight({ flight_id: selected });
		},
		enabled: connected && selected !== null,
		retry: false,
	});
	const launch = useMutation({
		mutationFn: (request: {
			sessionKey: string;
			prompt: string;
			contextMode: "fresh" | "pruned";
		}) =>
			client.launchObserveFlight({
				prompt: request.prompt,
				context_mode: request.contextMode,
			}),
		onSuccess: async (result, request) => {
			setSelection({ sessionKey: request.sessionKey, id: result.flight_id });
			await queryClient.invalidateQueries({
				queryKey: ["rrd-workbench-snapshot", request.sessionKey],
			});
		},
	});

	return (
		<Stack gap="lg">
			<Title order={3}>Prompt workbench</Title>
			<Text>
				The observe flight stores the submitted prompt in the engine and shows its recorded
				events. It does not invoke an LFG classifier, SWAG router, or language model.
			</Text>
			{!connected && (
				<Alert title="Native session required">
					Connect this project to inspect or launch flights.
				</Alert>
			)}
			<Paper
				withBorder
				p="md"
			>
				<Stack>
					<Textarea
						label="Prompt"
						value={prompt}
						onChange={(event) => setPrompt(event.currentTarget.value)}
						minRows={3}
					/>
					<Select
						label="Context mode"
						value={contextMode}
						data={[
							{ value: "pruned", label: "Pruned" },
							{ value: "fresh", label: "Fresh" },
						]}
						allowDeselect={false}
						onChange={(value) => setContextMode(value === "fresh" ? "fresh" : "pruned")}
					/>
					<Group>
						<Button
							disabled={!connected || !prompt.trim()}
							loading={launch.isPending}
							onClick={() =>
								launch.mutate({ sessionKey, prompt: prompt.trim(), contextMode })
							}
						>
							Launch observe flight
						</Button>
						<Button
							variant="light"
							disabled={!connected}
							loading={snapshot.isFetching}
							onClick={() => void snapshot.refetch()}
						>
							Refresh flights
						</Button>
					</Group>
					{launch.isError && (
						<Alert
							color="red"
							title="Flight launch failed"
						>
							{describeRrdError(launch.error)}
						</Alert>
					)}
				</Stack>
			</Paper>
			{snapshot.isError && (
				<Alert
					color="red"
					title="Flights could not be read"
				>
					{describeRrdError(snapshot.error)}
				</Alert>
			)}
			{snapshot.data && (
				<Paper
					withBorder
					p="md"
				>
					<Stack>
						<Text fw={700}>
							Flights in creation order after cursor {snapshot.data.after_cursor}
						</Text>
						{snapshot.data.flights.length === 0 && <Text>No flights returned.</Text>}
						{snapshot.data.flights.map((flight) => (
							<Group
								key={flight.flight_id}
								justify="space-between"
							>
								<Text>
									{flight.flight_id} · {flight.status} · {flight.provider}
								</Text>
								<Button
									size="xs"
									variant={selected === flight.flight_id ? "filled" : "light"}
									onClick={() =>
										setSelection({ sessionKey, id: flight.flight_id })
									}
								>
									Inspect
								</Button>
							</Group>
						))}
						<Group>
							<Button
								variant="light"
								disabled={afterCursor === 0}
								onClick={() => setPage({ sessionKey, cursor: 0 })}
							>
								First page
							</Button>
							<Button
								variant="light"
								disabled={
									!snapshot.data.truncated || snapshot.data.flights.length === 0
								}
								onClick={() => {
									const last = snapshot.data.flights.at(-1);
									if (last) setPage({ sessionKey, cursor: last.flight_cursor });
								}}
							>
								Next page
							</Button>
						</Group>
					</Stack>
				</Paper>
			)}
			{detail.isError && (
				<Alert
					color="red"
					title="Flight detail could not be read"
				>
					{describeRrdError(detail.error)}
				</Alert>
			)}
			{detail.data && (
				<Paper
					withBorder
					p="md"
				>
					<Stack>
						<FlightEventMap flight={detail.data} />
						<Group>
							<Title order={4}>Recorded events</Title>
							<Badge>{detail.data.status}</Badge>
							<Badge variant="outline">{detail.data.provider}</Badge>
						</Group>
						<Text size="sm">
							{detail.data.flight_id} · {detail.data.context_mode} ·{" "}
							{detail.data.elapsed_ms} ms · cursor {detail.data.known_at_cursor}
						</Text>
						<Text size="sm">
							Context: {detail.data.context_items} items,{" "}
							{detail.data.context_output_bytes} bytes
						</Text>
						{detail.data.events.length === 0 ? (
							<Text>No events were returned.</Text>
						) : (
							<Timeline
								active={detail.data.events.length - 1}
								bulletSize={24}
								lineWidth={2}
							>
								{detail.data.events.map((event) => (
									<Timeline.Item
										key={event.ordinal}
										title={`${event.ordinal}: ${event.stage} · ${event.label}`}
									>
										<Text size="sm">{event.detail}</Text>
										<Text
											size="xs"
											c="dimmed"
										>
											{formatTime(event.at_unix_ms)} · {event.elapsed_ms} ms
											elapsed
										</Text>
									</Timeline.Item>
								))}
							</Timeline>
						)}
					</Stack>
				</Paper>
			)}
			<ProjectVisuals
				client={client}
				sessionKey={sessionKey}
				connected={connected}
				onOpenGraph={onOpenGraph}
				onOpenStorage={onOpenStorage}
				onSelectRecord={onSelectRecord}
			/>
			<WorkbenchRuntimeActions
				key={JSON.stringify([connectionId, sessionKey, connected, activeWorkbench])}
				client={client}
				sessionKey={sessionKey}
				connected={connected && Boolean(sessionKey)}
				canCapture={Boolean(activeWorkbench) && !capture.isPending}
				onOpenRoute={onOpenRoute}
				captureDiagnostics={async (isCurrent) => {
					const start = { ...captureLifecycle.current };
					if (!start.workbenchId) throw new Error("Local workbench is unavailable.");
					await capture.mutateAsync({
						workbenchId: start.workbenchId,
						connectionId: start.connectionId,
						sessionKey: start.sessionKey,
						generation: start.generation,
						isCurrent,
					});
					if (!isCurrent())
						throw new Error("Workbench context changed; capture stopped.");
				}}
			/>
			<WorkbenchGuidedRoutes onOpenRoute={onOpenRoute} />
			<WorkbenchTemplateTransfer
				key={`transfer-${connectionId}`}
				connectionId={connectionId}
			/>
			<WorkbenchTemplateAuthoring
				key={`authoring-${connectionId}`}
				connectionId={connectionId}
			/>
			<WorkbenchTemplateLibrary
				key={`library-${connectionId}`}
				connectionId={connectionId}
				onOpenRoute={onOpenRoute}
				onRunLearningEvent={(templateId, event) => void runLearningEvent(templateId, event)}
				eventExecutionError={eventError}
				runningEventIds={runningEvents
					.filter((item) => item.generation === captureLifecycle.current.generation)
					.map((item) => item.id)}
			/>
			{eventMessage && <Text size="sm">{eventMessage}</Text>}
			<WorkbenchDatasetPlans
				key={`dataset-${connectionId}`}
				state={local}
			/>
			<WorkbenchSources
				key={`sources-${connectionId}`}
				connectionId={connectionId}
			/>
			<Paper
				withBorder
				p="md"
			>
				<Title order={4}>Local workbench notes</Title>
				<Text size="sm">
					These notes are stored in this desktop profile; they are not engine audit
					receipts.
				</Text>
				<TextInput
					label="Workbench name"
					value={workbenchName}
					onChange={(event) => setWorkbenchName(event.currentTarget.value)}
				/>
				<TextInput
					label="Workbench description"
					value={workbenchDescription}
					onChange={(event) => setWorkbenchDescription(event.currentTarget.value)}
				/>
				<Button
					variant="light"
					disabled={!workbenchName.trim()}
					onClick={createWorkbench}
				>
					Create local workbench
				</Button>
				<Select
					label="Local workbench"
					value={activeWorkbench}
					data={(local?.workbenches ?? []).map((item) => ({
						value: item.id,
						label: item.name,
					}))}
					onChange={selectWorkbench}
				/>
				{(local?.workbenches ?? []).map((workbench) => (
					<Text key={workbench.id}>
						{workbench.name}: {workbench.description}
					</Text>
				))}
				<Select
					label="Note category"
					value={noteKind}
					data={["testing", "reverse-engineering", "optimization", "release-update"]}
					allowDeselect={false}
					onChange={(value) =>
						setNoteKind((value as WorkbenchRunKind | null) ?? "testing")
					}
				/>
				<TextInput
					label="Note intent"
					value={noteIntent}
					onChange={(event) => setNoteIntent(event.currentTarget.value)}
				/>
				<Textarea
					label="Note context"
					value={noteContext}
					onChange={(event) => setNoteContext(event.currentTarget.value)}
				/>
				<Textarea
					label="Note diagnostics"
					value={noteDiagnostics}
					onChange={(event) => setNoteDiagnostics(event.currentTarget.value)}
				/>
				<Group>
					<Button
						disabled={!activeWorkbench || !noteIntent.trim()}
						onClick={() => {
							if (activeWorkbench) {
								saveNote(
									activeWorkbench,
									noteIntent.trim(),
									noteContext.trim(),
									noteDiagnostics.trim(),
								);
								setNoteIntent("");
								setNoteContext("");
								setNoteDiagnostics("");
							}
						}}
					>
						Save local note
					</Button>
					<Button
						variant="light"
						disabled={!connected || !activeWorkbench}
						loading={capture.isPending}
						onClick={() => {
							if (activeWorkbench)
								capture.mutate({
									workbenchId: activeWorkbench,
									connectionId,
									sessionKey,
									generation: captureLifecycle.current.generation,
								});
						}}
					>
						Capture engine diagnostics
					</Button>
				</Group>
				{capture.isError &&
					capture.variables?.connectionId === connectionId &&
					capture.variables?.sessionKey === sessionKey &&
					capture.variables?.workbenchId === activeWorkbench &&
					capture.variables?.generation === captureLifecycle.current.generation && (
						<Alert
							color="red"
							title="Diagnostics could not be read"
						>
							{describeRrdError(capture.error)}
						</Alert>
					)}
				{(local?.receipts ?? []).map((receipt) => (
					<details key={receipt.id}>
						<summary>
							{receipt.kind} · {receipt.intent}
						</summary>
						<Text size="sm">{receipt.context}</Text>
						<Text size="sm">{receipt.diagnostics}</Text>
					</details>
				))}
			</Paper>
		</Stack>
	);
}

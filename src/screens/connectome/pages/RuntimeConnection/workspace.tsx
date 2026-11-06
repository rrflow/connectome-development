import {
	Alert,
	Badge,
	Button,
	Group,
	Paper,
	Select,
	SimpleGrid,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	RrdPromptFlightDetailView,
	RrdSessionClient,
	RrdWorkbenchSnapshotView,
} from "~/rrflow/session";
import { newId } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import type { ConnectionWorkbenchState, WorkbenchRunKind } from "~/types";

const prerequisites = {
	paths: [
		[
			"Scope the source",
			"Select the remote database, collection or namespace for this project. Store credentials in the native credential boundary, never in graph records.",
		],
		[
			"Preview the import",
			"Show source identity, access permissions, schema mapping, embedding dimensions, freshness, limits and projected cost before any ingestion.",
		],
		[
			"Keep the evidence",
			"Every imported record and relationship needs its source, version and retrieval time. Revocation and deletion must remove access and invalidate derived results.",
		],
	],
	learning: [
		[
			"Supervised learning",
			"Review examples and corrections, choose the permitted dataset, and compare a candidate against a fixed evaluation baseline before promotion.",
		],
		[
			"Unsupervised exploration",
			"Discover clusters and propose relationships from authorized data. Suggestions remain unverified until evidence or review supports them.",
		],
		[
			"Safe promotion",
			"Training, context sharing and cloud synchronization require separate consent. Keep the prior configuration and evaluation receipts so an accepted change can be rolled back.",
		],
	],
	services: [
		[
			"Subscription clients",
			"Connect through a provider's supported client and authentication flow. A chat subscription does not establish API credit or permission for background inference.",
		],
		[
			"API providers",
			"An explicit endpoint, model, credential reference, spend limit and fallback policy are required. Never silently switch to paid API usage.",
		],
		[
			"Local models",
			"A local endpoint still needs capability discovery, context and concurrency limits, timeouts, and an evaluated routing policy.",
		],
	],
} as const;

const workbenchKindOptions: { value: WorkbenchRunKind; label: string }[] = [
	{ value: "testing", label: "Testing" },
	{ value: "reverse-engineering", label: "Reverse engineering" },
	{ value: "optimization", label: "Optimization" },
	{ value: "release-update", label: "Release update" },
];

const flightContextModeOptions = [
	{ value: "fresh", label: "Fresh" },
	{ value: "pruned", label: "Pruned" },
] as const;

function normalizeWorkbench(state: ConnectionWorkbenchState | undefined): ConnectionWorkbenchState {
	return {
		workbenches: state?.workbenches ?? [],
		activeWorkbenchId: state?.activeWorkbenchId,
		receipts: state?.receipts ?? [],
	};
}

function Requirements({ items }: { items: readonly (readonly [string, string])[] }) {
	return (
		<SimpleGrid cols={{ base: 1, md: 3 }}>
			{items.map(([title, body]) => (
				<Paper
					key={title}
					withBorder
					p="md"
				>
					<Text fw={650}>{title}</Text>
					<Text
						mt="xs"
						size="sm"
					>
						{body}
					</Text>
				</Paper>
			))}
		</SimpleGrid>
	);
}

export function ProjectSection({
	section,
	detail,
	connected,
	sessionClient,
	connectionId,
	onOpen,
}: {
	section: string;
	detail?: string;
	connected: boolean;
	sessionClient?: RrdSessionClient;
	connectionId: string;
	onOpen: (section: string) => void;
}) {
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === connectionId),
	);
	const updateConnection = useConfigStore((state) => state.updateConnection);
	const workbench = useMemo(
		() => normalizeWorkbench(connection?.workbench),
		[connection?.workbench],
	);
	const activeWorkbenchId = workbench.activeWorkbenchId ?? workbench.workbenches[0]?.id;
	const activeWorkbench =
		workbench.workbenches.find((candidate) => candidate.id === activeWorkbenchId) ?? null;
	const [newWorkbenchName, setNewWorkbenchName] = useState("");
	const [newWorkbenchDescription, setNewWorkbenchDescription] = useState("");
	const [receiptKind, setReceiptKind] = useState<WorkbenchRunKind>("testing");
	const [receiptIntent, setReceiptIntent] = useState("");
	const [receiptContext, setReceiptContext] = useState("");
	const [receiptDiagnostics, setReceiptDiagnostics] = useState("");
	const [receiptCaptureError, setReceiptCaptureError] = useState<string | null>(null);
	const [capturingReceipt, setCapturingReceipt] = useState(false);
	const [flightPrompt, setFlightPrompt] = useState("");
	const [flightContextMode, setFlightContextMode] = useState<"fresh" | "pruned">("pruned");
	const [flightAcceptanceMarker, setFlightAcceptanceMarker] = useState("");
	const [launchFlightError, setLaunchFlightError] = useState<string | null>(null);
	const [launchingFlight, setLaunchingFlight] = useState(false);
	const [workbenchSnapshot, setWorkbenchSnapshot] = useState<RrdWorkbenchSnapshotView | null>(
		null,
	);
	const [snapshotError, setSnapshotError] = useState<string | null>(null);
	const [loadingSnapshot, setLoadingSnapshot] = useState(false);
	const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
	const [selectedFlightDetail, setSelectedFlightDetail] =
		useState<RrdPromptFlightDetailView | null>(null);
	const [loadingFlightDetail, setLoadingFlightDetail] = useState(false);
	const [flightDetailError, setFlightDetailError] = useState<string | null>(null);

	const saveWorkbench = (next: ConnectionWorkbenchState) => {
		if (!connection) {
			return;
		}

		updateConnection({
			id: connection.id,
			workbench: next,
		});
	};

	const createWorkbench = () => {
		const name = newWorkbenchName.trim();
		if (!name) {
			return;
		}

		const now = Date.now();
		const id = newId();
		const definition = {
			id,
			name,
			description: newWorkbenchDescription.trim(),
			createdAtUnixMs: now,
			updatedAtUnixMs: now,
		};
		saveWorkbench({
			workbenches: [...workbench.workbenches, definition],
			activeWorkbenchId: id,
			receipts: workbench.receipts,
		});
		setNewWorkbenchName("");
		setNewWorkbenchDescription("");
	};

	const recordReceipt = () => {
		const intent = receiptIntent.trim();
		if (!activeWorkbench || !intent) {
			return;
		}

		const now = Date.now();
		saveWorkbench({
			workbenches: workbench.workbenches.map((candidate) =>
				candidate.id === activeWorkbench.id
					? { ...candidate, updatedAtUnixMs: now }
					: candidate,
			),
			activeWorkbenchId: activeWorkbench.id,
			receipts: [
				{
					id: newId(),
					workbenchId: activeWorkbench.id,
					kind: receiptKind,
					intent,
					context: receiptContext.trim(),
					diagnostics: receiptDiagnostics.trim(),
					recordedAtUnixMs: now,
				},
				...workbench.receipts,
			],
		});
		setReceiptIntent("");
		setReceiptContext("");
		setReceiptDiagnostics("");
	};

	const captureRuntimeReceipt = async () => {
		if (!activeWorkbench || !sessionClient || !connected) {
			return;
		}

		setCapturingReceipt(true);
		setReceiptCaptureError(null);
		try {
			const now = Date.now();
			let intent = receiptIntent.trim();
			let context = receiptContext.trim();
			let diagnostics = receiptDiagnostics.trim();

			if (receiptKind === "testing") {
				const [capabilities, database] = await Promise.all([
					sessionClient.capabilities(),
					sessionClient.database(),
				]);
				if (!intent) {
					intent = "Runtime testing snapshot";
				}
				if (!context) {
					context = "Engine capabilities and current project dataset shape.";
				}
				const available = capabilities.capabilities.filter(
					(capability) => capability.status === "available",
				).length;
				diagnostics =
					diagnostics ||
					`Capabilities available: ${available}/${capabilities.capabilities.length}; tables=${database.tables.length}; models=${database.models.length}; graphNodes=${database.graph.nodes.length}; graphEdges=${database.graph.edges.length}.`;
			} else if (receiptKind === "reverse-engineering") {
				const [schema, database] = await Promise.all([
					sessionClient.schema(),
					sessionClient.database(),
				]);
				if (!intent) {
					intent = "Project reverse-engineering snapshot";
				}
				if (!context) {
					context = "Schema inventory and graph topology for project mapping.";
				}
				diagnostics =
					diagnostics ||
					`Known cursor=${schema.known_at_cursor}; schemaRevision=${schema.schema_revision ?? "none"}; tableCount=${schema.tables.length}; graphNodes=${database.graph.nodes.length}; graphEdges=${database.graph.edges.length}.`;
			} else if (receiptKind === "optimization") {
				const [storage, vectors] = await Promise.all([
					sessionClient.storage(),
					sessionClient.vectorCollections(),
				]);
				if (!intent) {
					intent = "Runtime optimization snapshot";
				}
				if (!context) {
					context = "Storage and vector profile review for optimization candidates.";
				}
				const headline = storage.physical.headline
					.map((metric) => `${metric.id}=${metric.value}`)
					.join(", ");
				diagnostics =
					diagnostics ||
					`Storage profile=${storage.storage_profile}; runtimeCursor=${storage.runtime_cursor}; vectorCollections=${vectors.collections.length}; headlineMetrics=[${headline}].`;
			} else {
				const capabilities = await sessionClient.capabilities();
				if (!intent) {
					intent = "Release-update readiness snapshot";
				}
				if (!context) {
					context =
						"Engine identity, revision, and capability readiness for release update.";
				}
				diagnostics =
					diagnostics ||
					`Implementation=${capabilities.implementation} ${capabilities.implementation_version}; configRevision=${capabilities.configuration_revision}; capabilityCount=${capabilities.capabilities.length}.`;
			}
			const snapshot = await sessionClient.workbenchSnapshot();
			const latestTask = snapshot.latest_task
				? `${snapshot.latest_task.task_id} (${snapshot.latest_task.status})`
				: "none";
			const latestFlight = snapshot.latest_flight
				? `${snapshot.latest_flight.flight_id} (${snapshot.latest_flight.status})`
				: "none";
			const workbenchSummary = `scope=${snapshot.scope}; taskPageCount=${snapshot.task_count}; flightPageCount=${snapshot.flight_count}; latestTask=${latestTask}; latestFlight=${latestFlight}.`;
			diagnostics = diagnostics ? `${diagnostics} ${workbenchSummary}` : workbenchSummary;

			saveWorkbench({
				workbenches: workbench.workbenches.map((candidate) =>
					candidate.id === activeWorkbench.id
						? { ...candidate, updatedAtUnixMs: now }
						: candidate,
				),
				activeWorkbenchId: activeWorkbench.id,
				receipts: [
					{
						id: newId(),
						workbenchId: activeWorkbench.id,
						kind: receiptKind,
						intent,
						context,
						diagnostics,
						recordedAtUnixMs: now,
					},
					...workbench.receipts,
				],
			});
			setReceiptIntent("");
			setReceiptContext("");
			setReceiptDiagnostics("");
		} catch (error) {
			setReceiptCaptureError(error instanceof Error ? error.message : String(error));
		} finally {
			setCapturingReceipt(false);
		}
	};

	const launchObserveFlight = async () => {
		if (!activeWorkbench || !sessionClient || !connected) {
			return;
		}
		const prompt = flightPrompt.trim();
		if (!prompt) {
			setLaunchFlightError("Prompt is required to launch an observe flight.");
			return;
		}

		setLaunchingFlight(true);
		setLaunchFlightError(null);
		try {
			const launch = await sessionClient.launchObserveFlight({
				prompt,
				context_mode: flightContextMode,
				acceptance_marker: flightAcceptanceMarker.trim() || undefined,
			});
			const snapshot = await sessionClient.workbenchSnapshot();
			setWorkbenchSnapshot(snapshot);
			const now = Date.now();
			const diagnostics = `flight=${launch.flight_id}; status=${launch.status}; provider=${launch.provider}; contextMode=${launch.context_mode}; eventCount=${launch.event_count}; replay=${launch.idempotent_replay}; scope=${snapshot.scope}; flightPageCount=${snapshot.flight_count}.`;
			const context = `prompt=${prompt}`;

			saveWorkbench({
				workbenches: workbench.workbenches.map((candidate) =>
					candidate.id === activeWorkbench.id
						? { ...candidate, updatedAtUnixMs: now }
						: candidate,
				),
				activeWorkbenchId: activeWorkbench.id,
				receipts: [
					{
						id: newId(),
						workbenchId: activeWorkbench.id,
						kind: receiptKind,
						intent: `Observe flight launch (${flightContextMode})`,
						context,
						diagnostics,
						recordedAtUnixMs: now,
					},
					...workbench.receipts,
				],
			});
			setFlightPrompt("");
			setFlightAcceptanceMarker("");
		} catch (error) {
			setLaunchFlightError(error instanceof Error ? error.message : String(error));
		} finally {
			setLaunchingFlight(false);
		}
	};

	const refreshWorkbenchSnapshot = useCallback(async () => {
		if (!sessionClient || !connected) {
			return;
		}
		setLoadingSnapshot(true);
		setSnapshotError(null);
		try {
			setWorkbenchSnapshot(await sessionClient.workbenchSnapshot());
		} catch (error) {
			setSnapshotError(error instanceof Error ? error.message : String(error));
		} finally {
			setLoadingSnapshot(false);
		}
	}, [sessionClient, connected]);

	const loadPromptFlightDetail = useCallback(
		async (flightId: string) => {
			if (!sessionClient || !connected) {
				return;
			}
			setLoadingFlightDetail(true);
			setFlightDetailError(null);
			setSelectedFlightId(flightId);
			try {
				setSelectedFlightDetail(
					await sessionClient.readPromptFlight({
						flight_id: flightId,
					}),
				);
			} catch (error) {
				setSelectedFlightDetail(null);
				setFlightDetailError(error instanceof Error ? error.message : String(error));
			} finally {
				setLoadingFlightDetail(false);
			}
		},
		[sessionClient, connected],
	);

	useEffect(() => {
		if (section === "workbench" && connected && sessionClient) {
			void refreshWorkbenchSnapshot();
		}
	}, [section, connected, sessionClient, refreshWorkbenchSnapshot]);

	const receipts = useMemo(() => {
		if (!activeWorkbench) {
			return [];
		}

		return workbench.receipts
			.filter((entry) => entry.workbenchId === activeWorkbench.id)
			.sort((left, right) => right.recordedAtUnixMs - left.recordedAtUnixMs);
	}, [activeWorkbench, workbench.receipts]);

	if (section === "overview")
		return (
			<Stack>
				<Paper
					withBorder
					p="lg"
				>
					<Title order={3}>Your project's reasoning workspace</Title>
					<Text mt="sm">
						Inspect records in rrflowDB, follow their relationships through rrflowQL,
						compare vectors, and inspect rrflowKV storage. These are views of one
						project estate, not independent copies of its knowledge.
					</Text>
					<Text mt="sm">
						Running another project in parallel does not share its records, credentials,
						or context. Context sharing needs an explicit engine contract and
						authorization.
					</Text>
				</Paper>
				<Group>
					<Button
						variant="light"
						onClick={() => onOpen("knowledge/models")}
					>
						Explore project knowledge
					</Button>
					<Button
						variant="subtle"
						onClick={() => onOpen("knowledge/paths")}
					>
						Knowledge paths
					</Button>
					<Button
						variant="subtle"
						onClick={() => onOpen("workbench")}
					>
						Open workbench
					</Button>
				</Group>
				{!connected && (
					<Alert title="Project data requires a native session">
						The public handshake identifies the engine. Open this project in the desktop
						app with its operator credential to inspect authenticated data.
					</Alert>
				)}
			</Stack>
		);
	if (section === "knowledge")
		return (
			<Stack>
				<Button
					variant="subtle"
					onClick={() =>
						onOpen(detail === "paths" ? "knowledge/models" : "knowledge/paths")
					}
				>
					{detail === "paths" ? "Back to database" : "Knowledge paths: external sources"}
				</Button>
				{detail === "paths" ? (
					<>
						<Title order={3}>Knowledge paths</Title>
						<Badge
							color="gray"
							variant="light"
						>
							Connector setup unavailable in this build
						</Badge>
						<Text>
							A knowledge path is a project-scoped connection to an external database
							or reasoning system. Qdrant, Pinecone, HydraDB and other sources must
							preserve provenance and remote access scope when they contribute to this
							estate.
						</Text>
						<Requirements items={prerequisites.paths} />
						<Alert title="No source connected">
							This build does not offer an ingestion or knowledge-path registration
							contract. No connector is activated by visiting this page.
						</Alert>
					</>
				) : (
					!connected && (
						<Alert title="No authenticated project data">
							Use the desktop session above to inspect this view. Empty data is not
							assumed when a session is unavailable.
						</Alert>
					)
				)}
			</Stack>
		);
	if (section === "workbench")
		return (
			<Stack>
				<Title order={3}>Workbench</Title>
				<Badge
					color="blue"
					variant="light"
				>
					Planning and receipt tracking available
				</Badge>
				<Text>
					Use this project-local workbench to plan testing, reverse engineering,
					optimization and release updates. Saved entries are tracked per project
					connection.
				</Text>
				<Alert title="Execution remains engine-owned">
					This page can launch governed observe flights through the engine and record
					receipts, but it does not execute provider model calls, release automation, or
					cloud synchronization in this build.
				</Alert>
				{!connection && (
					<Alert
						color="red"
						title="Connection unavailable"
					>
						This workbench can only be edited when its project profile is available.
					</Alert>
				)}
				<Paper
					withBorder
					p="lg"
				>
					<Stack>
						<Title order={4}>Create workbench</Title>
						<TextInput
							label="Workbench name"
							placeholder="Dogfood readiness"
							value={newWorkbenchName}
							onChange={(event) => setNewWorkbenchName(event.currentTarget.value)}
						/>
						<Textarea
							label="Scope"
							placeholder="What this workbench is validating"
							minRows={2}
							value={newWorkbenchDescription}
							onChange={(event) =>
								setNewWorkbenchDescription(event.currentTarget.value)
							}
						/>
						<Group justify="flex-end">
							<Button
								onClick={createWorkbench}
								disabled={!connection || newWorkbenchName.trim().length === 0}
							>
								Create workbench
							</Button>
						</Group>
					</Stack>
				</Paper>
				<Paper
					withBorder
					p="lg"
				>
					<Stack>
						<Title order={4}>Launch observe flight</Title>
						<Textarea
							label="Prompt"
							placeholder="Describe the project intent for this flight"
							minRows={3}
							value={flightPrompt}
							onChange={(event) => setFlightPrompt(event.currentTarget.value)}
						/>
						<Select
							label="Context mode"
							value={flightContextMode}
							data={flightContextModeOptions.map((entry) => ({
								value: entry.value,
								label: entry.label,
							}))}
							onChange={(next) =>
								setFlightContextMode(
									(next as "fresh" | "pruned" | null) ?? "pruned",
								)
							}
						/>
						<TextInput
							label="Acceptance marker (optional)"
							placeholder="dogfood-workbench-01"
							value={flightAcceptanceMarker}
							onChange={(event) =>
								setFlightAcceptanceMarker(event.currentTarget.value)
							}
						/>
						{launchFlightError && (
							<Alert
								color="red"
								title="Observe flight launch failed"
							>
								{launchFlightError}
							</Alert>
						)}
						<Group justify="flex-end">
							<Button
								variant="light"
								onClick={() => void refreshWorkbenchSnapshot()}
								loading={loadingSnapshot}
								disabled={!connection || !connected}
							>
								Refresh governed flights
							</Button>
							<Button
								variant="light"
								onClick={launchObserveFlight}
								loading={launchingFlight}
								disabled={!connection || !activeWorkbench || !connected}
							>
								Launch observe flight
							</Button>
						</Group>
						{snapshotError && (
							<Alert
								color="red"
								title="Workbench snapshot failed"
							>
								{snapshotError}
							</Alert>
						)}
						{workbenchSnapshot && (
							<Paper
								withBorder
								p="sm"
							>
								<Stack gap="xs">
									<Text size="sm">
										Scope:{" "}
										<Text
											span
											ff="monospace"
										>
											{workbenchSnapshot.scope}
										</Text>
									</Text>
									<Text size="sm">
										Recent flights in snapshot: {workbenchSnapshot.flight_count}
									</Text>
									{workbenchSnapshot.recent_flights.length > 0 ? (
										workbenchSnapshot.recent_flights.map((flight) => (
											<Paper
												key={flight.flight_id}
												withBorder
												p="xs"
											>
												<Group justify="space-between">
													<Text
														size="sm"
														ff="monospace"
													>
														{flight.flight_id}
													</Text>
													<Group gap="xs">
														<Text size="sm">
															{flight.status} · {flight.provider} ·{" "}
															{flight.context_mode}
														</Text>
														<Button
															size="xs"
															variant={
																selectedFlightId ===
																flight.flight_id
																	? "filled"
																	: "subtle"
															}
															onClick={() =>
																void loadPromptFlightDetail(
																	flight.flight_id,
																)
															}
														>
															Inspect
														</Button>
													</Group>
												</Group>
											</Paper>
										))
									) : (
										<Text
											size="sm"
											c="slate"
										>
											No governed flights recorded yet.
										</Text>
									)}
									{loadingFlightDetail && (
										<Text size="sm">Loading selected flight details...</Text>
									)}
									{flightDetailError && (
										<Alert
											color="red"
											title="Flight detail read failed"
										>
											{flightDetailError}
										</Alert>
									)}
									{selectedFlightDetail && (
										<Paper
											withBorder
											p="sm"
										>
											<Stack gap="xs">
												<Text
													size="sm"
													fw={650}
												>
													Selected flight
												</Text>
												<Text size="sm">
													ID:{" "}
													<Text
														span
														ff="monospace"
													>
														{selectedFlightDetail.flight_id}
													</Text>
												</Text>
												<Text size="sm">
													{selectedFlightDetail.status} ·{" "}
													{selectedFlightDetail.provider} ·{" "}
													{selectedFlightDetail.context_mode}
												</Text>
												<Text size="sm">
													{`events=${selectedFlightDetail.event_count}; contextItems=${selectedFlightDetail.context_items}; contextBytes=${selectedFlightDetail.context_output_bytes}; elapsedMs=${selectedFlightDetail.elapsed_ms}`}
												</Text>
												<Text
													size="sm"
													ff="monospace"
												>
													cohort={selectedFlightDetail.cohort_sha256}
												</Text>
												<Text size="sm">{selectedFlightDetail.prompt}</Text>
												<Title order={6}>Events</Title>
												{selectedFlightDetail.events.map((event) => (
													<Paper
														key={`${selectedFlightDetail.flight_id}-${event.ordinal}`}
														withBorder
														p="xs"
													>
														<Text size="sm">
															#{event.ordinal} · {event.stage} ·{" "}
															{event.label}
														</Text>
														<Text
															size="sm"
															c="slate"
														>
															at={event.at_unix_ms} elapsed=
															{event.elapsed_ms}ms
														</Text>
														<Text size="sm">{event.detail}</Text>
													</Paper>
												))}
											</Stack>
										</Paper>
									)}
								</Stack>
							</Paper>
						)}
					</Stack>
				</Paper>
				<Paper
					withBorder
					p="lg"
				>
					<Stack>
						<Title order={4}>Record work item</Title>
						<Select
							label="Workbench"
							value={activeWorkbench?.id ?? null}
							data={workbench.workbenches.map((entry) => ({
								value: entry.id,
								label: entry.name,
							}))}
							placeholder="Create a workbench first"
							onChange={(next) =>
								saveWorkbench({
									workbenches: workbench.workbenches,
									activeWorkbenchId: next ?? undefined,
									receipts: workbench.receipts,
								})
							}
						/>
						<Select
							label="Work type"
							value={receiptKind}
							data={workbenchKindOptions}
							onChange={(next) =>
								setReceiptKind((next as WorkbenchRunKind | null) ?? "testing")
							}
						/>
						<TextInput
							label="Intent"
							placeholder="Validate routing narrowing on real project tasks"
							value={receiptIntent}
							onChange={(event) => setReceiptIntent(event.currentTarget.value)}
						/>
						<Textarea
							label="Context"
							placeholder="Prompt/context identity, scope, dependencies, expected oracles"
							minRows={2}
							value={receiptContext}
							onChange={(event) => setReceiptContext(event.currentTarget.value)}
						/>
						<Textarea
							label="Diagnostics"
							placeholder="Command output, CI links, failures, or notes"
							minRows={2}
							value={receiptDiagnostics}
							onChange={(event) => setReceiptDiagnostics(event.currentTarget.value)}
						/>
						{receiptCaptureError && (
							<Alert
								color="red"
								title="Runtime receipt capture failed"
							>
								{receiptCaptureError}
							</Alert>
						)}
						<Group justify="flex-end">
							<Button
								variant="light"
								onClick={captureRuntimeReceipt}
								loading={capturingReceipt}
								disabled={!connection || !activeWorkbench || !connected}
							>
								Capture runtime receipt
							</Button>
							<Button
								onClick={recordReceipt}
								disabled={
									!connection ||
									!activeWorkbench ||
									receiptIntent.trim().length === 0
								}
							>
								Record receipt
							</Button>
						</Group>
					</Stack>
				</Paper>
				<Stack gap="sm">
					<Title order={4}>Recent receipts</Title>
					{receipts.length === 0 && (
						<Text c="slate">No receipts recorded for the selected workbench.</Text>
					)}
					{receipts.map((entry) => (
						<Paper
							key={entry.id}
							withBorder
							p="md"
						>
							<Group justify="space-between">
								<Text fw={650}>{entry.intent}</Text>
								<Badge variant="light">
									{workbenchKindOptions.find(
										(candidate) => candidate.value === entry.kind,
									)?.label ?? entry.kind}
								</Badge>
							</Group>
							<Text
								size="sm"
								c="slate"
								mt={4}
							>
								{new Date(entry.recordedAtUnixMs).toLocaleString()}
							</Text>
							{entry.context && <Text mt="sm">{entry.context}</Text>}
							{entry.diagnostics && (
								<Text
									mt="sm"
									size="sm"
								>
									{entry.diagnostics}
								</Text>
							)}
						</Paper>
					))}
				</Stack>
			</Stack>
		);
	if (section === "activity")
		return (
			<Stack>
				<Title order={3}>Activity and evaluation</Title>
				<Badge
					color="gray"
					variant="light"
				>
					Session replay unavailable in this build
				</Badge>
				<Text>
					The next activity contract must link prompt submission, retrieval sources, tool
					calls, timings, budgets, durable effects and evaluation results under a project
					run identifier.
				</Text>
				<Text>
					Replay must distinguish inspecting a recorded run from executing new effects.
					Private model reasoning is not an observable execution trace.
				</Text>
				<Alert title="No fabricated activity">
					Connection status and database counters do not prove that reasoning,
					optimization or learning has run. This page has no run or replay feed until the
					engine supplies one.
				</Alert>
			</Stack>
		);
	if (section === "learning")
		return (
			<Stack>
				<Title order={3}>RROFLOW learning</Title>
				<Badge
					color="gray"
					variant="light"
				>
					Learning controls unavailable in this build
				</Badge>
				<Text>
					RROFLOW is the planned learning and evaluation layer. Connecting a project does
					not enroll its data in training.
				</Text>
				<Requirements items={prerequisites.learning} />
				<Alert title="Enablement requires engine support">
					Dataset consent, bounded training jobs, evaluation gates and rollback need
					public engine contracts before supervised or unsupervised controls can be
					enabled.
				</Alert>
			</Stack>
		);
	if (section === "services")
		return (
			<Stack>
				<Title order={3}>Models, subscriptions and cloud</Title>
				<Badge
					color="gray"
					variant="light"
				>
					Provider setup and cloud sync unavailable in this build
				</Badge>
				<Requirements items={prerequisites.services} />
				<Paper
					withBorder
					p="lg"
				>
					<Title order={4}>Planned cloud connections</Title>
					<Text mt="sm">
						rrflow.ai: hosted reasoning and recall. rroflow.ai: learning and evaluation.
						shippin.cloud: project devspaces.
					</Text>
					<Text mt="sm">
						These are planned service roles, not verified live login endpoints. Account
						linking, data selection, conflict handling, quotas, consent and revocation
						must be available before synchronization is offered.
					</Text>
				</Paper>
				<Alert title="Local remains independent">
					No account, subscription or upload is activated here. Existing saved engine
					connections remain usable independently of these planned services.
				</Alert>
			</Stack>
		);
	return (
		<Alert title="Unknown project section">
			<Button
				variant="subtle"
				onClick={() => onOpen("overview")}
			>
				Return to project overview
			</Button>
		</Alert>
	);
}

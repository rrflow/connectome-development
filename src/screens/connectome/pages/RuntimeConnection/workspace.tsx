import {
	Alert,
	Badge,
	Box,
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
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, usengram } from "react";
import type { ChangeEvent } from "react";
import type {
	RrdMetricView,
	RrdPromptFlightEventView,
	RrdPromptFlightDetailView,
	RrdPromptFlightSummaryView,
	RrdSessionClient,
	RrdStorageView,
	RrdWorkbenchSnapshotView,
} from "~/rrflow/session";
import { probeExternalPath } from "~/rrflow/session";
import { newId } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import type {
	ConnectionWorkbenchState,
	WorkbenchDatasetTemplate,
	WorkbenchLearningAction,
	WorkbenchLearningActionName,
	WorkbenchLearningEvent,
	WorkbenchLearningEventKind,
	WorkbenchLearningEventMode,
	WorkbenchLearningTrigger,
	WorkbenchLearningTriggerKind,
	WorkbenchLinkedPath,
	WorkbenchRunKind,
	WorkbenchTemplateStep,
} from "~/types";

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

const datasetStepCountOptions = ["0", "1", "2", "3", "4", "5"];
const workbenchRouteOptions = [
	{ value: "knowledge/models", label: "Knowledge · Models" },
	{ value: "knowledge/records", label: "Knowledge · Records" },
	{ value: "knowledge/vectors", label: "Knowledge · Vectors" },
	{ value: "knowledge/storage", label: "Knowledge · Storage" },
	{ value: "workbench", label: "Workbench" },
];

const learningKindOptions: { value: WorkbenchLearningEventKind; label: string }[] = [
	{ value: "did-you-know", label: "Did You Know" },
	{ value: "knowledge-drop", label: "Knowledge Drop" },
	{ value: "factoid", label: "Factoid" },
];

const learningModeOptions: { value: WorkbenchLearningEventMode; label: string }[] = [
	{ value: "passive", label: "Passive" },
	{ value: "interactive", label: "Interactive" },
];

const learningActionOptions: { value: WorkbenchLearningActionName; label: string }[] = [
	{ value: "navigate-route", label: "Navigate route" },
	{ value: "refresh-storage-signals", label: "Refresh storage signals" },
	{ value: "refresh-governed-flights", label: "Refresh governed flights" },
	{ value: "open-workbench", label: "Open Workbench" },
	{ value: "capture-runtime-receipt", label: "Capture runtime receipt" },
];

const learningTriggerOptions: { value: WorkbenchLearningTriggerKind; label: string }[] = [
	{ value: "manual", label: "Manual only" },
	{ value: "cold-signal", label: "Cold signal detected" },
	{ value: "linked-path-missing", label: "Linked path missing/disconnected" },
	{ value: "governed-flights-available", label: "Governed flights available" },
];

type WorkbenchSubsystem = "rrflowDB" | "rrflowQL" | "rrflowLSM" | "rrflowCLD";

interface WorkbenchActionDefinition {
	id: string;
	label: string;
	description: string;
	subsystem: WorkbenchSubsystem;
	invoke:
		| "open-route"
		| "refresh-storage"
		| "refresh-flights"
		| "capture-receipt"
		| "schema-snapshot"
		| "database-snapshot"
		| "launch-observe";
	route?: string;
}

interface WorkbenchExecutionLog {
	id: string;
	atUnixMs: number;
	actionId: string;
	subsystem: WorkbenchSubsystem;
	actionLabel: string;
	durationMs: number;
	hops: number;
	actions: number;
	tools: number;
	status: "ok" | "error";
	message: string;
}

const groupedActions: {
	id: string;
	label: string;
	color: string;
	actions: WorkbenchActionDefinition[];
}[] = [
	{
		id: "rrflowdb",
		label: "RRFlowDB · Records + schema",
		color: "blue",
		actions: [
			{
				id: "db-schema-snapshot",
				label: "Schema snapshot",
				description: "Read schema revision and table coverage.",
				subsystem: "rrflowDB",
				invoke: "schema-snapshot",
			},
			{
				id: "db-database-snapshot",
				label: "Database snapshot",
				description: "Read record and relation graph counters.",
				subsystem: "rrflowDB",
				invoke: "database-snapshot",
			},
			{
				id: "db-open-models",
				label: "Open model lens",
				description: "Jump to model surface review.",
				subsystem: "rrflowDB",
				invoke: "open-route",
				route: "knowledge/models",
			},
		],
	},
	{
		id: "rrflowql",
		label: "RRFlowQL · Query + traversal",
		color: "indigo",
		actions: [
			{
				id: "ql-open-records",
				label: "Open record lens",
				description: "Inspect traversal topology and relation hops.",
				subsystem: "rrflowQL",
				invoke: "open-route",
				route: "knowledge/records",
			},
			{
				id: "ql-capture-receipt",
				label: "Capture query receipt",
				description: "Record traversal diagnostics in Workbench receipts.",
				subsystem: "rrflowQL",
				invoke: "capture-receipt",
			},
		],
	},
	{
		id: "rrflowlsm",
		label: "RRFlowLSM · Hot/canonical storage",
		color: "violet",
		actions: [
			{
				id: "lsm-refresh-storage",
				label: "Refresh storage telemetry",
				description: "Poll runtime storage counters and profile metrics.",
				subsystem: "rrflowLSM",
				invoke: "refresh-storage",
			},
			{
				id: "lsm-open-storage",
				label: "Open storage lens",
				description: "Review physical counters, pins, and artifacts.",
				subsystem: "rrflowLSM",
				invoke: "open-route",
				route: "knowledge/storage",
			},
		],
	},
	{
		id: "rrflowcld",
		label: "RRFlowCLD · Cold lifecycle",
		color: "orange",
		actions: [
			{
				id: "cld-refresh-flights",
				label: "Refresh governed flights",
				description: "Check cold-period workflows and governed snapshots.",
				subsystem: "rrflowCLD",
				invoke: "refresh-flights",
			},
			{
				id: "cld-launch-observe",
				label: "Launch observe flight",
				description: "Emit controlled runtime observe flow for cold-path review.",
				subsystem: "rrflowCLD",
				invoke: "launch-observe",
			},
			{
				id: "cld-open-vectors",
				label: "Open vectors lens",
				description: "Inspect cold-served vector evidence and residency cues.",
				subsystem: "rrflowCLD",
				invoke: "open-route",
				route: "knowledge/vectors",
			},
		],
	},
];

const TEMPLATE_EXPORT_VERSION = 1;

interface WorkbenchRouteStep {
	id: string;
	title: string;
	detail: string;
	route: string;
}

function formatMetric(metric: RrdMetricView) {
	if (metric.unit === "ratio") {
		return `${(metric.value * 100).toFixed(1)}%`;
	}
	if (metric.unit === "bytes") {
		return `${Math.round(metric.value).toLocaleString()} B`;
	}
	return Math.round(metric.value).toLocaleString();
}

function normalizeTemplateStepCount(count: string | null | undefined) {
	const parsed = Number.parseInt(count ?? "0", 10);
	if (Number.isNaN(parsed)) {
		return 0;
	}
	return Math.max(0, Math.min(5, parsed));
}

function buildTemplateSteps(
	count: number,
	previous: WorkbenchTemplateStep[] | undefined,
): WorkbenchTemplateStep[] {
	return Array.from({ length: count }, (_, index) => {
		const existing = previous?.[index];
		return (
			existing ?? {
				id: newId(),
				title: `Step ${index + 1}`,
				detail: "",
				route: "workbench",
			}
		);
	});
}

function inferPathLabel(path: string) {
	const normalized = path.replace(/\\/g, "/");
	const parts = normalized.split("/").filter((part) => part.length > 0);
	return parts[parts.length - 1] ?? path;
}

interface TemplateExportPayload {
	version: number;
	exportedAtUnixMs: number;
	templates: WorkbenchDatasetTemplate[];
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.filter((entry: unknown): entry is string => typeof entry === "string")
		.map((entry: string) => entry.trim())
		.filter((entry: string) => entry.length > 0);
}

function parseTemplateImport(
	value: unknown,
	linkedPaths: WorkbenchLinkedPath[],
): WorkbenchDatasetTemplate[] {
	if (typeof value !== "object" || value === null) {
		return [];
	}
	const payload = value as { templates?: unknown };
	if (!Array.isArray(payload.templates)) {
		return [];
	}
	const linkedPathIds = new Set(linkedPaths.map((entry) => entry.id));
	const imported: WorkbenchDatasetTemplate[] = [];
	for (const templateValue of payload.templates) {
		if (typeof templateValue !== "object" || templateValue === null) {
			continue;
		}
		const template = templateValue as Record<string, unknown>;
		const name =
			typeof template.name === "string" ? template.name.trim() : "";
		if (!name) {
			continue;
		}
		const importedSteps = Array.isArray(template.steps) ? template.steps : [];
		const stepCount = Math.max(0, Math.min(5, importedSteps.length));
		const steps: WorkbenchTemplateStep[] = importedSteps
			.slice(0, stepCount)
			.map((stepValue: unknown, index: number) => {
				const step =
					typeof stepValue === "object" && stepValue !== null
						? (stepValue as Record<string, unknown>)
						: {};
				const linkedPathId =
					typeof step.linkedPathId === "string" &&
					linkedPathIds.has(step.linkedPathId)
						? step.linkedPathId
						: undefined;
				return {
					id: newId(),
					title:
						typeof step.title === "string" && step.title.trim()
							? step.title.trim()
							: `Step ${index + 1}`,
					detail: typeof step.detail === "string" ? step.detail.trim() : "",
					route:
						typeof step.route === "string" && step.route.trim()
							? step.route
							: "workbench",
					linkedPathId,
				};
			});
		const now = Date.now();
		const learningValues = Array.isArray(template.learningEvents)
			? template.learningEvents
			: [];
		const learningEvents: WorkbenchLearningEvent[] = learningValues
			.filter((eventValue: unknown) => typeof eventValue === "object" && eventValue !== null)
			.map((eventValue: unknown) => {
				const event = eventValue as Record<string, unknown>;
				const kind =
					event.kind === "did-you-know" ||
					event.kind === "knowledge-drop" ||
					event.kind === "factoid"
						? event.kind
						: "factoid";
				const mode =
					event.mode === "passive" || event.mode === "interactive"
						? event.mode
						: "passive";
				const component =
					event.component === "card" ||
					event.component === "alert" ||
					event.component === "badge"
						? event.component
						: "card";
				const route =
					typeof event.route === "string" && event.route.trim()
						? event.route
						: undefined;
				const importedActions = Array.isArray(event.actions) ? event.actions : [];
				const actions: WorkbenchLearningAction[] = importedActions
					.filter(
						(actionValue: unknown) =>
							typeof actionValue === "object" && actionValue !== null,
					)
					.map((actionValue: unknown) => {
						const action = actionValue as Record<string, unknown>;
						const name =
							action.name === "navigate-route" ||
							action.name === "refresh-storage-signals" ||
							action.name === "refresh-governed-flights" ||
							action.name === "open-workbench" ||
							action.name === "capture-runtime-receipt"
								? action.name
								: "navigate-route";
						return {
							id: newId(),
							name,
							label:
								typeof action.label === "string" && action.label.trim()
									? action.label.trim()
									: "Action",
							payload:
								typeof action.payload === "string" && action.payload.trim()
									? action.payload
									: undefined,
						};
					});
				const importedTriggers = Array.isArray(event.triggers) ? event.triggers : [];
				const triggers: WorkbenchLearningTrigger[] = importedTriggers
					.filter(
						(triggerValue: unknown) =>
							typeof triggerValue === "object" && triggerValue !== null,
					)
					.map((triggerValue: unknown) => {
						const trigger = triggerValue as Record<string, unknown>;
						const kind =
							trigger.kind === "manual" ||
							trigger.kind === "cold-signal" ||
							trigger.kind === "linked-path-missing" ||
							trigger.kind === "governed-flights-available"
								? trigger.kind
								: "manual";
						return {
							id: newId(),
							kind,
							description:
								typeof trigger.description === "string"
									? trigger.description.trim()
									: "",
						};
					});
				return {
					id: newId(),
					kind,
					mode,
					title:
						typeof event.title === "string" && event.title.trim()
							? event.title.trim()
							: "Learning event",
					body: typeof event.body === "string" ? event.body.trim() : "",
					component,
					route,
					requiresOperatorSignoff:
						typeof event.requiresOperatorSignoff === "boolean"
							? event.requiresOperatorSignoff
							: mode === "interactive",
					triggers,
					actions,
					catamorphismTarget:
						typeof event.catamorphismTarget === "string" &&
						event.catamorphismTarget.trim()
							? event.catamorphismTarget.trim()
							: "clyffy",
					catamorphismNote:
						typeof event.catamorphismNote === "string"
							? event.catamorphismNote.trim()
							: "",
				};
			});
		imported.push({
			id: newId(),
			name,
			description:
				typeof template.description === "string"
					? template.description.trim()
					: "",
			schema: typeof template.schema === "string" ? template.schema.trim() : "",
			minimumRequirements: toStringArray(template.minimumRequirements),
			filePatterns: toStringArray(template.filePatterns),
			folderPatterns: toStringArray(template.folderPatterns),
			createdAtUnixMs:
				typeof template.createdAtUnixMs === "number"
					? template.createdAtUnixMs
					: now,
			updatedAtUnixMs: now,
			steps,
			learningEvents,
		});
	}
	return imported;
}

interface WorkbenchRoutePlan {
	id: string;
	title: string;
	purpose: string;
	steps: WorkbenchRouteStep[];
}

interface Workskill {
	id: string;
	title: string;
	outcome: string;
	route: string;
}

interface Routine {
	id: string;
	title: string;
	description: string;
	stepRoutes: string[];
}

const routePlans: WorkbenchRoutePlan[] = [
	{
		id: "readiness-baseline",
		title: "Readiness baseline route",
		purpose: "Validate schema, graph, vectors, and storage counters before new work.",
		steps: [
			{
				id: "models",
				title: "Confirm data models",
				detail: "Validate schema revision, model families, and queryable tables.",
				route: "knowledge/models",
			},
			{
				id: "records",
				title: "Inspect records & relations",
				detail: "Confirm record coverage and relation topology from the same session.",
				route: "knowledge/records",
			},
			{
				id: "vectors",
				title: "Inspect vectors",
				detail: "Check collection inventory, memory tiers, and nearest-neighbor behavior.",
				route: "knowledge/vectors",
			},
			{
				id: "storage",
				title: "Inspect storage",
				detail: "Review physical counters and retention status before change execution.",
				route: "knowledge/storage",
			},
		],
	},
	{
		id: "cold-vector-follow-up",
		title: "Cold vector follow-up route",
		purpose: "Investigate cold-served vectors and storage-tier pressure signals.",
		steps: [
			{
				id: "storage",
				title: "Read storage cold-path signals",
				detail: "Check cache/cold metrics and observed-at timestamp from storage diagnostics.",
				route: "knowledge/storage",
			},
			{
				id: "vectors",
				title: "Validate vector search path",
				detail: "Confirm access path behavior and search evidence after cold-source reads.",
				route: "knowledge/vectors",
			},
			{
				id: "workbench",
				title: "Record remediation receipt",
				detail: "Capture diagnostics and accepted follow-up decisions in Workbench.",
				route: "workbench",
			},
		],
	},
];

const workskills: Workskill[] = [
	{
		id: "schema-oracle",
		title: "Schema oracle",
		outcome: "Confirms the schema and model surface before query or retrieval work.",
		route: "knowledge/models",
	},
	{
		id: "retrieval-oracle",
		title: "Retrieval oracle",
		outcome: "Validates graph records/relations and read-cursor consistency for recall.",
		route: "knowledge/records",
	},
	{
		id: "vector-cold-oracle",
		title: "Vector cold-oracle",
		outcome: "Verifies vector access path evidence and cold-trigger counters.",
		route: "knowledge/vectors",
	},
];

const routines: Routine[] = [
	{
		id: "release-readiness-loop",
		title: "Release readiness loop",
		description: "Run baseline route, launch governed observe flight, record receipt, and verify storage counters.",
		stepRoutes: ["knowledge/models", "knowledge/records", "knowledge/vectors", "knowledge/storage", "workbench"],
	},
	{
		id: "cold-trigger-triage",
		title: "Cold trigger triage",
		description: "Investigate cold-path pressure and validate vector-search implications.",
		stepRoutes: ["knowledge/storage", "knowledge/vectors", "workbench"],
	},
];

function normalizeWorkbench(state: ConnectionWorkbenchState | undefined): ConnectionWorkbenchState {
	const templates = (state?.templates ?? []).map((template) => ({
		...template,
		learningEvents: (template.learningEvents ?? []).map((event) => ({
			...event,
			requiresOperatorSignoff:
				typeof event.requiresOperatorSignoff === "boolean"
					? event.requiresOperatorSignoff
					: event.mode === "interactive",
			triggers: event.triggers ?? [
				{ id: newId(), kind: "manual", description: "Run on operator command." },
			],
			actions: event.actions ?? [],
		})),
	}));
	return {
		workbenches: state?.workbenches ?? [],
		activeWorkbenchId: state?.activeWorkbenchId,
		receipts: state?.receipts ?? [],
		templates,
		linkedPaths: state?.linkedPaths ?? [],
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

function formatWhen(unixMs: number | null | undefined) {
	if (!unixMs) {
		return "none yet";
	}
	return new Date(unixMs).toLocaleString();
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
	const [newWorkbenchName, setNewWorkbenchName] = usengram("");
	const [newWorkbenchDescription, setNewWorkbenchDescription] = usengram("");
	const [receiptKind, setReceiptKind] = usengram<WorkbenchRunKind>("testing");
	const [receiptIntent, setReceiptIntent] = usengram("");
	const [receiptContext, setReceiptContext] = usengram("");
	const [receiptDiagnostics, setReceiptDiagnostics] = usengram("");
	const [receiptCaptureError, setReceiptCaptureError] = usengram<string | null>(null);
	const [capturingReceipt, setCapturingReceipt] = usengram(false);
	const [flightPrompt, setFlightPrompt] = usengram("");
	const [flightContextMode, setFlightContextMode] = usengram<"fresh" | "pruned">("pruned");
	const [flightAcceptanceMarker, setFlightAcceptanceMarker] = usengram("");
	const [launchFlightError, setLaunchFlightError] = usengram<string | null>(null);
	const [launchingFlight, setLaunchingFlight] = usengram(false);
	const [workbenchSnapshot, setWorkbenchSnapshot] = usengram<RrdWorkbenchSnapshotView | null>(
		null,
	);
	const [snapshotError, setSnapshotError] = usengram<string | null>(null);
	const [loadingSnapshot, setLoadingSnapshot] = usengram(false);
	const [selectedFlightId, setSelectedFlightId] = usengram<string | null>(null);
	const [selectedFlightDetail, setSelectedFlightDetail] =
		usengram<RrdPromptFlightDetailView | null>(null);
	const [loadingFlightDetail, setLoadingFlightDetail] = usengram(false);
	const [flightDetailError, setFlightDetailError] = usengram<string | null>(null);
	const [flightFilter, setFlightFilter] = usengram<"all" | "fresh" | "pruned">("all");
	const [flightSort, setFlightSort] = usengram<"newest" | "oldest">("newest");
	const [selectedRouteId, setSelectedRouteId] = usengram<string>(routePlans[0].id);
	const [selectedRoutineId, setSelectedRoutineId] = usengram<string>(routines[0].id);
	const [templateName, setTemplateName] = usengram("");
	const [templateDescription, setTemplateDescription] = usengram("");
	const [templateSchema, setTemplateSchema] = usengram("");
	const [templateRequirements, setTemplateRequirements] = usengram("");
	const [templateFilePatterns, setTemplateFilePatterns] = usengram("");
	const [templateFolderPatterns, setTemplateFolderPatterns] = usengram("");
	const [templateStepCount, setTemplateStepCount] = usengram("3");
	const [templateImportError, setTemplateImportError] = usengram<string | null>(null);
	const [learningKind, setLearningKind] =
		usengram<WorkbenchLearningEventKind>("did-you-know");
	const [learningMode, setLearningMode] =
		usengram<WorkbenchLearningEventMode>("passive");
	const [learningComponent, setLearningComponent] =
		usengram<"card" | "alert" | "badge">("card");
	const [learningRequiresSignoff, setLearningRequiresSignoff] = usengram(true);
	const [learningTitle, setLearningTitle] = usengram("");
	const [learningBody, setLearningBody] = usengram("");
	const [learningRoute, setLearningRoute] = usengram<string>("workbench");
	const [learningCatamorphismNote, setLearningCatamorphismNote] = usengram("");
	const [learningActionName, setLearningActionName] =
		usengram<WorkbenchLearningActionName>("navigate-route");
	const [learningActionLabel, setLearningActionLabel] = usengram("");
	const [learningActionPayload, setLearningActionPayload] = usengram("");
	const [learningActions, setLearningActions] = usengram<WorkbenchLearningAction[]>([]);
	const [learningTriggerKind, setLearningTriggerKind] =
		usengram<WorkbenchLearningTriggerKind>("manual");
	const [learningTriggerDescription, setLearningTriggerDescription] = usengram("");
	const [learningTriggers, setLearningTriggers] = usengram<WorkbenchLearningTrigger[]>([
		{ id: newId(), kind: "manual", description: "Run on operator command." },
	]);
	const [templateLearningEvents, setTemplateLearningEvents] = usengram<
		WorkbenchLearningEvent[]
	>([]);
	const [templateSteps, setTemplateSteps] = usengram<WorkbenchTemplateStep[]>(
		buildTemplateSteps(3, undefined),
	);
	const [linkLabelDraft, setLinkLabelDraft] = usengram("");
	const [linkError, setLinkError] = usengram<string | null>(null);
	const [eventExecutionError, setEventExecutionError] = usengram<string | null>(null);
	const [runningEventIds, setRunningEventIds] = usengram<string[]>([]);
	const [autoTriggeredEventKeys, setAutoTriggeredEventKeys] = usengram<string[]>([]);
	const [telemetryProfile, setTelemetryProfile] = usengram("real-world-baseline");
	const [trackHops, setTrackHops] = usengram(true);
	const [trackActions, setTrackActions] = usengram(true);
	const [trackTools, setTrackTools] = usengram(true);
	const [trackTime, setTrackTime] = usengram(true);
	const [executionLog, setExecutionLog] = usengram<WorkbenchExecutionLog[]>([]);
	const importInputRef = useRef<HTMLInputElement | null>(null);

	const storageSignals = useQuery<RrdStorageView>({
		queryKey: ["rrd-workbench-storage-signals", connectionId],
		enabled: section === "workbench" && connected && Boolean(sessionClient),
		queryFn: () => {
			if (!sessionClient) {
				throw new Error("Session client unavailable");
			}
			return sessionClient.storage();
		},
		refetchInterval: 10_000,
	});
	const selectedRoute =
		routePlans.find((candidate) => candidate.id === selectedRouteId) ?? routePlans[0];
	const selectedRoutine =
		routines.find((candidate) => candidate.id === selectedRoutineId) ?? routines[0];
	const headlineSignals = storageSignals.data?.physical.headline ?? [];
	const coldSignals = headlineSignals.filter((metric) =>
		metric.id.includes("cold") || metric.id.includes("cache"),
	);

	const saveWorkbench = (next: ConnectionWorkbenchState) => {
		if (!connection) {
			return;
		}

		updateConnection({
			id: connection.id,
			workbench: next,
		});
	};

	const updateTemplateStep = (
		index: number,
		field: keyof WorkbenchTemplateStep,
		value: string | undefined,
	) => {
		setTemplateSteps((current: WorkbenchTemplateStep[]) =>
			current.map((step: WorkbenchTemplateStep, stepIndex: number) =>
				stepIndex === index
					? {
							...step,
							[field]: value,
						}
					: step,
			),
		);
	};

	const updateTemplateStepCount = (next: string | null) => {
		const normalized = normalizeTemplateStepCount(next);
		setTemplateStepCount(String(normalized));
		setTemplateSteps((current: WorkbenchTemplateStep[]) =>
			buildTemplateSteps(normalized, current),
		);
	};

	const addLearningEvent = () => {
		const title = learningTitle.trim();
		if (!title) {
			return;
		}
		const eventActions =
			learningActions.length > 0
				? learningActions
				: [
						{
							id: newId(),
							name: "navigate-route",
							label: "Open event route",
							payload: learningRoute,
						} satisfies WorkbenchLearningAction,
					];
		const eventTriggers =
			learningTriggers.length > 0
				? learningTriggers
				: [
						{
							id: newId(),
							kind: "manual",
							description: "Run on operator command.",
						} satisfies WorkbenchLearningTrigger,
					];
		setTemplateLearningEvents((current: WorkbenchLearningEvent[]) => [
			...current,
			{
				id: newId(),
				kind: learningKind,
				mode: learningMode,
				title,
				body: learningBody.trim(),
				component: learningComponent,
				route: learningMode === "interactive" ? learningRoute : undefined,
				requiresOperatorSignoff: learningRequiresSignoff,
				triggers: eventTriggers,
				actions: eventActions,
				catamorphismTarget: "clyffy",
				catamorphismNote: learningCatamorphismNote.trim(),
			},
		]);
		setLearningTitle("");
		setLearningBody("");
		setLearningCatamorphismNote("");
		setLearningActions([]);
		setLearningActionLabel("");
		setLearningActionPayload("");
		setLearningTriggers([
			{ id: newId(), kind: "manual", description: "Run on operator command." },
		]);
	};

	const removeLearningEvent = (eventId: string) => {
		setTemplateLearningEvents((current: WorkbenchLearningEvent[]) =>
			current.filter((event) => event.id !== eventId),
		);
	};

	const addLearningAction = () => {
		setLearningActions((current: WorkbenchLearningAction[]) => [
			...current,
			{
				id: newId(),
				name: learningActionName,
				label: learningActionLabel.trim() || "Action",
				payload: learningActionPayload.trim() || undefined,
			},
		]);
		setLearningActionLabel("");
		setLearningActionPayload("");
	};

	const removeLearningAction = (actionId: string) => {
		setLearningActions((current: WorkbenchLearningAction[]) =>
			current.filter((action) => action.id !== actionId),
		);
	};

	const addLearningTrigger = () => {
		setLearningTriggers((current: WorkbenchLearningTrigger[]) => [
			...current,
			{
				id: newId(),
				kind: learningTriggerKind,
				description: learningTriggerDescription.trim(),
			},
		]);
		setLearningTriggerDescription("");
	};

	const removeLearningTrigger = (triggerId: string) => {
		setLearningTriggers((current: WorkbenchLearningTrigger[]) =>
			current.filter((trigger) => trigger.id !== triggerId),
		);
	};

	const isTriggerActive = (trigger: WorkbenchLearningTrigger) => {
		if (trigger.kind === "manual") {
			return true;
		}
		if (trigger.kind === "cold-signal") {
			return coldSignals.length > 0;
		}
		if (trigger.kind === "linked-path-missing") {
			return workbench.linkedPaths.some((path) => path.status !== "available");
		}
		if (trigger.kind === "governed-flights-available") {
			return (workbenchSnapshot?.flight_count ?? 0) > 0;
		}
		return false;
	};

	const runLearningAction = async (action: WorkbenchLearningAction) => {
		if (action.name === "navigate-route") {
			const route = action.payload?.trim() || "workbench";
			onOpen(route);
			return;
		}
		if (action.name === "open-workbench") {
			onOpen("workbench");
			return;
		}
		if (action.name === "refresh-storage-signals") {
			await storageSignals.refetch();
			return;
		}
		if (action.name === "refresh-governed-flights") {
			await refreshWorkbenchSnapshot();
			return;
		}
		if (action.name === "capture-runtime-receipt") {
			await captureRuntimeReceipt();
		}
	};

	const runLearningEvent = async (templateName: string, event: WorkbenchLearningEvent) => {
		setEventExecutionError(null);
		setRunningEventIds((current: string[]) => [...current, event.id]);
		try {
			if (event.actions.length === 0) {
				throw new Error("Scripted event has no actions to execute.");
			}
			for (const action of event.actions) {
				await runLearningAction(action);
			}
			if (activeWorkbench) {
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
							kind: "testing",
							intent: `MCPL event executed: ${event.title}`,
							context: `template=${templateName}; kind=${event.kind}; mode=${event.mode}; component=${event.component}`,
							diagnostics: `actions=${event.actions
								.map((action) => action.name)
								.join(",")}; triggers=${event.triggers
								.map((trigger) => trigger.kind)
								.join(",")}; catamorphism=${event.catamorphismTarget}`,
							recordedAtUnixMs: now,
						},
						...workbench.receipts,
					],
					templates: workbench.templates,
					linkedPaths: workbench.linkedPaths,
				});
			}
		} catch (error) {
			setEventExecutionError(error instanceof Error ? error.message : String(error));
		} finally {
			setRunningEventIds((current: string[]) =>
				current.filter((runningId) => runningId !== event.id),
			);
		}
	};

	const createTemplate = () => {
		const name = templateName.trim();
		if (!name) {
			return;
		}
		const now = Date.now();
		const steps = templateSteps
			.slice(0, normalizeTemplateStepCount(templateStepCount))
			.map((step: WorkbenchTemplateStep, index: number) => ({
				...step,
				title: step.title.trim() || `Step ${index + 1}`,
				detail: step.detail.trim(),
			}));
		const minimumRequirements = templateRequirements
			.split(/\r?\n/)
			.map((entry: string) => entry.trim())
			.filter((entry: string) => entry.length > 0);
		const filePatterns = templateFilePatterns
			.split(/\r?\n/)
			.map((entry: string) => entry.trim())
			.filter((entry: string) => entry.length > 0);
		const folderPatterns = templateFolderPatterns
			.split(/\r?\n/)
			.map((entry: string) => entry.trim())
			.filter((entry: string) => entry.length > 0);
		const template: WorkbenchDatasetTemplate = {
			id: newId(),
			name,
			description: templateDescription.trim(),
			schema: templateSchema.trim(),
			minimumRequirements,
			filePatterns,
			folderPatterns,
			createdAtUnixMs: now,
			updatedAtUnixMs: now,
			steps,
			learningEvents: templateLearningEvents,
		};
		saveWorkbench({
			workbenches: workbench.workbenches,
			activeWorkbenchId: workbench.activeWorkbenchId,
			receipts: workbench.receipts,
			templates: [template, ...workbench.templates],
			linkedPaths: workbench.linkedPaths,
		});
		setTemplateName("");
		setTemplateDescription("");
		setTemplateSchema("");
		setTemplateRequirements("");
		setTemplateFilePatterns("");
		setTemplateFolderPatterns("");
		setTemplateStepCount("0");
		setTemplateSteps([]);
		setTemplateLearningEvents([]);
		setLearningRequiresSignoff(true);
		setLearningActions([]);
		setLearningActionLabel("");
		setLearningActionPayload("");
		setLearningTriggers([
			{ id: newId(), kind: "manual", description: "Run on operator command." },
		]);
	};

	const exportTemplates = () => {
		const payload: TemplateExportPayload = {
			version: TEMPLATE_EXPORT_VERSION,
			exportedAtUnixMs: Date.now(),
			templates: workbench.templates,
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: "application/json",
		});
		const href = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = href;
		link.download = `rrflow-workbench-templates-${connectionId}.json`;
		link.click();
		URL.revokeObjectURL(href);
	};

	const openTemplateImport = () => {
		setTemplateImportError(null);
		importInputRef.current?.click();
	};

	const importTemplates = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = "";
		if (!file) {
			return;
		}
		setTemplateImportError(null);
		try {
			const parsed = JSON.parse(await file.text()) as unknown;
			const imported = parseTemplateImport(parsed, workbench.linkedPaths);
			if (imported.length === 0) {
				setTemplateImportError(
					"The selected file contains no valid dataset templates.",
				);
				return;
			}
			saveWorkbench({
				workbenches: workbench.workbenches,
				activeWorkbenchId: workbench.activeWorkbenchId,
				receipts: workbench.receipts,
				templates: [...imported, ...workbench.templates],
				linkedPaths: workbench.linkedPaths,
			});
		} catch (error) {
			setTemplateImportError(error instanceof Error ? error.message : String(error));
		}
	};

	const removeTemplate = (templateId: string) => {
		saveWorkbench({
			workbenches: workbench.workbenches,
			activeWorkbenchId: workbench.activeWorkbenchId,
			receipts: workbench.receipts,
			templates: workbench.templates.filter(
				(template) => template.id !== templateId,
			),
			linkedPaths: workbench.linkedPaths,
		});
	};

	const probeAndStoreLinkedPath = async (linkedPath: WorkbenchLinkedPath) => {
		const probe = await probeExternalPath({ path: linkedPath.path });
		return {
			...linkedPath,
			status: probe.connected ? "available" : "missing",
			lastCheckedAtUnixMs: Date.now(),
			lastConnectedAtUnixMs: probe.connected
				? Date.now()
				: linkedPath.lastConnectedAtUnixMs,
			message: probe.message ?? undefined,
		} satisfies WorkbenchLinkedPath;
	};

	const refreshLinkedPaths = useCallback(async () => {
		if (!isTauri() || section !== "workbench") {
			return;
		}
		const latestConnection = useConfigStore
			.getState()
			.connections.find((candidate) => candidate.id === connectionId);
		if (!latestConnection) {
			return;
		}
		const latestWorkbench = normalizeWorkbench(latestConnection.workbench);
		if (latestWorkbench.linkedPaths.length === 0) {
			return;
		}
		const refreshed = await Promise.all(
			latestWorkbench.linkedPaths.map((linkedPath) =>
				probeAndStoreLinkedPath(linkedPath),
			),
		);
		const changed = refreshed.some((entry, index) => {
			const previous = latestWorkbench.linkedPaths[index];
			return (
				previous.status !== entry.status ||
				previous.path !== entry.path ||
				(previous.message ?? "") !== (entry.message ?? "")
			);
		});
		if (!changed) {
			return;
		}
		saveWorkbench({
			workbenches: latestWorkbench.workbenches,
			activeWorkbenchId: latestWorkbench.activeWorkbenchId,
			receipts: latestWorkbench.receipts,
			templates: latestWorkbench.templates,
			linkedPaths: refreshed,
		});
	}, [section, connectionId]);

	const addLinkedPath = async (kind: "file" | "directory") => {
		if (!isTauri()) {
			setLinkError("Linking external paths requires native Connectome.");
			return;
		}
		setLinkError(null);
		const selection = await open({
			title:
				kind === "directory"
					? "Select external dataset folder"
					: "Select external dataset file",
			multiple: false,
			directory: kind === "directory",
		});
		if (typeof selection !== "string") {
			return;
		}
		const label = linkLabelDraft.trim() || inferPathLabel(selection);
		const linkedPath: WorkbenchLinkedPath = {
			id: newId(),
			label,
			path: selection,
			kind,
			status: "unknown",
			lastCheckedAtUnixMs: Date.now(),
		};
		const probed = await probeAndStoreLinkedPath(linkedPath);
		saveWorkbench({
			workbenches: workbench.workbenches,
			activeWorkbenchId: workbench.activeWorkbenchId,
			receipts: workbench.receipts,
			templates: workbench.templates,
			linkedPaths: [probed, ...workbench.linkedPaths],
		});
		setLinkLabelDraft("");
	};

	const reconnectLinkedPath = async (linkedPathId: string) => {
		const linkedPath = workbench.linkedPaths.find((entry) => entry.id === linkedPathId);
		if (!linkedPath) {
			return;
		}
		const selection = await open({
			title: `Reconnect ${linkedPath.label}`,
			multiple: false,
			directory: linkedPath.kind === "directory",
			defaultPath: linkedPath.path,
		});
		if (typeof selection !== "string") {
			return;
		}
		const refreshed = await probeAndStoreLinkedPath({
			...linkedPath,
			path: selection,
			status: "unknown",
		});
		saveWorkbench({
			workbenches: workbench.workbenches,
			activeWorkbenchId: workbench.activeWorkbenchId,
			receipts: workbench.receipts,
			templates: workbench.templates,
			linkedPaths: workbench.linkedPaths.map((entry) =>
				entry.id === linkedPathId ? refreshed : entry,
			),
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
			templates: workbench.templates,
			linkedPaths: workbench.linkedPaths,
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
			templates: workbench.templates,
			linkedPaths: workbench.linkedPaths,
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
				templates: workbench.templates,
				linkedPaths: workbench.linkedPaths,
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
				templates: workbench.templates,
				linkedPaths: workbench.linkedPaths,
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

	useEffect(() => {
		if (!isTauri() || section !== "workbench") {
			return;
		}
		void refreshLinkedPaths();
		const timer = window.setInterval(() => {
			void refreshLinkedPaths();
		}, 10_000);
		return () => window.clearInterval(timer);
	}, [section, refreshLinkedPaths]);

	useEffect(() => {
		if (section !== "workbench") {
			return;
		}
		for (const template of workbench.templates) {
			for (const event of template.learningEvents) {
				if (event.requiresOperatorSignoff || event.mode !== "passive") {
					continue;
				}
				if (!event.triggers.some((trigger) => isTriggerActive(trigger))) {
					continue;
				}
				const key = `${template.id}:${event.id}`;
				if (autoTriggeredEventKeys.includes(key)) {
					continue;
				}
				setAutoTriggeredEventKeys((current: string[]) => [...current, key]);
				void runLearningEvent(template.name, event);
			}
		}
	}, [section, workbench.templates, autoTriggeredEventKeys, coldSignals.length, workbench.linkedPaths.length, workbenchSnapshot?.flight_count]);

	const receipts = useMemo(() => {
		if (!activeWorkbench) {
			return [];
		}

		return workbench.receipts
			.filter((entry) => entry.workbenchId === activeWorkbench.id)
			.sort((left, right) => right.recordedAtUnixMs - left.recordedAtUnixMs);
	}, [activeWorkbench, workbench.receipts]);

	const recentFlights = useMemo(() => {
		if (!workbenchSnapshot) {
			return [];
		}

		const filtered = workbenchSnapshot.recent_flights.filter(
			(flight: RrdPromptFlightSummaryView) => {
			return flightFilter === "all" || flight.context_mode === flightFilter;
			},
		);

		return [...filtered].sort((left, right) => {
			const leftRank = left.known_at_cursor ?? left.flight_cursor;
			const rightRank = right.known_at_cursor ?? right.flight_cursor;
			return flightSort === "newest" ? rightRank - leftRank : leftRank - rightRank;
		});
	}, [flightFilter, flightSort, workbenchSnapshot]);

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
						project engram, not independent copies of its knowledge.
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
							engram.
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
				<Paper
					withBorder
					p="lg"
				>
					<Stack>
						<Group justify="space-between">
							<Title order={4}>Guided routes</Title>
							<Badge
								color={coldSignals.length > 0 ? "orange" : "blue"}
								variant="light"
							>
								{coldSignals.length > 0
									? "Cold-path signals detected"
									: "No cold-path signals"}
							</Badge>
						</Group>
						<Text size="sm">
							Follow an explicit route so model/schema, retrieval, vector, and storage
							evidence stay in one consistent session flow.
						</Text>
						<Select
							label="Route plan"
							value={selectedRoute.id}
							data={routePlans.map((route) => ({
								value: route.id,
								label: route.title,
							}))}
							onChange={(next) => setSelectedRouteId(next ?? routePlans[0].id)}
						/>
						<Text size="sm">{selectedRoute.purpose}</Text>
						<Stack gap="xs">
							{selectedRoute.steps.map((step, index) => (
								<Paper
									key={step.id}
									withBorder
									p="sm"
								>
									<Group justify="space-between">
										<Box>
											<Text fw={650}>
												Step {index + 1}: {step.title}
											</Text>
											<Text
												size="sm"
												c="slate"
											>
												{step.detail}
											</Text>
										</Box>
										<Button
											size="xs"
											variant="light"
											onClick={() => onOpen(step.route)}
										>
											Open step
										</Button>
									</Group>
								</Paper>
							))}
						</Stack>
					</Stack>
				</Paper>
				<SimpleGrid cols={{ base: 1, md: 2 }}>
					<Paper
						withBorder
						p="lg"
					>
						<Stack>
							<Title order={4}>Workskills</Title>
							<Text size="sm">
								Each workskill routes to one focused lens and one expected evidence
								outcome.
							</Text>
							{workskills.map((skill) => (
								<Paper
									key={skill.id}
									withBorder
									p="sm"
								>
									<Group justify="space-between">
										<Box>
											<Text fw={650}>{skill.title}</Text>
											<Text
												size="sm"
												c="slate"
											>
												{skill.outcome}
											</Text>
										</Box>
										<Button
											size="xs"
											variant="subtle"
											onClick={() => onOpen(skill.route)}
										>
											Run skill
										</Button>
									</Group>
								</Paper>
							))}
						</Stack>
					</Paper>
					<Paper
						withBorder
						p="lg"
					>
						<Stack>
							<Title order={4}>Routines</Title>
							<Text size="sm">
								Routines are repeatable multi-step loops. Start one, then execute each
								step in order.
							</Text>
							<Select
								label="Routine"
								value={selectedRoutine.id}
								data={routines.map((routine) => ({
									value: routine.id,
									label: routine.title,
								}))}
								onChange={(next) => setSelectedRoutineId(next ?? routines[0].id)}
							/>
							<Text size="sm">{selectedRoutine.description}</Text>
							<Group gap="xs">
								<Button
									size="xs"
									variant="light"
									onClick={() => onOpen(selectedRoutine.stepRoutes[0] ?? "workbench")}
								>
									Start routine
								</Button>
								<Button
									size="xs"
									variant="subtle"
									onClick={() => onOpen("workbench")}
								>
									Record outcome
								</Button>
							</Group>
						</Stack>
					</Paper>
				</SimpleGrid>
				<Paper
					withBorder
					p="lg"
				>
					<Stack>
						<Title order={4}>Live storage signal</Title>
						{storageSignals.isLoading && (
							<Text size="sm">Reading storage diagnostics…</Text>
						)}
						{storageSignals.isError && (
							<Alert
								color="red"
								title="Storage signal unavailable"
							>
								{storageSignals.error instanceof Error
									? storageSignals.error.message
									: "Storage diagnostics could not be read."}
							</Alert>
						)}
						{storageSignals.data && (
							<Stack gap="xs">
								<Group gap="xs">
									{(coldSignals.length > 0 ? coldSignals : headlineSignals)
										.slice(0, 6)
										.map((metric) => (
											<Badge
												key={metric.id}
												variant="light"
											>
												{metric.label}: {formatMetric(metric)}
											</Badge>
										))}
								</Group>
								<Text
									size="xs"
									c="slate"
								>
									Observed at {formatWhen(storageSignals.data.physical.observed_at_unix_ms)}
								</Text>
							</Stack>
						)}
					</Stack>
				</Paper>
				<SimpleGrid cols={{ base: 1, md: 2 }}>
					<Paper
						withBorder
						p="lg"
					>
						<Stack>
							<Title order={4}>Dataset templates (0–5 steps)</Title>
							<Text size="sm">
								Define reusable, configurable templates with schema and minimum
								requirements for reasoning-engine tests and experiments.
							</Text>
							<Group>
								<Button
									variant="light"
									onClick={exportTemplates}
									disabled={workbench.templates.length === 0}
								>
									Export templates
								</Button>
								<Button
									variant="light"
									onClick={openTemplateImport}
								>
									Import templates
								</Button>
								<input
									ref={importInputRef}
									type="file"
									accept="application/json,.json"
									style={{ display: "none" }}
									onChange={(event) => void importTemplates(event)}
								/>
							</Group>
							{templateImportError && (
								<Alert
									color="red"
									title="Template import failed"
								>
									{templateImportError}
								</Alert>
							)}
							<TextInput
								label="Template name"
								placeholder="Real project retrieval benchmark"
								value={templateName}
								onChange={(event) => setTemplateName(event.currentTarget.value)}
							/>
							<Textarea
								label="Template description"
								placeholder="What this dataset workflow validates"
								minRows={2}
								value={templateDescription}
								onChange={(event) =>
									setTemplateDescription(event.currentTarget.value)
								}
							/>
							<TextInput
								label="Schema"
								placeholder="rrflow.workbench.dataset.v1"
								value={templateSchema}
								onChange={(event) => setTemplateSchema(event.currentTarget.value)}
							/>
							<Textarea
								label="Minimum requirements (one per line)"
								placeholder="Data source authorized&#10;Prompt set hash captured&#10;Comparator parity verified"
								minRows={3}
								value={templateRequirements}
								onChange={(event) =>
									setTemplateRequirements(event.currentTarget.value)
								}
							/>
							<Textarea
								label="File patterns (one per line)"
								placeholder="**/*.md&#10;**/*.rs&#10;eval/inputs/**/*.json"
								minRows={2}
								value={templateFilePatterns}
								onChange={(event) =>
									setTemplateFilePatterns(event.currentTarget.value)
								}
							/>
							<Textarea
								label="Folder patterns (one per line)"
								placeholder="docs/**&#10;crates/**&#10;eval/**"
								minRows={2}
								value={templateFolderPatterns}
								onChange={(event) =>
									setTemplateFolderPatterns(event.currentTarget.value)
								}
							/>
							<Paper
								withBorder
								p="sm"
							>
								<Stack>
									<Title order={5}>MCPL Learning scripted events</Title>
									<Text size="xs">
										Build Did You Know, Knowledge Drop, and Factoid events as
										A2UI components for passive or interactive flows, then
										catamorphize back to Clyffy.
									</Text>
									<Group grow>
										<Select
											label="Event kind"
											value={learningKind}
											data={learningKindOptions}
											onChange={(next) =>
												setLearningKind(
													(next as WorkbenchLearningEventKind | null) ??
														"did-you-know",
												)
											}
										/>
										<Select
											label="Mode"
											value={learningMode}
											data={learningModeOptions}
											onChange={(next) =>
												setLearningMode(
													(next as WorkbenchLearningEventMode | null) ??
														"passive",
												)
											}
										/>
										<Select
											label="A2UI component"
											value={learningComponent}
											data={[
												{ value: "card", label: "Card" },
												{ value: "alert", label: "Alert" },
												{ value: "badge", label: "Badge" },
											]}
											onChange={(next) =>
												setLearningComponent(
													(next as "card" | "alert" | "badge" | null) ??
														"card",
												)
											}
										/>
									</Group>
									<TextInput
										label="Title"
										value={learningTitle}
										onChange={(event) =>
											setLearningTitle(event.currentTarget.value)
										}
									/>
									<Textarea
										label="Body"
										minRows={2}
										value={learningBody}
										onChange={(event) =>
											setLearningBody(event.currentTarget.value)
										}
									/>
									<Select
										label="Interactive route"
										value={learningRoute}
										data={workbenchRouteOptions}
										disabled={learningMode !== "interactive"}
										onChange={(next) =>
											setLearningRoute(next ?? "workbench")
										}
									/>
									<Select
										label="Requires operator sign-off"
										value={learningRequiresSignoff ? "yes" : "no"}
										data={[
											{ value: "yes", label: "Yes" },
											{ value: "no", label: "No" },
										]}
										onChange={(next) =>
											setLearningRequiresSignoff((next ?? "yes") === "yes")
										}
									/>
									<TextInput
										label="Catamorphism note to Clyffy"
										placeholder="How this event maps back into Clyffy routines"
										value={learningCatamorphismNote}
										onChange={(event) =>
											setLearningCatamorphismNote(
												event.currentTarget.value,
											)
										}
									/>
									<Paper
										withBorder
										p="xs"
									>
										<Stack>
											<Title order={6}>Scripted actions</Title>
											<Group grow>
												<Select
													label="Action"
													value={learningActionName}
													data={learningActionOptions}
													onChange={(next) =>
														setLearningActionName(
															(next as WorkbenchLearningActionName | null) ??
																"navigate-route",
														)
													}
												/>
												<TextInput
													label="Action label"
													value={learningActionLabel}
													onChange={(event) =>
														setLearningActionLabel(
															event.currentTarget.value,
														)
													}
												/>
												<TextInput
													label="Payload (optional)"
													placeholder="route name or free text payload"
													value={learningActionPayload}
													onChange={(event) =>
														setLearningActionPayload(
															event.currentTarget.value,
														)
													}
												/>
											</Group>
											<Group justify="space-between">
												<Text size="xs">
													Actions queued: {learningActions.length}
												</Text>
												<Button
													size="xs"
													variant="subtle"
													onClick={addLearningAction}
												>
													Add action
												</Button>
											</Group>
											{learningActions.map((action: WorkbenchLearningAction) => (
												<Group
													key={action.id}
													justify="space-between"
												>
													<Text size="xs">
														{action.name} · {action.label}
														{action.payload ? ` · ${action.payload}` : ""}
													</Text>
													<Button
														size="xs"
														variant="subtle"
														color="red"
														onClick={() => removeLearningAction(action.id)}
													>
														Remove
													</Button>
												</Group>
											))}
										</Stack>
									</Paper>
									<Paper
										withBorder
										p="xs"
									>
										<Stack>
											<Title order={6}>Signal triggers</Title>
											<Group grow>
												<Select
													label="Trigger"
													value={learningTriggerKind}
													data={learningTriggerOptions}
													onChange={(next) =>
														setLearningTriggerKind(
															(next as WorkbenchLearningTriggerKind | null) ??
																"manual",
														)
													}
												/>
												<TextInput
													label="Trigger note"
													placeholder="Optional rationale or threshold note"
													value={learningTriggerDescription}
													onChange={(event) =>
														setLearningTriggerDescription(
															event.currentTarget.value,
														)
													}
												/>
											</Group>
											<Group justify="space-between">
												<Text size="xs">
													Triggers queued: {learningTriggers.length}
												</Text>
												<Button
													size="xs"
													variant="subtle"
													onClick={addLearningTrigger}
												>
													Add trigger
												</Button>
											</Group>
											{learningTriggers.map((trigger: WorkbenchLearningTrigger) => (
												<Group
													key={trigger.id}
													justify="space-between"
												>
													<Text size="xs">
														{trigger.kind}
														{trigger.description
															? ` · ${trigger.description}`
															: ""}
													</Text>
													<Button
														size="xs"
														variant="subtle"
														color="red"
														onClick={() => removeLearningTrigger(trigger.id)}
													>
														Remove
													</Button>
												</Group>
											))}
										</Stack>
									</Paper>
									<Group justify="space-between">
										<Text size="xs">
											Queued events: {templateLearningEvents.length}
										</Text>
										<Button
											size="xs"
											variant="light"
											onClick={addLearningEvent}
											disabled={learningTitle.trim().length === 0}
										>
											Add learning event
										</Button>
									</Group>
									{templateLearningEvents.map((event: WorkbenchLearningEvent) => (
										<Paper
											key={event.id}
											withBorder
											p="xs"
										>
											<Group justify="space-between">
												<Text size="sm">
													{event.kind} · {event.mode} · {event.component}
												</Text>
												<Button
													size="xs"
													variant="subtle"
													color="red"
													onClick={() => removeLearningEvent(event.id)}
												>
													Remove
												</Button>
											</Group>
											<Text size="sm">{event.title}</Text>
											{event.body && (
												<Text
													size="xs"
													c="slate"
												>
													{event.body}
												</Text>
											)}
										</Paper>
									))}
								</Stack>
							</Paper>
							<Select
								label="Step count"
								value={templateStepCount}
								data={datasetStepCountOptions}
								onChange={(next) => updateTemplateStepCount(next)}
							/>
							{templateSteps.map((step: WorkbenchTemplateStep, index: number) => (
								<Paper
									key={step.id}
									withBorder
									p="sm"
								>
									<Stack>
										<Text fw={650}>Step {index + 1}</Text>
										<TextInput
											label="Title"
											value={step.title}
											onChange={(event) =>
												updateTemplateStep(
													index,
													"title",
													event.currentTarget.value,
												)
											}
										/>
										<TextInput
											label="Detail"
											value={step.detail}
											onChange={(event) =>
												updateTemplateStep(
													index,
													"detail",
													event.currentTarget.value,
												)
											}
										/>
										<Select
											label="Route"
											value={step.route}
											data={workbenchRouteOptions}
											onChange={(next) =>
												updateTemplateStep(index, "route", next ?? "workbench")
											}
										/>
										<Select
											label="Linked path (optional)"
											value={step.linkedPathId ?? null}
											data={workbench.linkedPaths.map((entry) => ({
												value: entry.id,
												label: `${entry.label} (${entry.status})`,
											}))}
											placeholder="No path link"
											onChange={(next) =>
												updateTemplateStep(
													index,
													"linkedPathId",
													next ?? undefined,
												)
											}
										/>
									</Stack>
								</Paper>
							))}
							<Group justify="flex-end">
								<Button
									onClick={createTemplate}
									disabled={!connection || templateName.trim().length === 0}
								>
									Save template
								</Button>
							</Group>
						</Stack>
					</Paper>
					<Paper
						withBorder
						p="lg"
					>
						<Stack>
							<Title order={4}>Linked external files and folders</Title>
							<Text size="sm">
								Link external datasets once, then let Workbench auto-check
								availability and reconnect paths when a drive disconnects.
							</Text>
							<TextInput
								label="Link label (optional)"
								placeholder="USB benchmark pack"
								value={linkLabelDraft}
								onChange={(event) => setLinkLabelDraft(event.currentTarget.value)}
							/>
							<Group>
								<Button
									variant="light"
									onClick={() => void addLinkedPath("file")}
									disabled={!connection}
								>
									Link file
								</Button>
								<Button
									variant="light"
									onClick={() => void addLinkedPath("directory")}
									disabled={!connection}
								>
									Link folder
								</Button>
								<Button
									variant="subtle"
									onClick={() => void refreshLinkedPaths()}
									disabled={!connection}
								>
									Refresh links
								</Button>
							</Group>
							{linkError && (
								<Alert
									color="red"
									title="External path link failed"
								>
									{linkError}
								</Alert>
							)}
							{workbench.linkedPaths.length === 0 && (
								<Text
									size="sm"
									c="slate"
								>
									No external links yet.
								</Text>
							)}
							{workbench.linkedPaths.map((entry) => (
								<Paper
									key={entry.id}
									withBorder
									p="sm"
								>
									<Stack gap="xs">
										<Group justify="space-between">
											<Text fw={650}>{entry.label}</Text>
											<Badge
												color={
													entry.status === "available"
														? "green"
														: entry.status === "missing"
															? "red"
															: "gray"
												}
												variant="light"
											>
												{entry.status}
											</Badge>
										</Group>
										<Text
											size="xs"
											ff="monospace"
										>
											{entry.path}
										</Text>
										<Text
											size="xs"
											c="slate"
										>
											Last checked: {formatWhen(entry.lastCheckedAtUnixMs)} · Last connected:{" "}
											{formatWhen(entry.lastConnectedAtUnixMs)}
										</Text>
										{entry.message && (
											<Text
												size="xs"
												c="orange"
											>
												{entry.message}
											</Text>
										)}
										<Group>
											{entry.status !== "available" && (
												<Button
													size="xs"
													variant="light"
													onClick={() => void reconnectLinkedPath(entry.id)}
												>
													Reconnect
												</Button>
											)}
											<Button
												size="xs"
												variant="subtle"
												color="red"
												onClick={() =>
													saveWorkbench({
														workbenches: workbench.workbenches,
														activeWorkbenchId: workbench.activeWorkbenchId,
														receipts: workbench.receipts,
														templates: workbench.templates.map((template) => ({
															...template,
															steps: template.steps.map((step) =>
																step.linkedPathId === entry.id
																	? { ...step, linkedPathId: undefined }
																	: step,
															),
														})),
														linkedPaths: workbench.linkedPaths.filter(
															(candidate) => candidate.id !== entry.id,
														),
													})
												}
											>
												Remove link
											</Button>
										</Group>
									</Stack>
								</Paper>
							))}
							<Title order={5}>Saved templates</Title>
							{eventExecutionError && (
								<Alert
									color="red"
									title="Scripted event execution failed"
								>
									{eventExecutionError}
								</Alert>
							)}
							{workbench.templates.length === 0 && (
								<Text
									size="sm"
									c="slate"
								>
									No dataset templates saved yet.
								</Text>
							)}
							{workbench.templates.map((template) => (
								<Paper
									key={template.id}
									withBorder
									p="sm"
								>
									<Stack gap="xs">
										<Group justify="space-between">
											<Text fw={650}>{template.name}</Text>
											<Group gap="xs">
												<Badge variant="light">
													{template.steps.length} step
													{template.steps.length === 1 ? "" : "s"}
												</Badge>
												<Button
													size="xs"
													variant="subtle"
													color="red"
													onClick={() => removeTemplate(template.id)}
												>
													Remove
												</Button>
											</Group>
										</Group>
										<Text size="sm">{template.description}</Text>
										<Text
											size="xs"
											ff="monospace"
										>
											schema={template.schema || "unset"}
										</Text>
										<Text size="xs">
											Requirements:{" "}
											{template.minimumRequirements.length > 0
												? template.minimumRequirements.join(" • ")
												: "none"}
										</Text>
										<Text size="xs">
											File patterns:{" "}
											{template.filePatterns.length > 0
												? template.filePatterns.join(", ")
												: "none"}
										</Text>
										<Text size="xs">
											Folder patterns:{" "}
											{template.folderPatterns.length > 0
												? template.folderPatterns.join(", ")
												: "none"}
										</Text>
										{template.steps.map((step, index) => {
											const linked = step.linkedPathId
												? workbench.linkedPaths.find(
														(entry) => entry.id === step.linkedPathId,
													)
												: undefined;
											return (
												<Group
													key={step.id}
													justify="space-between"
												>
													<Text
														size="xs"
														c="slate"
													>
														{index + 1}. {step.title} → {step.route}
														{linked
															? ` · link=${linked.label} (${linked.status})`
															: ""}
													</Text>
													<Button
														size="xs"
														variant="subtle"
														onClick={() => onOpen(step.route)}
													>
														Open
													</Button>
												</Group>
											);
										})}
										{template.learningEvents.length > 0 && (
											<Stack gap="xs">
												<Text
													size="xs"
													fw={650}
												>
													MCPL Learning events
												</Text>
												{template.learningEvents.map((event: WorkbenchLearningEvent) => (
													<Paper
														key={event.id}
														withBorder
														p="xs"
													>
														<Stack gap="xs">
															<Group justify="space-between">
																<Badge variant="light">
																	{event.kind}
																</Badge>
																<Text size="xs">
																	{event.mode} · {event.component}
																</Text>
															</Group>
															{event.component === "alert" ? (
																<Alert title={event.title}>
																	{event.body || "No body provided."}
																</Alert>
															) : event.component === "badge" ? (
																<Group>
																	<Badge>{event.title}</Badge>
																	<Text size="xs">
																		{event.body}
																	</Text>
																</Group>
															) : (
																<>
																	<Text size="sm">{event.title}</Text>
																	{event.body && (
																		<Text
																			size="xs"
																			c="slate"
																		>
																			{event.body}
																		</Text>
																	)}
																</>
															)}
															<Text
																size="xs"
																c="slate"
															>
																catamorphism → {event.catamorphismTarget}
																{event.catamorphismNote
																	? ` (${event.catamorphismNote})`
																	: ""}
															</Text>
															{event.triggers.length > 0 && (
																<Text size="xs">
																	signals:{" "}
																	{event.triggers
																		.map((trigger) => trigger.kind)
																		.join(", ")}
																</Text>
															)}
															{event.actions.length > 0 && (
																<Text size="xs">
																	actions:{" "}
																	{event.actions
																		.map((action) => action.name)
																		.join(", ")}
																</Text>
															)}
															{event.triggers.some((trigger) =>
																isTriggerActive(trigger),
															) && (
																<Badge
																	size="sm"
																	color="orange"
																	variant="light"
																>
																	Signal active
																</Badge>
															)}
															{event.mode === "interactive" &&
																event.route && (
																	<Button
																		size="xs"
																		variant="light"
																		onClick={() =>
																			onOpen(event.route ?? "workbench")
																		}
																	>
																		Interact
																	</Button>
																)}
															<Group>
																<Button
																	size="xs"
																	variant={
																		event.requiresOperatorSignoff
																			? "light"
																			: "subtle"
																	}
																	onClick={() =>
																		void runLearningEvent(
																			template.name,
																			event,
																		)
																	}
																	loading={runningEventIds.includes(event.id)}
																>
																	{event.requiresOperatorSignoff
																		? "Approve and run"
																		: "Run scripted event"}
																</Button>
															</Group>
														</Stack>
													</Paper>
												))}
											</Stack>
										)}
									</Stack>
								</Paper>
							))}
						</Stack>
					</Paper>
				</SimpleGrid>
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
									<Group>
										<Select
											label="Filter"
											value={flightFilter}
											data={[
												{ value: "all", label: "All" },
												{ value: "fresh", label: "Fresh" },
												{ value: "pruned", label: "Pruned" },
											]}
											onChange={(next) =>
												setFlightFilter(
													(next as "all" | "fresh" | "pruned" | null) ??
														"all",
												)
											}
										/>
										<Select
											label="Sort"
											value={flightSort}
											data={[
												{ value: "newest", label: "Newest first" },
												{ value: "oldest", label: "Oldest first" },
											]}
											onChange={(next) =>
												setFlightSort(
													(next as "newest" | "oldest" | null) ??
														"newest",
												)
											}
										/>
									</Group>
									{recentFlights.length > 0 ? (
										recentFlights.map((flight: RrdPromptFlightSummaryView) => (
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
											No governed flights match the selected filter.
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
												{selectedFlightDetail.events.map(
													(event: RrdPromptFlightEventView) => (
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
													),
												)}
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
									templates: workbench.templates,
									linkedPaths: workbench.linkedPaths,
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

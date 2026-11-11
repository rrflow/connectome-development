import { Alert, SimpleGrid, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RrdSessionClient, RrdStorageView } from "~/rrflow/session";
import { probeExternalPath, writeExternalTextFile } from "~/rrflow/session";
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
	WorkbenchRemoteSource,
	WorkbenchRemoteSourceMode,
	WorkbenchRemoteSourceProvider,
	WorkbenchTemplateStep,
} from "~/types";
import {
	benchmarkWorkloadProfiles,
	buildDatasetArtifacts,
	type DatasetBuildArtifact,
	type DatasetBuildResult,
} from "../datasets/dataset";
import { WorkbenchDatasetPanel } from "../datasets/dataset-panel";
import { WorkbenchLinkedCloudPanel } from "../linked-cloud/linked-cloud-panel";
import { WorkbenchMcplLanePanel } from "../mcpl/mcpl-lane-panel";
import { WorkbenchTemplateAuthoringPanel } from "../templates/template-authoring-panel";
import { WorkbenchTemplateLibraryPanel } from "../templates/template-library-panel";
import {
	buildDatasetCompareReadiness,
	buildDatasetFlowReadiness,
	buildDatasetOutputFolderOptions,
	buildLearningEventEntries,
	buildLinkedPathOptions,
	findLinkedOutputFolder,
	getLatestDatasetBuildResult,
	getSelectedWorkloadProfile,
	getWorkbenchLaneVisibility,
	type WorkbenchLane,
} from "./lane-helpers";

/**
 * The Workbench lanes beside the prompt workbench: dataset authoring, MCPL
 * learning events and linked cloud/doc sources. Everything here is project-local
 * configuration kept in the connection store; the engine runs the workbench and
 * owns every result. Nothing in these lanes claims an evaluation it did not make.
 */

export const workbenchLaneOptions: { value: WorkbenchLane; label: string }[] = [
	{ value: "runtime-control", label: "Prompt workbench" },
	{ value: "dataset-authoring", label: "Dataset authoring" },
	{ value: "mcpl-learning", label: "MCPL learning" },
	{ value: "cloud-docs", label: "Linked paths + cloud docs" },
];

const datasetStepCountOptions = ["0", "1", "2", "3", "4", "5"];

const workbenchRouteOptions = [
	{ value: "knowledge/models", label: "Knowledge · Schema" },
	{ value: "knowledge/records", label: "Knowledge · Graph" },
	{ value: "knowledge/vectors", label: "Knowledge · Vectors" },
	{ value: "system/storage", label: "System · Storage" },
	{ value: "reasoning/plan", label: "Reasoning · Project plan" },
	{ value: "reasoning/tasks", label: "Reasoning · Tasks" },
	{ value: "reasoning/workbench", label: "Reasoning · Workbench" },
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

const remoteSourceProviderOptions: {
	value: WorkbenchRemoteSourceProvider;
	label: string;
}[] = [
	{ value: "google-drive", label: "Google Drive" },
	{ value: "google-docs-relay", label: "Google Docs relay" },
];

const remoteSourceModeOptions: { value: WorkbenchRemoteSourceMode; label: string }[] = [
	{ value: "import", label: "Import files" },
	{ value: "rag", label: "RAG source" },
	{ value: "tests", label: "Tests and workloads" },
	{ value: "mixed", label: "Mixed usage" },
];

const TEMPLATE_EXPORT_VERSION = 1;

interface TemplateExportPayload {
	version: number;
	exportedAtUnixMs: number;
	templates: WorkbenchDatasetTemplate[];
}

function manualTrigger(): WorkbenchLearningTrigger {
	return { id: newId(), kind: "manual", description: "Run on operator command." };
}

function normalizeTemplateStepCount(count: string | null | undefined) {
	const parsed = Number.parseInt(count ?? "0", 10);
	if (Number.isNaN(parsed)) return 0;
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
				route: "reasoning/workbench",
			}
		);
	});
}

function inferPathLabel(path: string) {
	const normalized = path.replace(/\\/g, "/");
	const parts = normalized.split("/").filter((part) => part.length > 0);
	return parts[parts.length - 1] ?? path;
}

function relayUrlForGoogleDocs(url: string) {
	const match = url.match(/\/document\/d\/([^/]+)/);
	if (!match) return null;
	return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
}

/** Joins with the separator the linked folder already uses. */
function joinPath(folder: string, name: string) {
	const separator = folder.includes("\\") && !folder.includes("/") ? "\\" : "/";
	const base = folder.endsWith("\\") || folder.endsWith("/") ? folder.slice(0, -1) : folder;
	return `${base}${separator}${name}`;
}

function downloadArtifact(artifact: DatasetBuildArtifact) {
	const blob = new Blob([artifact.content], { type: "application/json" });
	const href = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = href;
	link.download = artifact.fileName;
	link.click();
	URL.revokeObjectURL(href);
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry: unknown): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function splitLines(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseLearningEvents(value: unknown): WorkbenchLearningEvent[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry: unknown) => typeof entry === "object" && entry !== null)
		.map((entryValue: unknown) => {
			const event = entryValue as Record<string, unknown>;
			const kind =
				event.kind === "did-you-know" ||
				event.kind === "knowledge-drop" ||
				event.kind === "factoid"
					? event.kind
					: "factoid";
			const mode =
				event.mode === "passive" || event.mode === "interactive" ? event.mode : "passive";
			const component =
				event.component === "card" ||
				event.component === "alert" ||
				event.component === "badge"
					? event.component
					: "card";
			const route =
				typeof event.route === "string" && event.route.trim() ? event.route : undefined;
			const actions: WorkbenchLearningAction[] = (
				Array.isArray(event.actions) ? event.actions : []
			)
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
			const triggers: WorkbenchLearningTrigger[] = (
				Array.isArray(event.triggers) ? event.triggers : []
			)
				.filter(
					(triggerValue: unknown) =>
						typeof triggerValue === "object" && triggerValue !== null,
				)
				.map((triggerValue: unknown) => {
					const trigger = triggerValue as Record<string, unknown>;
					const triggerKind =
						trigger.kind === "manual" ||
						trigger.kind === "cold-signal" ||
						trigger.kind === "linked-path-missing" ||
						trigger.kind === "governed-flights-available"
							? trigger.kind
							: "manual";
					return {
						id: newId(),
						kind: triggerKind,
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
					typeof event.catamorphismTarget === "string" && event.catamorphismTarget.trim()
						? event.catamorphismTarget.trim()
						: "clyffy",
				catamorphismNote:
					typeof event.catamorphismNote === "string" ? event.catamorphismNote.trim() : "",
			};
		});
}

/** Accepts an exported template file; unknown linked paths are dropped, not invented. */
export function parseTemplateImport(
	value: unknown,
	linkedPaths: WorkbenchLinkedPath[],
): WorkbenchDatasetTemplate[] {
	if (typeof value !== "object" || value === null) return [];
	const payload = value as { templates?: unknown };
	if (!Array.isArray(payload.templates)) return [];
	const linkedPathIds = new Set(linkedPaths.map((entry) => entry.id));
	const imported: WorkbenchDatasetTemplate[] = [];
	for (const templateValue of payload.templates) {
		if (typeof templateValue !== "object" || templateValue === null) continue;
		const template = templateValue as Record<string, unknown>;
		const name = typeof template.name === "string" ? template.name.trim() : "";
		if (!name) continue;
		const importedSteps = Array.isArray(template.steps) ? template.steps : [];
		const steps: WorkbenchTemplateStep[] = importedSteps
			.slice(0, 5)
			.map((stepValue: unknown, index: number) => {
				const step =
					typeof stepValue === "object" && stepValue !== null
						? (stepValue as Record<string, unknown>)
						: {};
				const linkedPathId =
					typeof step.linkedPathId === "string" && linkedPathIds.has(step.linkedPathId)
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
							: "reasoning/workbench",
					linkedPathId,
				};
			});
		const now = Date.now();
		imported.push({
			id: newId(),
			name,
			description:
				typeof template.description === "string" ? template.description.trim() : "",
			schema: typeof template.schema === "string" ? template.schema.trim() : "",
			skills: toStringArray(template.skills),
			researchReferences: toStringArray(template.researchReferences),
			minimumRequirements: toStringArray(template.minimumRequirements),
			filePatterns: toStringArray(template.filePatterns),
			folderPatterns: toStringArray(template.folderPatterns),
			createdAtUnixMs:
				typeof template.createdAtUnixMs === "number" ? template.createdAtUnixMs : now,
			updatedAtUnixMs: now,
			steps,
			learningEvents: parseLearningEvents(template.learningEvents),
		});
	}
	return imported;
}

/** Fills the fields a connection saved before these lanes existed. */
export function normalizeWorkbench(
	state: ConnectionWorkbenchState | undefined,
): ConnectionWorkbenchState {
	const templates = (state?.templates ?? []).map((template) => ({
		...template,
		skills: template.skills ?? [],
		researchReferences: template.researchReferences ?? [],
		learningEvents: (template.learningEvents ?? []).map((event) => ({
			...event,
			requiresOperatorSignoff:
				typeof event.requiresOperatorSignoff === "boolean"
					? event.requiresOperatorSignoff
					: event.mode === "interactive",
			triggers: event.triggers ?? [manualTrigger()],
			actions: event.actions ?? [],
		})),
	}));
	return {
		workbenches: state?.workbenches ?? [],
		activeWorkbenchId: state?.activeWorkbenchId,
		receipts: state?.receipts ?? [],
		templates,
		linkedPaths: state?.linkedPaths ?? [],
		remoteSources: state?.remoteSources ?? [],
	};
}

function formatWhen(unixMs: number | null | undefined) {
	if (!unixMs) return "none yet";
	return new Date(unixMs).toLocaleString();
}

export function WorkbenchLanes({
	client,
	connectionId,
	connected,
	lane,
	onOpenRoute,
	onRefreshSnapshot,
	snapshotAvailable,
	flightCount,
	onCaptureReceipt,
	onStageComparePrompt,
}: {
	client: RrdSessionClient;
	connectionId: string;
	connected: boolean;
	lane: WorkbenchLane;
	onOpenRoute: (route: string) => void;
	onRefreshSnapshot: () => Promise<unknown>;
	snapshotAvailable: boolean;
	flightCount: number;
	onCaptureReceipt: () => Promise<unknown>;
	onStageComparePrompt: (prompt: string) => void;
}) {
	const connection = useConfigStore((state) =>
		state.connections.find((candidate) => candidate.id === connectionId),
	);
	const updateConnection = useConfigStore((state) => state.updateConnection);
	const workbench = useMemo(
		() => normalizeWorkbench(connection?.workbench),
		[connection?.workbench],
	);
	const remoteSources = workbench.remoteSources ?? [];
	const activeWorkbenchId = workbench.activeWorkbenchId ?? workbench.workbenches[0]?.id;
	const activeWorkbench =
		workbench.workbenches.find((candidate) => candidate.id === activeWorkbenchId) ?? null;

	const [templateName, setTemplateName] = useState("");
	const [templateDescription, setTemplateDescription] = useState("");
	const [templateSchema, setTemplateSchema] = useState("");
	const [templateSkills, setTemplateSkills] = useState("");
	const [templateResearchReferences, setTemplateResearchReferences] = useState("");
	const [templateRequirements, setTemplateRequirements] = useState("");
	const [templateFilePatterns, setTemplateFilePatterns] = useState("");
	const [templateFolderPatterns, setTemplateFolderPatterns] = useState("");
	const [templateStepCount, setTemplateStepCount] = useState("3");
	const [templateImportError, setTemplateImportError] = useState<string | null>(null);
	const [learningKind, setLearningKind] = useState<WorkbenchLearningEventKind>("did-you-know");
	const [learningMode, setLearningMode] = useState<WorkbenchLearningEventMode>("passive");
	const [learningComponent, setLearningComponent] = useState<"card" | "alert" | "badge">("card");
	const [learningRequiresSignoff, setLearningRequiresSignoff] = useState(true);
	const [learningTitle, setLearningTitle] = useState("");
	const [learningBody, setLearningBody] = useState("");
	const [learningRoute, setLearningRoute] = useState<string>("reasoning/workbench");
	const [learningCatamorphismNote, setLearningCatamorphismNote] = useState("");
	const [learningActionName, setLearningActionName] =
		useState<WorkbenchLearningActionName>("navigate-route");
	const [learningActionLabel, setLearningActionLabel] = useState("");
	const [learningActionPayload, setLearningActionPayload] = useState("");
	const [learningActions, setLearningActions] = useState<WorkbenchLearningAction[]>([]);
	const [learningTriggerKind, setLearningTriggerKind] =
		useState<WorkbenchLearningTriggerKind>("manual");
	const [learningTriggerDescription, setLearningTriggerDescription] = useState("");
	const [learningTriggers, setLearningTriggers] = useState<WorkbenchLearningTrigger[]>([
		manualTrigger(),
	]);
	const [templateLearningEvents, setTemplateLearningEvents] = useState<WorkbenchLearningEvent[]>(
		[],
	);
	const [templateSteps, setTemplateSteps] = useState<WorkbenchTemplateStep[]>(
		buildTemplateSteps(3, undefined),
	);
	const [linkLabelDraft, setLinkLabelDraft] = useState("");
	const [linkError, setLinkError] = useState<string | null>(null);
	const [eventExecutionError, setEventExecutionError] = useState<string | null>(null);
	const [runningEventIds, setRunningEventIds] = useState<string[]>([]);
	const [autoTriggeredEventKeys, setAutoTriggeredEventKeys] = useState<string[]>([]);
	const [datasetBuildTemplateId, setDatasetBuildTemplateId] = useState<string | null>(null);
	const [datasetWorkloadProfileId, setDatasetWorkloadProfileId] = useState<string>(
		benchmarkWorkloadProfiles[0].id,
	);
	const [datasetBuildRunLabel, setDatasetBuildRunLabel] = useState("");
	const [datasetBuildFolderLinkId, setDatasetBuildFolderLinkId] = useState<string | null>(null);
	const [datasetBuildError, setDatasetBuildError] = useState<string | null>(null);
	const [datasetBuildResults, setDatasetBuildResults] = useState<DatasetBuildResult[]>([]);
	const [remoteSourceProvider, setRemoteSourceProvider] =
		useState<WorkbenchRemoteSourceProvider>("google-drive");
	const [remoteSourceMode, setRemoteSourceMode] = useState<WorkbenchRemoteSourceMode>("import");
	const [remoteSourceLabel, setRemoteSourceLabel] = useState("");
	const [remoteSourceUrl, setRemoteSourceUrl] = useState("");
	const [remoteSourceNote, setRemoteSourceNote] = useState("");
	const [remoteSourceError, setRemoteSourceError] = useState<string | null>(null);
	const [selectedDocSourceId, setSelectedDocSourceId] = useState<string | null>(null);
	const [docWorkspaceTitle, setDocWorkspaceTitle] = useState("");
	const [docWorkspaceContent, setDocWorkspaceContent] = useState("");
	const [docWorkspaceError, setDocWorkspaceError] = useState<string | null>(null);
	const [docWorkspaceBusy, setDocWorkspaceBusy] = useState(false);
	const importInputRef = useRef<HTMLInputElement | null>(null);

	const storageSignals = useQuery<RrdStorageView>({
		queryKey: ["rrd-workbench-storage-signals", connectionId],
		enabled: connected && lane !== "runtime-control",
		queryFn: () => client.storage(),
		refetchInterval: 10_000,
		retry: false,
	});
	const coldSignals = (storageSignals.data?.physical.headline ?? []).filter(
		(metric) => metric.id.includes("cold") || metric.id.includes("cache"),
	);

	/** Writes the lanes' state back; always starts from the store's latest copy. */
	const saveWorkbench = useCallback(
		(change: Partial<ConnectionWorkbenchState>) => {
			const latest = useConfigStore
				.getState()
				.connections.find((candidate) => candidate.id === connectionId);
			if (!latest) return;
			const current = normalizeWorkbench(latest.workbench);
			updateConnection({ id: connectionId, workbench: { ...current, ...change } });
		},
		[connectionId, updateConnection],
	);

	const recordReceipt = useCallback(
		(intent: string, context: string, diagnostics: string) => {
			if (!activeWorkbench) return;
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
						intent,
						context,
						diagnostics,
						recordedAtUnixMs: now,
					},
					...workbench.receipts,
				],
			});
		},
		[activeWorkbench, saveWorkbench, workbench.workbenches, workbench.receipts],
	);

	const updateTemplateStep = (
		index: number,
		field: keyof WorkbenchTemplateStep,
		value: string | undefined,
	) => {
		setTemplateSteps((current) =>
			current.map((step, stepIndex) =>
				stepIndex === index ? { ...step, [field]: value } : step,
			),
		);
	};

	const updateTemplateStepCount = (next: string | null) => {
		const normalized = normalizeTemplateStepCount(next);
		setTemplateStepCount(String(normalized));
		setTemplateSteps((current) => buildTemplateSteps(normalized, current));
	};

	const resetLearningDraft = () => {
		setLearningTitle("");
		setLearningBody("");
		setLearningCatamorphismNote("");
		setLearningActions([]);
		setLearningActionLabel("");
		setLearningActionPayload("");
		setLearningTriggers([manualTrigger()]);
	};

	const addLearningEvent = () => {
		const title = learningTitle.trim();
		if (!title) return;
		const eventActions: WorkbenchLearningAction[] =
			learningActions.length > 0
				? learningActions
				: [
						{
							id: newId(),
							name: "navigate-route",
							label: "Open event route",
							payload: learningRoute,
						},
					];
		const eventTriggers = learningTriggers.length > 0 ? learningTriggers : [manualTrigger()];
		setTemplateLearningEvents((current) => [
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
		resetLearningDraft();
	};

	const removeLearningEvent = (eventId: string) => {
		setTemplateLearningEvents((current) => current.filter((event) => event.id !== eventId));
	};

	const addLearningAction = () => {
		setLearningActions((current) => [
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
		setLearningActions((current) => current.filter((action) => action.id !== actionId));
	};

	const addLearningTrigger = () => {
		setLearningTriggers((current) => [
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
		setLearningTriggers((current) => current.filter((trigger) => trigger.id !== triggerId));
	};

	const isTriggerActive = useCallback(
		(trigger: WorkbenchLearningTrigger) => {
			if (trigger.kind === "manual") return true;
			if (trigger.kind === "cold-signal") return coldSignals.length > 0;
			if (trigger.kind === "linked-path-missing")
				return workbench.linkedPaths.some((path) => path.status !== "available");
			if (trigger.kind === "governed-flights-available") return flightCount > 0;
			return false;
		},
		[coldSignals.length, workbench.linkedPaths, flightCount],
	);

	const createTemplate = () => {
		const name = templateName.trim();
		if (!name) return;
		const now = Date.now();
		const steps = templateSteps
			.slice(0, normalizeTemplateStepCount(templateStepCount))
			.map((step, index) => ({
				...step,
				title: step.title.trim() || `Step ${index + 1}`,
				detail: step.detail.trim(),
			}));
		const template: WorkbenchDatasetTemplate = {
			id: newId(),
			name,
			description: templateDescription.trim(),
			schema: templateSchema.trim(),
			skills: splitLines(templateSkills),
			researchReferences: splitLines(templateResearchReferences),
			minimumRequirements: splitLines(templateRequirements),
			filePatterns: splitLines(templateFilePatterns),
			folderPatterns: splitLines(templateFolderPatterns),
			createdAtUnixMs: now,
			updatedAtUnixMs: now,
			steps,
			learningEvents: templateLearningEvents,
		};
		saveWorkbench({ templates: [template, ...workbench.templates] });
		setTemplateName("");
		setTemplateDescription("");
		setTemplateSchema("");
		setTemplateSkills("");
		setTemplateResearchReferences("");
		setTemplateRequirements("");
		setTemplateFilePatterns("");
		setTemplateFolderPatterns("");
		setTemplateStepCount("0");
		setTemplateSteps([]);
		setTemplateLearningEvents([]);
		setLearningRequiresSignoff(true);
		resetLearningDraft();
	};

	const exportTemplates = () => {
		const payload: TemplateExportPayload = {
			version: TEMPLATE_EXPORT_VERSION,
			exportedAtUnixMs: Date.now(),
			templates: workbench.templates,
		};
		downloadArtifact({
			fileName: `rrflow-workbench-templates-${connectionId}.json`,
			content: JSON.stringify(payload, null, 2),
		});
	};

	const openTemplateImport = () => {
		setTemplateImportError(null);
		importInputRef.current?.click();
	};

	const importTemplates = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = "";
		if (!file) return;
		setTemplateImportError(null);
		try {
			const parsed = JSON.parse(await file.text()) as unknown;
			const imported = parseTemplateImport(parsed, workbench.linkedPaths);
			if (imported.length === 0) {
				setTemplateImportError("The selected file contains no valid dataset templates.");
				return;
			}
			saveWorkbench({ templates: [...imported, ...workbench.templates] });
		} catch (error) {
			setTemplateImportError(error instanceof Error ? error.message : String(error));
		}
	};

	const removeTemplate = (templateId: string) => {
		saveWorkbench({
			templates: workbench.templates.filter((template) => template.id !== templateId),
		});
	};

	const probeLinkedPath = useCallback(async (linkedPath: WorkbenchLinkedPath) => {
		const probe = await probeExternalPath({ path: linkedPath.path });
		return {
			...linkedPath,
			status: probe.connected ? "available" : "missing",
			lastCheckedAtUnixMs: Date.now(),
			lastConnectedAtUnixMs: probe.connected ? Date.now() : linkedPath.lastConnectedAtUnixMs,
			message: probe.message ?? undefined,
		} satisfies WorkbenchLinkedPath;
	}, []);

	const refreshLinkedPaths = useCallback(async () => {
		if (!isTauri()) return;
		const latest = useConfigStore
			.getState()
			.connections.find((candidate) => candidate.id === connectionId);
		if (!latest) return;
		const current = normalizeWorkbench(latest.workbench);
		if (current.linkedPaths.length === 0) return;
		const refreshed = await Promise.all(current.linkedPaths.map(probeLinkedPath));
		const changed = refreshed.some((entry, index) => {
			const previous = current.linkedPaths[index];
			return (
				previous.status !== entry.status ||
				previous.path !== entry.path ||
				(previous.message ?? "") !== (entry.message ?? "")
			);
		});
		if (changed) saveWorkbench({ linkedPaths: refreshed });
	}, [connectionId, probeLinkedPath, saveWorkbench]);

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
		if (typeof selection !== "string") return;
		const linkedPath: WorkbenchLinkedPath = {
			id: newId(),
			label: linkLabelDraft.trim() || inferPathLabel(selection),
			path: selection,
			kind,
			status: "unknown",
			lastCheckedAtUnixMs: Date.now(),
		};
		const probed = await probeLinkedPath(linkedPath);
		saveWorkbench({ linkedPaths: [probed, ...workbench.linkedPaths] });
		setLinkLabelDraft("");
	};

	const reconnectLinkedPath = async (linkedPathId: string) => {
		const linkedPath = workbench.linkedPaths.find((entry) => entry.id === linkedPathId);
		if (!linkedPath) return;
		const selection = await open({
			title: `Reconnect ${linkedPath.label}`,
			multiple: false,
			directory: linkedPath.kind === "directory",
			defaultPath: linkedPath.path,
		});
		if (typeof selection !== "string") return;
		const refreshed = await probeLinkedPath({
			...linkedPath,
			path: selection,
			status: "unknown",
		});
		saveWorkbench({
			linkedPaths: workbench.linkedPaths.map((entry) =>
				entry.id === linkedPathId ? refreshed : entry,
			),
		});
	};

	const removeLinkedPath = (linkedPathId: string) => {
		saveWorkbench({
			templates: workbench.templates.map((template) => ({
				...template,
				steps: template.steps.map((step) =>
					step.linkedPathId === linkedPathId
						? { ...step, linkedPathId: undefined }
						: step,
				),
			})),
			linkedPaths: workbench.linkedPaths.filter((candidate) => candidate.id !== linkedPathId),
		});
	};

	const addRemoteSource = () => {
		setRemoteSourceError(null);
		const url = remoteSourceUrl.trim();
		if (!url) {
			setRemoteSourceError("Remote source URL is required.");
			return;
		}
		let relayUrl: string | undefined;
		if (remoteSourceProvider === "google-docs-relay") {
			relayUrl = relayUrlForGoogleDocs(url) ?? undefined;
			if (!relayUrl) {
				setRemoteSourceError("Provide a valid Google Docs document URL for relay setup.");
				return;
			}
		}
		const now = Date.now();
		const source: WorkbenchRemoteSource = {
			id: newId(),
			label: remoteSourceLabel.trim() || inferPathLabel(url),
			provider: remoteSourceProvider,
			mode: remoteSourceMode,
			url,
			relayUrl,
			note: remoteSourceNote.trim() || undefined,
			status: "configured",
			createdAtUnixMs: now,
			updatedAtUnixMs: now,
		};
		saveWorkbench({ remoteSources: [source, ...remoteSources] });
		setRemoteSourceLabel("");
		setRemoteSourceUrl("");
		setRemoteSourceNote("");
	};

	const removeRemoteSource = (sourceId: string) => {
		saveWorkbench({ remoteSources: remoteSources.filter((source) => source.id !== sourceId) });
	};

	const loadDocIntoWorkspace = async (source: WorkbenchRemoteSource) => {
		setDocWorkspaceError(null);
		setDocWorkspaceBusy(true);
		try {
			const response = await fetch(source.relayUrl ?? source.url);
			if (!response.ok) throw new Error(`Remote read failed: ${response.status}`);
			const content = await response.text();
			setSelectedDocSourceId(source.id);
			setDocWorkspaceTitle(source.label);
			setDocWorkspaceContent(content);
		} catch (error) {
			setDocWorkspaceError(error instanceof Error ? error.message : String(error));
		} finally {
			setDocWorkspaceBusy(false);
		}
	};

	const copyDocWorkspace = async () => {
		setDocWorkspaceError(null);
		try {
			await navigator.clipboard.writeText(docWorkspaceContent);
		} catch (error) {
			setDocWorkspaceError(error instanceof Error ? error.message : String(error));
		}
	};

	const linkedOutputFolder = findLinkedOutputFolder(
		workbench.linkedPaths,
		datasetBuildFolderLinkId,
	);

	const saveDocWorkspaceToLinkedFolder = async () => {
		setDocWorkspaceError(null);
		if (!linkedOutputFolder) {
			setDocWorkspaceError("Select an available linked output folder first.");
			return;
		}
		const fileNameBase = (docWorkspaceTitle.trim() || "doc-workspace")
			.replace(/[^a-zA-Z0-9-_]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.toLowerCase();
		try {
			await writeExternalTextFile({
				path: joinPath(linkedOutputFolder.path, `${fileNameBase || "doc-workspace"}.txt`),
				content: docWorkspaceContent,
				create_parent_dirs: true,
			});
		} catch (error) {
			setDocWorkspaceError(error instanceof Error ? error.message : String(error));
		}
	};

	const runLearningAction = useCallback(
		async (action: WorkbenchLearningAction) => {
			if (action.name === "navigate-route") {
				onOpenRoute(action.payload?.trim() || "reasoning/workbench");
			} else if (action.name === "open-workbench") {
				onOpenRoute("reasoning/workbench");
			} else if (action.name === "refresh-storage-signals") {
				await storageSignals.refetch();
			} else if (action.name === "refresh-governed-flights") {
				await onRefreshSnapshot();
			} else if (action.name === "capture-runtime-receipt") {
				await onCaptureReceipt();
			}
		},
		[onOpenRoute, storageSignals, onRefreshSnapshot, onCaptureReceipt],
	);

	const runLearningEvent = useCallback(
		async (templateName: string, event: WorkbenchLearningEvent) => {
			setEventExecutionError(null);
			setRunningEventIds((current) => [...current, event.id]);
			try {
				if (event.actions.length === 0)
					throw new Error("Scripted event has no actions to execute.");
				for (const action of event.actions) await runLearningAction(action);
				recordReceipt(
					`MCPL event executed: ${event.title}`,
					`template=${templateName}; kind=${event.kind}; mode=${event.mode}; component=${event.component}`,
					`actions=${event.actions.map((action) => action.name).join(",")}; triggers=${event.triggers
						.map((trigger) => trigger.kind)
						.join(",")}; catamorphism=${event.catamorphismTarget}`,
				);
			} catch (error) {
				setEventExecutionError(error instanceof Error ? error.message : String(error));
			} finally {
				setRunningEventIds((current) => current.filter((id) => id !== event.id));
			}
		},
		[runLearningAction, recordReceipt],
	);

	useEffect(() => {
		if (!isTauri() || lane === "runtime-control") return;
		void refreshLinkedPaths();
		const timer = window.setInterval(() => void refreshLinkedPaths(), 10_000);
		return () => window.clearInterval(timer);
	}, [lane, refreshLinkedPaths]);

	useEffect(() => {
		if (lane === "runtime-control") return;
		for (const template of workbench.templates) {
			for (const event of template.learningEvents) {
				if (event.requiresOperatorSignoff || event.mode !== "passive") continue;
				if (!event.triggers.some((trigger) => isTriggerActive(trigger))) continue;
				const key = `${template.id}:${event.id}`;
				if (autoTriggeredEventKeys.includes(key)) continue;
				setAutoTriggeredEventKeys((current) => [...current, key]);
				void runLearningEvent(template.name, event);
			}
		}
	}, [lane, workbench.templates, autoTriggeredEventKeys, isTriggerActive, runLearningEvent]);

	const selectedDatasetTemplate =
		workbench.templates.find((template) => template.id === datasetBuildTemplateId) ??
		workbench.templates[0] ??
		null;
	const learningEvents = useMemo(
		() => buildLearningEventEntries(workbench.templates),
		[workbench.templates],
	);
	const linkedPathOptions = useMemo(
		() => buildLinkedPathOptions(workbench.linkedPaths),
		[workbench.linkedPaths],
	);
	const { showDatasetLane, showMcplLane, showCloudLane } = getWorkbenchLaneVisibility(lane);
	const selectedWorkloadProfile = getSelectedWorkloadProfile(datasetWorkloadProfileId);
	const datasetFlowReadiness = useMemo(
		() =>
			buildDatasetFlowReadiness({
				selectedDatasetTemplate,
				selectedWorkloadProfile,
				remoteSources,
				datasetBuildFolderLinkId,
			}),
		[selectedDatasetTemplate, selectedWorkloadProfile, remoteSources, datasetBuildFolderLinkId],
	);
	const latestDatasetBuildResult = getLatestDatasetBuildResult(datasetBuildResults);
	const datasetOutputFolderOptions = useMemo(
		() => buildDatasetOutputFolderOptions(workbench.linkedPaths),
		[workbench.linkedPaths],
	);
	const datasetCompareReadiness = useMemo(
		() =>
			buildDatasetCompareReadiness({
				latestDatasetBuildResult,
				connected,
				sessionClientAvailable: true,
				activeWorkbench,
				workbenchSnapshotAvailable: snapshotAvailable,
			}),
		[latestDatasetBuildResult, connected, activeWorkbench, snapshotAvailable],
	);

	const generateDatasetFiles = async () => {
		setDatasetBuildError(null);
		if (!selectedDatasetTemplate) {
			setDatasetBuildError("Select a dataset template first.");
			return;
		}
		if (selectedWorkloadProfile.requiresRemoteSource && remoteSources.length === 0) {
			setDatasetBuildError(
				`Workload "${selectedWorkloadProfile.label}" requires at least one configured cloud source.`,
			);
			return;
		}
		const runLabel = datasetBuildRunLabel.trim() || `dataset-run-${Date.now()}`;
		const runSlug = runLabel.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-");
		const runFolder = runSlug.length > 0 ? runSlug : `dataset-run-${Date.now()}`;
		const artifacts = buildDatasetArtifacts({
			template: selectedDatasetTemplate,
			runLabel,
			workloadProfile: selectedWorkloadProfile,
			remoteSources,
			telemetry: {
				profile: "real-world-baseline",
				hops: true,
				actions: true,
				tools: true,
				time: true,
			},
		}).map((artifact) => ({ ...artifact, fileName: `${runFolder}-${artifact.fileName}` }));
		try {
			const createdAtUnixMs = Date.now();
			let outputMode: DatasetBuildResult["outputMode"] = "download";
			let outputPath: string | null = null;
			if (linkedOutputFolder) {
				const outputFolder = joinPath(linkedOutputFolder.path, runFolder);
				for (const artifact of artifacts) {
					await writeExternalTextFile({
						path: joinPath(outputFolder, artifact.fileName),
						content: artifact.content,
						create_parent_dirs: true,
					});
				}
				outputMode = "linked-folder";
				outputPath = outputFolder;
			} else {
				for (const artifact of artifacts) downloadArtifact(artifact);
			}
			setDatasetBuildResults((current) => [
				{
					id: newId(),
					templateId: selectedDatasetTemplate.id,
					templateName: selectedDatasetTemplate.name,
					workloadProfileId: selectedWorkloadProfile.id,
					workloadProfileLabel: selectedWorkloadProfile.label,
					runLabel,
					createdAtUnixMs,
					outputMode,
					outputPath,
					artifactCount: artifacts.length,
				},
				...current,
			]);
			recordReceipt(
				`Generated benchmark workload bundle (${selectedWorkloadProfile.label})`,
				`template=${selectedDatasetTemplate.name}; runLabel=${runLabel}`,
				`profile=${selectedWorkloadProfile.id}; artifacts=${artifacts.length}; outputMode=${outputMode}; outputPath=${outputPath ?? "download"}`,
			);
		} catch (error) {
			setDatasetBuildError(error instanceof Error ? error.message : String(error));
		}
	};

	const prepareDatasetCompareFlight = () => {
		if (!latestDatasetBuildResult) {
			setDatasetBuildError("Generate a benchmark dataset bundle before compare setup.");
			return;
		}
		onStageComparePrompt(
			[
				`Run benchmark compare for ${latestDatasetBuildResult.templateName}.`,
				`Workload profile: ${latestDatasetBuildResult.workloadProfileLabel}.`,
				`Run label: ${latestDatasetBuildResult.runLabel}.`,
				"Use prompt parity against the configured reference and candidate comparators.",
				"Validate index completeness, retrieval accuracy, and comparable latency.",
			].join(" "),
		);
	};

	const recordDatasetCompareReceipt = () => {
		if (!activeWorkbench || !latestDatasetBuildResult) {
			setDatasetBuildError(
				"Select a workbench and generate a bundle before recording receipt.",
			);
			return;
		}
		recordReceipt(
			`Benchmark compare staged (${latestDatasetBuildResult.workloadProfileLabel})`,
			`template=${latestDatasetBuildResult.templateName}; run=${latestDatasetBuildResult.runLabel}`,
			[
				`profile=${latestDatasetBuildResult.workloadProfileId}`,
				`outputMode=${latestDatasetBuildResult.outputMode}`,
				`artifacts=${latestDatasetBuildResult.artifactCount}`,
				`outputPath=${latestDatasetBuildResult.outputPath ?? "download"}`,
				`flightCount=${flightCount}`,
			].join("; "),
		);
	};

	if (lane === "runtime-control") return null;

	return (
		<Stack gap="lg">
			{!connection && (
				<Alert
					color="red"
					title="Connection unavailable"
				>
					This workbench can only be edited when its project profile is available.
				</Alert>
			)}
			{showDatasetLane && (
				<WorkbenchDatasetPanel
					templates={workbench.templates}
					selectedDatasetTemplateId={selectedDatasetTemplate?.id ?? null}
					onSelectTemplate={setDatasetBuildTemplateId}
					workloadProfiles={benchmarkWorkloadProfiles}
					selectedWorkloadProfile={selectedWorkloadProfile}
					onSelectWorkloadProfile={(id) =>
						setDatasetWorkloadProfileId(id ?? benchmarkWorkloadProfiles[0].id)
					}
					datasetBuildRunLabel={datasetBuildRunLabel}
					onChangeRunLabel={setDatasetBuildRunLabel}
					datasetOutputFolderOptions={datasetOutputFolderOptions}
					datasetBuildFolderLinkId={datasetBuildFolderLinkId}
					onSelectOutputFolder={setDatasetBuildFolderLinkId}
					datasetFlowReadiness={datasetFlowReadiness}
					datasetBuildError={datasetBuildError}
					onGenerateDatasetFiles={() => void generateDatasetFiles()}
					datasetBuildResults={datasetBuildResults}
					formatWhen={formatWhen}
					datasetCompareReadiness={datasetCompareReadiness}
					latestDatasetBuildResult={latestDatasetBuildResult}
					onRefreshSnapshot={() => void onRefreshSnapshot()}
					canRefreshSnapshot={connected}
					onPrepareCompareFlight={prepareDatasetCompareFlight}
					onRecordCompareReceipt={recordDatasetCompareReceipt}
					canRecordCompareReceipt={
						Boolean(latestDatasetBuildResult) && Boolean(activeWorkbench)
					}
				/>
			)}
			<SimpleGrid cols={{ base: 1, md: 2 }}>
				{(showDatasetLane || showMcplLane) && (
					<WorkbenchTemplateAuthoringPanel
						connectionAvailable={Boolean(connection)}
						templatesCount={workbench.templates.length}
						onExportTemplates={exportTemplates}
						onOpenTemplateImport={openTemplateImport}
						importInputRef={importInputRef}
						onImportTemplates={(event) => void importTemplates(event)}
						templateImportError={templateImportError}
						templateName={templateName}
						onChangeTemplateName={setTemplateName}
						templateDescription={templateDescription}
						onChangeTemplateDescription={setTemplateDescription}
						templateSchema={templateSchema}
						onChangeTemplateSchema={setTemplateSchema}
						templateSkills={templateSkills}
						onChangeTemplateSkills={setTemplateSkills}
						templateResearchReferences={templateResearchReferences}
						onChangeTemplateResearchReferences={setTemplateResearchReferences}
						templateRequirements={templateRequirements}
						onChangeTemplateRequirements={setTemplateRequirements}
						templateFilePatterns={templateFilePatterns}
						onChangeTemplateFilePatterns={setTemplateFilePatterns}
						templateFolderPatterns={templateFolderPatterns}
						onChangeTemplateFolderPatterns={setTemplateFolderPatterns}
						learningKind={learningKind}
						learningKindOptions={learningKindOptions}
						onChangeLearningKind={(next) => setLearningKind(next ?? "did-you-know")}
						learningMode={learningMode}
						learningModeOptions={learningModeOptions}
						onChangeLearningMode={(next) => setLearningMode(next ?? "passive")}
						learningComponent={learningComponent}
						onChangeLearningComponent={(next) => setLearningComponent(next ?? "card")}
						learningTitle={learningTitle}
						onChangeLearningTitle={setLearningTitle}
						learningBody={learningBody}
						onChangeLearningBody={setLearningBody}
						learningRoute={learningRoute}
						workbenchRouteOptions={workbenchRouteOptions}
						onChangeLearningRoute={(next) =>
							setLearningRoute(next ?? "reasoning/workbench")
						}
						learningRequiresSignoff={learningRequiresSignoff}
						onChangeLearningRequiresSignoff={(next) =>
							setLearningRequiresSignoff((next ?? "yes") === "yes")
						}
						learningCatamorphismNote={learningCatamorphismNote}
						onChangeLearningCatamorphismNote={setLearningCatamorphismNote}
						learningActionName={learningActionName}
						learningActionOptions={learningActionOptions}
						onChangeLearningActionName={(next) =>
							setLearningActionName(next ?? "navigate-route")
						}
						learningActionLabel={learningActionLabel}
						onChangeLearningActionLabel={setLearningActionLabel}
						learningActionPayload={learningActionPayload}
						onChangeLearningActionPayload={setLearningActionPayload}
						learningActions={learningActions}
						onAddLearningAction={addLearningAction}
						onRemoveLearningAction={removeLearningAction}
						learningTriggerKind={learningTriggerKind}
						learningTriggerOptions={learningTriggerOptions}
						onChangeLearningTriggerKind={(next) =>
							setLearningTriggerKind(next ?? "manual")
						}
						learningTriggerDescription={learningTriggerDescription}
						onChangeLearningTriggerDescription={setLearningTriggerDescription}
						learningTriggers={learningTriggers}
						onAddLearningTrigger={addLearningTrigger}
						onRemoveLearningTrigger={removeLearningTrigger}
						templateLearningEvents={templateLearningEvents}
						onAddLearningEvent={addLearningEvent}
						onRemoveLearningEvent={removeLearningEvent}
						templateStepCount={templateStepCount}
						datasetStepCountOptions={datasetStepCountOptions}
						onChangeTemplateStepCount={updateTemplateStepCount}
						templateSteps={templateSteps}
						onUpdateTemplateStep={updateTemplateStep}
						linkedPathOptions={linkedPathOptions}
						onCreateTemplate={createTemplate}
					/>
				)}
				{(showDatasetLane || showCloudLane) && (
					<WorkbenchLinkedCloudPanel
						connectionAvailable={Boolean(connection)}
						linkLabelDraft={linkLabelDraft}
						onChangeLinkLabelDraft={setLinkLabelDraft}
						onAddLinkedFile={() => void addLinkedPath("file")}
						onAddLinkedFolder={() => void addLinkedPath("directory")}
						onRefreshLinks={() => void refreshLinkedPaths()}
						linkError={linkError}
						linkedPaths={workbench.linkedPaths}
						formatWhen={formatWhen}
						onReconnectLinkedPath={(linkedPathId) =>
							void reconnectLinkedPath(linkedPathId)
						}
						onRemoveLinkedPath={removeLinkedPath}
						remoteSourceProvider={remoteSourceProvider}
						remoteSourceProviderOptions={remoteSourceProviderOptions}
						onChangeRemoteSourceProvider={setRemoteSourceProvider}
						remoteSourceMode={remoteSourceMode}
						remoteSourceModeOptions={remoteSourceModeOptions}
						onChangeRemoteSourceMode={setRemoteSourceMode}
						remoteSourceLabel={remoteSourceLabel}
						onChangeRemoteSourceLabel={setRemoteSourceLabel}
						remoteSourceUrl={remoteSourceUrl}
						onChangeRemoteSourceUrl={setRemoteSourceUrl}
						remoteSourceNote={remoteSourceNote}
						onChangeRemoteSourceNote={setRemoteSourceNote}
						remoteSourceError={remoteSourceError}
						onAddRemoteSource={addRemoteSource}
						remoteSources={remoteSources}
						onLoadDocIntoWorkspace={(source) => void loadDocIntoWorkspace(source)}
						onRemoveRemoteSource={removeRemoteSource}
						docWorkspaceBusy={docWorkspaceBusy}
						docWorkspaceTitle={docWorkspaceTitle}
						onChangeDocWorkspaceTitle={setDocWorkspaceTitle}
						docWorkspaceContent={docWorkspaceContent}
						onChangeDocWorkspaceContent={setDocWorkspaceContent}
						docWorkspaceError={docWorkspaceError}
						onCopyDocWorkspace={() => void copyDocWorkspace()}
						onSaveDocWorkspaceToLinkedFolder={() =>
							void saveDocWorkspaceToLinkedFolder()
						}
						canSaveDocWorkspaceToLinkedFolder={
							docWorkspaceContent.length > 0 && Boolean(linkedOutputFolder)
						}
						selectedDocSourceId={selectedDocSourceId}
					/>
				)}
				{(showDatasetLane || showCloudLane) && (
					<WorkbenchTemplateLibraryPanel
						eventExecutionError={eventExecutionError}
						templates={workbench.templates}
						linkedPaths={workbench.linkedPaths}
						onRemoveTemplate={removeTemplate}
						onOpenRoute={onOpenRoute}
						isTriggerActive={isTriggerActive}
						onRunLearningEvent={(templateName, event) =>
							void runLearningEvent(templateName, event)
						}
						runningEventIds={runningEventIds}
					/>
				)}
			</SimpleGrid>
			{showMcplLane && (
				<WorkbenchMcplLanePanel
					learningEvents={learningEvents}
					runningEventIds={runningEventIds}
					isTriggerActive={(event) =>
						event.triggers.some((trigger) => isTriggerActive(trigger))
					}
					onRunLearningEvent={(templateName, event) =>
						void runLearningEvent(templateName, event)
					}
					onOpenRoute={onOpenRoute}
				/>
			)}
		</Stack>
	);
}

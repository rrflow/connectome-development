import type {
	WorkbenchDatasetTemplate,
	WorkbenchDefinition,
	WorkbenchLearningEvent,
	WorkbenchLinkedPath,
	WorkbenchRemoteSource,
} from "~/shared/types";
import {
	type BenchmarkWorkloadProfile,
	benchmarkWorkloadProfiles,
	type DatasetBuildResult,
} from "../datasets/dataset";

export interface WorkbenchLearningEventEntry {
	templateId: string;
	templateName: string;
	event: WorkbenchLearningEvent;
}

export interface DatasetLaneReadiness {
	id: string;
	label: string;
	ready: boolean;
}

export type WorkbenchLane =
	| "runtime-control"
	| "dataset-authoring"
	| "mcpl-learning"
	| "cloud-docs"
	| "receipts";

export function getWorkbenchLaneVisibility(workbenchLane: WorkbenchLane) {
	return {
		showRuntimeLane: workbenchLane === "runtime-control",
		showDatasetLane: workbenchLane === "dataset-authoring",
		showMcplLane: workbenchLane === "mcpl-learning",
		showCloudLane: workbenchLane === "cloud-docs",
		showReceiptsLane: workbenchLane === "receipts",
	};
}

export function getSelectedWorkloadProfile(
	datasetWorkloadProfileId: string,
): BenchmarkWorkloadProfile {
	return (
		benchmarkWorkloadProfiles.find((profile) => profile.id === datasetWorkloadProfileId) ??
		benchmarkWorkloadProfiles[0]
	);
}

export function buildLearningEventEntries(
	templates: WorkbenchDatasetTemplate[],
): WorkbenchLearningEventEntry[] {
	return templates.flatMap((template) =>
		template.learningEvents.map((event) => ({
			templateId: template.id,
			templateName: template.name,
			event,
		})),
	);
}

export function buildLinkedPathOptions(
	linkedPaths: WorkbenchLinkedPath[],
): { value: string; label: string }[] {
	return linkedPaths.map((entry) => ({
		value: entry.id,
		label: `${entry.label} (${entry.status})`,
	}));
}

export function buildDatasetOutputFolderOptions(
	linkedPaths: WorkbenchLinkedPath[],
): { value: string; label: string }[] {
	return linkedPaths
		.filter((path) => path.kind === "directory")
		.map((path) => ({
			value: path.id,
			label: `${path.label} (${path.status})`,
		}));
}

export function findLinkedOutputFolder(
	linkedPaths: WorkbenchLinkedPath[],
	datasetBuildFolderLinkId: string | null,
): WorkbenchLinkedPath | null {
	return (
		linkedPaths.find(
			(path) =>
				path.id === datasetBuildFolderLinkId &&
				path.kind === "directory" &&
				path.status === "available",
		) ?? null
	);
}

export function buildDatasetFlowReadiness({
	selectedDatasetTemplate,
	selectedWorkloadProfile,
	remoteSources,
	datasetBuildFolderLinkId,
}: {
	selectedDatasetTemplate: WorkbenchDatasetTemplate | null;
	selectedWorkloadProfile: BenchmarkWorkloadProfile;
	remoteSources: WorkbenchRemoteSource[];
	datasetBuildFolderLinkId: string | null;
}): DatasetLaneReadiness[] {
	return [
		{
			id: "template",
			label: "Template selected",
			ready: Boolean(selectedDatasetTemplate),
		},
		{
			id: "steps",
			label: "0–5 step contract defined",
			ready:
				Boolean(selectedDatasetTemplate) &&
				(selectedDatasetTemplate?.steps.length ?? 0) <= 5,
		},
		{
			id: "cloud",
			label: "Cloud source requirement",
			ready: !selectedWorkloadProfile.requiresRemoteSource || remoteSources.length > 0,
		},
		{
			id: "folder",
			label: "Output path strategy",
			ready:
				Boolean(datasetBuildFolderLinkId) || !selectedWorkloadProfile.requiresRemoteSource,
		},
	];
}

export function getLatestDatasetBuildResult(
	datasetBuildResults: DatasetBuildResult[],
): DatasetBuildResult | null {
	return datasetBuildResults[0] ?? null;
}

export function buildDatasetCompareReadiness({
	latestDatasetBuildResult,
	connected,
	sessionClientAvailable,
	activeWorkbench,
	workbenchSnapshotAvailable,
}: {
	latestDatasetBuildResult: DatasetBuildResult | null;
	connected: boolean;
	sessionClientAvailable: boolean;
	activeWorkbench: WorkbenchDefinition | null;
	workbenchSnapshotAvailable: boolean;
}): DatasetLaneReadiness[] {
	return [
		{
			id: "bundle",
			label: "Benchmark bundle generated",
			ready: Boolean(latestDatasetBuildResult),
		},
		{
			id: "session",
			label: "Connected runtime session",
			ready: connected && sessionClientAvailable,
		},
		{
			id: "workbench",
			label: "Active workbench selected",
			ready: Boolean(activeWorkbench),
		},
		{
			id: "snapshot",
			label: "Governed snapshot available",
			ready: workbenchSnapshotAvailable,
		},
	];
}

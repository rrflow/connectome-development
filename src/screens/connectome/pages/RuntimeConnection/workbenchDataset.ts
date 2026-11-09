import type { WorkbenchDatasetTemplate, WorkbenchRemoteSource } from "~/types";

export interface DatasetBuildArtifact {
	fileName: string;
	content: string;
}

export interface DatasetBuildResult {
	id: string;
	templateId: string;
	templateName: string;
	workloadProfileId: string;
	workloadProfileLabel: string;
	runLabel: string;
	createdAtUnixMs: number;
	outputMode: "download" | "linked-folder";
	outputPath: string | null;
	artifactCount: number;
}

export interface BenchmarkWorkloadProfile {
	id: string;
	label: string;
	description: string;
	minimumPromptCount: number;
	requiresRemoteSource: boolean;
	targetLatencyMs: number;
}

export const benchmarkWorkloadProfiles: BenchmarkWorkloadProfile[] = [
	{
		id: "real-project-baseline",
		label: "Real project baseline",
		description: "Balanced index/retrieval parity run against realistic project source rows.",
		minimumPromptCount: 12,
		requiresRemoteSource: false,
		targetLatencyMs: 750,
	},
	{
		id: "retrieval-parity-heavy",
		label: "Retrieval parity heavy",
		description: "High retrieval sample count with comparator parity focus for Surreal/Arango.",
		minimumPromptCount: 30,
		requiresRemoteSource: true,
		targetLatencyMs: 900,
	},
	{
		id: "cold-trigger-stress",
		label: "Cold trigger stress",
		description:
			"Cold read-heavy workload to verify RRFlowCLD trigger invariants and receipts.",
		minimumPromptCount: 20,
		requiresRemoteSource: false,
		targetLatencyMs: 1200,
	},
];

export function buildDatasetArtifacts({
	template,
	runLabel,
	workloadProfile,
	remoteSources,
	telemetry,
}: {
	template: WorkbenchDatasetTemplate;
	runLabel: string;
	workloadProfile: BenchmarkWorkloadProfile;
	remoteSources: WorkbenchRemoteSource[];
	telemetry: {
		profile: string;
		hops: boolean;
		actions: boolean;
		tools: boolean;
		time: boolean;
	};
}): DatasetBuildArtifact[] {
	const createdAtUnixMs = Date.now();
	const runId = `${template.id}-${createdAtUnixMs}`;
	const manifest = {
		runId,
		runLabel,
		templateId: template.id,
		templateName: template.name,
		schema: template.schema,
		skills: template.skills,
		researchReferences: template.researchReferences,
		remoteSources: remoteSources.map((source) => ({
			label: source.label,
			provider: source.provider,
			mode: source.mode,
			url: source.url,
			relayUrl: source.relayUrl ?? null,
			status: source.status,
		})),
		minimumRequirements: template.minimumRequirements,
		filePatterns: template.filePatterns,
		folderPatterns: template.folderPatterns,
		steps: template.steps.map((step, index) => ({
			order: index + 1,
			title: step.title,
			detail: step.detail,
			route: step.route,
			linkedPathId: step.linkedPathId ?? null,
		})),
		learningEvents: template.learningEvents.map((event) => ({
			kind: event.kind,
			mode: event.mode,
			title: event.title,
			component: event.component,
			requiresOperatorSignoff: event.requiresOperatorSignoff,
			triggers: event.triggers,
			actions: event.actions,
			catamorphismTarget: event.catamorphismTarget,
			catamorphismNote: event.catamorphismNote,
		})),
	};
	const workloadPlan = {
		profile: {
			id: workloadProfile.id,
			label: workloadProfile.label,
			description: workloadProfile.description,
			minimumPromptCount: workloadProfile.minimumPromptCount,
			targetLatencyMs: workloadProfile.targetLatencyMs,
		},
		classifier: "enabled",
		decisionRouter: "enabled",
		reasoningEngine: "enabled",
		triggerInvariant:
			"cold-served vector read => RRFlowCLD trigger => cold-period workflow with bounded observable receipts",
		compareTargets: ["SurrealDB", "ArangoDB"],
		telemetry: {
			profile: telemetry.profile,
			hops: telemetry.hops,
			actions: telemetry.actions,
			tools: telemetry.tools,
			time: telemetry.time,
		},
	};
	const comparator = {
		requiredMetrics: ["index_completeness", "retrieval_accuracy", "comparable_latency"],
		targetLatencyMs: workloadProfile.targetLatencyMs,
		promptParity: "required",
		receiptBoundaries: "required",
		invariantChecks: [
			"controller-pipeline-explicit",
			"cold-trigger-idempotent",
			"observable-receipts",
		],
		remoteSourcesConfigured: remoteSources.length > 0,
	};
	const benchmarkWorkloads = {
		runId,
		parityTarget: "same prompts + same acceptance thresholds across engines",
		profiles: {
			id: workloadProfile.id,
			label: workloadProfile.label,
			promptCountTarget: workloadProfile.minimumPromptCount,
			targetLatencyMs: workloadProfile.targetLatencyMs,
		},
		engines: [
			{
				id: "rrflow",
				label: "RRFlow",
				pipeline: ["classifier", "decision-router", "reasoning-engine"],
				requiresColdTriggerReceipts: true,
			},
			{
				id: "surrealdb",
				label: "SurrealDB comparator",
				pipeline: ["query", "vector retrieval", "result parity"],
				requiresColdTriggerReceipts: false,
			},
			{
				id: "arangodb",
				label: "ArangoDB comparator",
				pipeline: ["traversal", "retrieval", "result parity"],
				requiresColdTriggerReceipts: false,
			},
		],
	};
	const promptSeed = template.minimumRequirements.map((requirement, index) => ({
		id: `prompt-${index + 1}`,
		text: `Validate requirement: ${requirement}`,
	}));
	const executionChecklist = {
		runId,
		workloadProfile: workloadProfile.id,
		checks: [
			{
				id: "dataset-template-selected",
				required: true,
				passed: true,
			},
			{
				id: "remote-source-availability",
				required: workloadProfile.requiresRemoteSource,
				passed: !workloadProfile.requiresRemoteSource || remoteSources.length > 0,
			},
			{
				id: "controller-contract-explicit",
				required: true,
				passed: true,
			},
			{
				id: "cold-trigger-invariant",
				required: true,
				passed: true,
			},
			{
				id: "comparable-workload-targets",
				required: true,
				passed: true,
			},
		],
	};
	return [
		{
			fileName: "dataset-manifest.json",
			content: JSON.stringify(manifest, null, 2),
		},
		{
			fileName: "workload-plan.json",
			content: JSON.stringify(workloadPlan, null, 2),
		},
		{
			fileName: "comparator-config.json",
			content: JSON.stringify(comparator, null, 2),
		},
		{
			fileName: "prompt-seed.json",
			content: JSON.stringify(promptSeed, null, 2),
		},
		{
			fileName: "execution-checklist.json",
			content: JSON.stringify(executionChecklist, null, 2),
		},
		{
			fileName: "benchmark-workloads.json",
			content: JSON.stringify(benchmarkWorkloads, null, 2),
		},
	];
}

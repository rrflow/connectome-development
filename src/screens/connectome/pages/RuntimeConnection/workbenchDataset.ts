import type { WorkbenchDatasetTemplate, WorkbenchRemoteSource } from "~/types";

export interface DatasetBuildArtifact {
	fileName: string;
	content: string;
}

/**
 * A check in the execution checklist carries the fact that decided it.
 * Connectome can only settle configuration facts it holds; invariant and
 * parity checks are decided by the engine workbench run and its receipts, so
 * they leave here as not evaluated. A "passed" without evidence is not
 * representable.
 */
export type ExecutionCheckStatus =
	| { kind: "satisfied"; evidence: string }
	| { kind: "unsatisfied"; reason: string }
	| { kind: "not-evaluated"; evaluator: "engine-workbench-run" };

export interface ExecutionCheck {
	id: string;
	required: boolean;
	status: ExecutionCheckStatus;
}

export function evaluateExecutionChecks({
	template,
	workloadProfile,
	remoteSources,
}: {
	template: WorkbenchDatasetTemplate;
	workloadProfile: BenchmarkWorkloadProfile;
	remoteSources: WorkbenchRemoteSource[];
}): ExecutionCheck[] {
	const configuredSources = remoteSources.filter(
		(source) => source.status === "configured",
	).length;
	const remoteSourceStatus: ExecutionCheckStatus = !workloadProfile.requiresRemoteSource
		? {
				kind: "satisfied",
				evidence: `workload profile ${workloadProfile.id} does not require a remote source`,
			}
		: configuredSources > 0
			? {
					kind: "satisfied",
					evidence: `${configuredSources} configured remote source(s) of ${remoteSources.length}`,
				}
			: {
					kind: "unsatisfied",
					reason: `workload profile ${workloadProfile.id} requires a configured remote source; ${remoteSources.length} listed, none configured`,
				};
	const engineDecides: ExecutionCheckStatus = {
		kind: "not-evaluated",
		evaluator: "engine-workbench-run",
	};
	return [
		{
			id: "dataset-template-selected",
			required: true,
			status: {
				kind: "satisfied",
				evidence: `template ${template.id} (${template.name}) with ${template.minimumRequirements.length} minimum requirement(s)`,
			},
		},
		{
			id: "remote-source-availability",
			required: workloadProfile.requiresRemoteSource,
			status: remoteSourceStatus,
		},
		{ id: "controller-contract-explicit", required: true, status: engineDecides },
		{ id: "cold-trigger-invariant", required: true, status: engineDecides },
		{ id: "comparable-workload-targets", required: true, status: engineDecides },
	];
}

export function countUnsatisfiedRequiredChecks(checks: ExecutionCheck[]): number {
	return checks.filter((check) => check.required && check.status.kind === "unsatisfied").length;
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
		description: "High retrieval sample count with configured-backend parity focus.",
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
		compareTargets: ["configured-reference", "configured-candidate"],
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
				id: "configured-reference",
				label: "Configured reference comparator",
				pipeline: ["query", "vector retrieval", "result parity"],
				requiresColdTriggerReceipts: false,
			},
			{
				id: "configured-candidate",
				label: "Configured candidate comparator",
				pipeline: ["traversal", "retrieval", "result parity"],
				requiresColdTriggerReceipts: false,
			},
		],
	};
	const promptSeed = template.minimumRequirements.map((requirement, index) => ({
		id: `prompt-${index + 1}`,
		text: `Validate requirement: ${requirement}`,
	}));
	const checks = evaluateExecutionChecks({ template, workloadProfile, remoteSources });
	const executionChecklist = {
		runId,
		workloadProfile: workloadProfile.id,
		evaluation:
			"Connectome records the configuration facts it holds. Invariant and parity checks are decided by the engine workbench run and its receipts; they are not evaluated here.",
		unsatisfiedRequiredChecks: countUnsatisfiedRequiredChecks(checks),
		checks,
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

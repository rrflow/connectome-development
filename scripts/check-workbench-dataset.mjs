import assert from "node:assert/strict";
import {
	benchmarkWorkloadProfiles,
	buildDatasetArtifacts,
} from "../src/features/runtime/workbench/datasets/dataset.ts";

const template = {
	id: "project",
	name: "Project",
	schema: "source",
	skills: [],
	researchReferences: [],
	minimumRequirements: ["retrieve the indexed source"],
	filePatterns: ["src/**"],
	folderPatterns: ["src"],
	steps: [],
	learningEvents: [
		{
			kind: "factoid",
			mode: "passive",
			title: "A saved observation",
			body: "Preserve the authored learning content.",
			component: "card",
			requiresOperatorSignoff: false,
			triggers: [],
			actions: [],
			catamorphismTarget: "clyffy",
			catamorphismNote: "",
		},
	],
};
const remoteSource = {
	label: "Unverified source",
	provider: "google-drive",
	mode: "import",
	url: "https://example.invalid",
	status: "needs-auth",
};
const telemetry = { profile: "baseline", hops: true, actions: true, tools: true, time: true };
const expectedFiles = [
	"benchmark-workloads.json",
	"comparator-config.json",
	"dataset-manifest.json",
	"execution-checklist.json",
	"prompt-seed.json",
	"workload-plan.json",
];

for (const [profile, remoteSources] of [
	[benchmarkWorkloadProfiles[0], []],
	[benchmarkWorkloadProfiles[1], []],
	[benchmarkWorkloadProfiles[1], [remoteSource]],
]) {
	const artifacts = buildDatasetArtifacts({
		template,
		runLabel: "baseline",
		workloadProfile: profile,
		remoteSources,
		telemetry,
	});
	assert.deepEqual(artifacts.map((artifact) => artifact.fileName).sort(), expectedFiles);
	const parse = (name) => {
		const artifact = artifacts.find((item) => item.fileName === name);
		assert.ok(artifact, `missing ${name}`);
		return JSON.parse(artifact.content);
	};
	const plan = parse("workload-plan.json");
	const manifest = parse("dataset-manifest.json");
	assert.equal(manifest.runLabel, "baseline");
	assert.equal(manifest.templateId, template.id);
	assert.deepEqual(manifest.skills, template.skills);
	assert.deepEqual(manifest.researchReferences, template.researchReferences);
	assert.deepEqual(manifest.minimumRequirements, template.minimumRequirements);
	assert.deepEqual(manifest.filePatterns, template.filePatterns);
	assert.deepEqual(manifest.folderPatterns, template.folderPatterns);
	assert.deepEqual(manifest.learningEvents, template.learningEvents);
	assert.equal(manifest.remoteSources.length, remoteSources.length);
	assert.equal(plan.classifier, "planned");
	assert.equal(plan.decisionRouter, "planned");
	assert.equal(plan.reasoningEngine, "planned");
	assert.equal(plan.profile.id, profile.id);
	assert.deepEqual(plan.telemetry, telemetry);
	const comparator = parse("comparator-config.json");
	assert.deepEqual(comparator.requiredMetrics, [
		"index_completeness",
		"retrieval_accuracy",
		"comparable_latency",
	]);
	assert.equal(comparator.remoteSourcesConfigured, remoteSources.length > 0);
	assert.deepEqual(parse("prompt-seed.json"), [
		{ id: "prompt-1", text: "Validate requirement: retrieve the indexed source" },
	]);
	const workloads = parse("benchmark-workloads.json");
	assert.equal(workloads.profiles.id, profile.id);
	assert.deepEqual(
		workloads.engines.map((engine) => engine.id),
		["rrflow", "configured-reference", "configured-candidate"],
	);
	const checklist = parse("execution-checklist.json");
	const checks = Object.fromEntries(checklist.checks.map((check) => [check.id, check]));
	assert.equal(checks["dataset-template-selected"].status.kind, "satisfied");
	assert.ok(checks["dataset-template-selected"].status.evidence.includes(template.id));
	// A source that still needs authorization is not a configured source.
	assert.equal(
		checks["remote-source-availability"].status.kind,
		profile.requiresRemoteSource ? "unsatisfied" : "satisfied",
	);
	assert.equal(checks["remote-source-availability"].required, profile.requiresRemoteSource);
	for (const id of [
		"controller-contract-explicit",
		"cold-trigger-invariant",
		"comparable-workload-targets",
	]) {
		assert.deepEqual(
			checks[id].status,
			{ kind: "not-evaluated", evaluator: "engine-workbench-run" },
			`${id} is decided by the engine run, not by this plan`,
		);
	}
	assert.equal(checklist.unsatisfiedRequiredChecks, profile.requiresRemoteSource ? 1 : 0);
	assert.ok(checklist.checks.every((check) => !("passed" in check)));
}

console.log("Workbench dataset plans do not claim unverified execution.");

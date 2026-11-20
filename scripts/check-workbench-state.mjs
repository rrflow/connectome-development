/**
 * Checks the workbench profile's pure state: what a connection keeps, the
 * template file a person exports, and what an import accepts
 * (`src/features/runtime/workbench/lanes/workbench-state.ts`).
 *
 *   node --experimental-strip-types scripts/check-workbench-state.mjs
 *
 * Import validation and lossless copying are checked by
 * test-template-interchange.mjs. This file holds profile defaults and the
 * concurrency/no-write boundary after asynchronous file reading.
 */
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { finishTemplateImport, normalizeWorkbench } = await import(
	`file://${join(root, "src/features/runtime/workbench/lanes/workbench-state.ts").replaceAll("\\", "/")}`
);

const { buildTemplateExport } = await import(
	`file://${join(root, "src/features/runtime/workbench/templates/template-interchange.ts").replaceAll("\\", "/")}`
);

let checks = 0;
const check = (name, run) => {
	try {
		run();
	} catch (error) {
		throw new Error(`${name}: ${error.message}`, { cause: error });
	}
	checks += 1;
};
const counter = () => {
	let next = 0;
	return () => `id-${++next}`;
};

check("an absent profile is an empty one", () => {
	assert.deepEqual(normalizeWorkbench(undefined, counter()), {
		workbenches: [],
		activeWorkbenchId: undefined,
		receipts: [],
		templates: [],
		linkedPaths: [],
		remoteSources: [],
	});
});

check("normalising does not change what it was given and returns a new object", () => {
	const given = {
		workbenches: [{ id: "local" }],
		activeWorkbenchId: "local",
		receipts: [{ id: "note" }],
		templates: [{ id: "t", skills: ["rust"], researchReferences: [], learningEvents: [] }],
		linkedPaths: [{ id: "path" }],
		remoteSources: [{ id: "source" }],
	};
	const before = structuredClone(given);
	const result = normalizeWorkbench(given, counter());
	assert.deepEqual(given, before);
	assert.deepEqual(result, before);
	assert.notEqual(result, given);
});

check("a template saved without lists, and an event without a decision, are filled", () => {
	const given = {
		workbenches: [],
		receipts: [],
		templates: [
			{
				id: "old",
				learningEvents: [
					{ id: "interactive", mode: "interactive" },
					{ id: "passive", mode: "passive" },
					{
						id: "set",
						mode: "passive",
						requiresOperatorSignoff: true,
						triggers: [],
						actions: [],
					},
				],
			},
			{ id: "older" },
		],
	};
	const before = structuredClone(given);
	const result = normalizeWorkbench(given, () => "manual-trigger");
	assert.deepEqual(given, before);
	const [old, older] = result.templates;
	assert.deepEqual(old.skills, []);
	assert.deepEqual(old.researchReferences, []);
	assert.deepEqual(old.learningEvents[0], {
		id: "interactive",
		mode: "interactive",
		requiresOperatorSignoff: true,
		triggers: [
			{ id: "manual-trigger", kind: "manual", description: "Run on operator command." },
		],
		actions: [],
	});
	assert.equal(old.learningEvents[1].requiresOperatorSignoff, false);
	assert.deepEqual(old.learningEvents[2], before.templates[0].learningEvents[2]);
	assert.deepEqual(older.learningEvents, []);
});

const template = {
	id: "authored-template",
	name: "Authored",
	description: " Keep ",
	schema: "source",
	skills: ["Rust", " Go "],
	researchReferences: ["docs/reference"],
	minimumRequirements: ["grounded result"],
	filePatterns: ["src/**"],
	folderPatterns: ["src"],
	createdAtUnixMs: 42,
	updatedAtUnixMs: 43,
	steps: [],
	learningEvents: [],
};

check("an export names its version and time and carries every template", () => {
	const templates = [{ id: "a" }, { id: "b" }];
	assert.deepEqual(buildTemplateExport(templates, 100), {
		version: 1,
		exportedAtUnixMs: 100,
		templates,
	});
});

check("an import goes in front of what the connection holds when the file has been read", () => {
	// Reading the file takes time: one template was added and one removed meanwhile.
	const latest = normalizeWorkbench(
		{ templates: [{ ...template, id: "added-meanwhile", name: "Added meanwhile" }] },
		counter(),
	);
	const outcome = finishTemplateImport(
		buildTemplateExport([template], 100),
		latest,
		true,
		counter(),
	);
	assert.deepEqual(
		outcome.templates.map((entry) => entry.name),
		[template.name, "Added meanwhile"],
	);
});

check("an import whose workbench is gone writes nothing", () => {
	const latest = normalizeWorkbench({ templates: [] }, counter());
	for (const outcome of [
		finishTemplateImport(buildTemplateExport([template], 100), latest, false, counter()),
		finishTemplateImport(buildTemplateExport([template], 100), null, true, counter()),
	]) {
		assert.deepEqual(outcome, { error: "Workbench context changed; import stopped." });
	}
});

check("a rejected file changes no current templates", () => {
	const latest = normalizeWorkbench({ templates: [template] }, counter());
	const before = structuredClone(latest);
	for (const templates of [[], [template, { name: "broken" }]]) {
		const result = finishTemplateImport(
			buildTemplateExport(templates, 100),
			latest,
			true,
			counter(),
		);
		assert.match(result.error, /^Invalid or unsupported template export:/);
		assert.equal("templates" in result, false);
		assert.deepEqual(latest, before);
	}
});

console.log(`Workbench state holds: ${checks} checks.`);

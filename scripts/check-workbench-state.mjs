/**
 * Checks the workbench profile's pure state: what a connection keeps, the
 * template file a person exports, and what an import accepts
 * (`src/features/runtime/workbench/lanes/workbench-state.ts`).
 *
 *   node --experimental-strip-types scripts/check-workbench-state.mjs
 *
 * The import contract here is the one `main` documents: an import is
 * sanitised, not copied. A linked path the destination does not have is
 * dropped, ids are minted by the caller, a template without a name is skipped,
 * and at most five steps are kept.
 */
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { buildTemplateExport, normalizeWorkbench, parseTemplateImport } = await import(
	`file://${join(root, "src/features/runtime/workbench/lanes/workbench-state.ts").replaceAll("\\", "/")}`
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
		triggers: [{ id: "manual-trigger", kind: "manual", description: "Run on operator command." }],
		actions: [],
	});
	assert.equal(old.learningEvents[1].requiresOperatorSignoff, false);
	assert.deepEqual(old.learningEvents[2], before.templates[0].learningEvents[2]);
	assert.deepEqual(older.learningEvents, []);
});

const template = {
	name: "  Authored  ",
	description: " Keep ",
	schema: "source",
	skills: ["Rust", 5, " Go "],
	researchReferences: ["docs/reference"],
	minimumRequirements: ["grounded result"],
	filePatterns: ["src/**"],
	folderPatterns: ["src"],
	createdAtUnixMs: 42,
	steps: [
		{ title: "Inspect", detail: " Read ", route: "knowledge/records", linkedPathId: "have" },
		{ title: " ", route: " ", linkedPathId: "absent" },
	],
	learningEvents: [
		{
			kind: "knowledge-drop",
			mode: "interactive",
			title: "Example",
			body: " Body ",
			component: "alert",
			route: "knowledge/records",
			triggers: [{ kind: "cold-signal", description: " Cold " }, { kind: "made-up" }],
			actions: [],
			catamorphismTarget: "clyffy",
		},
	],
};

check("an export names its version and time and carries every template", () => {
	const templates = [{ id: "a" }, { id: "b" }];
	assert.deepEqual(buildTemplateExport(templates, 100), {
		version: 1,
		exportedAtUnixMs: 100,
		templates,
	});
});

check("an import trims, keeps the destination's own linked paths and mints every id", () => {
	const linked = [{ id: "have" }];
	const [imported, ...rest] = parseTemplateImport({ templates: [template] }, linked, counter());
	assert.equal(rest.length, 0);
	assert.equal(imported.name, "Authored");
	assert.equal(imported.description, "Keep");
	assert.deepEqual(imported.skills, ["Rust", "Go"]);
	assert.equal(imported.createdAtUnixMs, 42);
	assert.ok(imported.updatedAtUnixMs >= imported.createdAtUnixMs);
	assert.match(imported.id, /^id-\d+$/);
	assert.equal(imported.steps[0].linkedPathId, "have");
	assert.equal(imported.steps[0].detail, "Read");
	assert.equal(imported.steps[1].linkedPathId, undefined);
	assert.equal(imported.steps[1].title, "Step 2");
	assert.equal(imported.steps[1].route, "reasoning/workbench");
	const [event] = imported.learningEvents;
	assert.equal(event.kind, "knowledge-drop");
	assert.equal(event.body, "Body");
	assert.equal(event.requiresOperatorSignoff, true);
	assert.deepEqual(
		event.triggers.map((trigger) => trigger.kind),
		["cold-signal", "manual"],
	);
	const ids = [imported.id, ...imported.steps.map((s) => s.id), event.id];
	assert.equal(new Set(ids).size, ids.length);
});

check("an import never changes the file it read", () => {
	const given = { templates: [structuredClone(template)] };
	const before = structuredClone(given);
	parseTemplateImport(given, [], counter());
	assert.deepEqual(given, before);
});

check("an import keeps at most five steps and skips a template with no name", () => {
	const six = { ...template, steps: Array.from({ length: 6 }, (_, i) => ({ title: `s${i}` })) };
	const result = parseTemplateImport(
		{ templates: [six, { description: "no name" }, null, "text"] },
		[],
		counter(),
	);
	assert.equal(result.length, 1);
	assert.equal(result[0].steps.length, 5);
});

check("a file that is not a template export imports nothing", () => {
	for (const value of [null, undefined, 5, "x", {}, { templates: "no" }, { templates: [] }]) {
		assert.deepEqual(parseTemplateImport(value, [], counter()), []);
	}
});

console.log(`Workbench state holds: ${checks} checks.`);

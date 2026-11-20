import assert from "node:assert/strict";
import {
	buildTemplateExport,
	parseTemplateImport,
} from "../src/features/runtime/workbench/templates/template-interchange.ts";

const templates = [
	{
		id: "template",
		name: "Authored template",
		description: "Keep exact values",
		schema: "source",
		skills: ["Rust"],
		researchReferences: ["docs/reference"],
		minimumRequirements: ["grounded result"],
		filePatterns: ["src/**"],
		folderPatterns: ["src"],
		createdAtUnixMs: 42,
		updatedAtUnixMs: 43,
		customTemplateData: { nested: true },
		steps: [
			{
				id: "step",
				title: "Inspect",
				detail: "Preserve content",
				route: "workbench",
				linkedPathId: "not-in-destination",
				customStepData: 2,
			},
		],
		learningEvents: [
			{
				id: "event",
				kind: "factoid",
				mode: "interactive",
				title: "Example",
				body: "Do not drop this",
				component: "card",
				route: "workbench",
				requiresOperatorSignoff: true,
				catamorphismTarget: "clyffy",
				catamorphismNote: "Note",
				triggers: [{ id: "trigger", kind: "manual", description: "Manual" }],
				actions: [
					{ id: "action", name: "navigate-route", label: "Open", payload: "workbench" },
				],
			},
		],
	},
];
const snapshot = structuredClone(templates);
const exported = buildTemplateExport(templates, 100);
assert.deepEqual(exported, { version: 1, exportedAtUnixMs: 100, templates });
let next = 0;
const [imported] = parseTemplateImport(exported, () => `new-${++next}`);
assert.deepEqual(templates, snapshot);
assert.deepEqual(imported, {
	...snapshot[0],
	id: "new-1",
	steps: [{ ...snapshot[0].steps[0], id: "new-2" }],
	learningEvents: [
		{
			...snapshot[0].learningEvents[0],
			id: "new-3",
			triggers: [{ ...snapshot[0].learningEvents[0].triggers[0], id: "new-4" }],
			actions: [{ ...snapshot[0].learningEvents[0].actions[0], id: "new-5" }],
		},
	],
});
assert.equal(imported.steps[0].linkedPathId, "not-in-destination");
const { skills: _skills, ...missingSkills } = snapshot[0];
const { researchReferences: _references, ...missingReferences } = snapshot[0];
for (const invalid of [
	null,
	{},
	{ version: 2, exportedAtUnixMs: 100, templates },
	{ version: 1, exportedAtUnixMs: 100, templates: [] },
	{ version: 1, exportedAtUnixMs: 100, templates: [templates[0], { name: "broken" }] },
	{ version: 1, exportedAtUnixMs: 100, templates: [missingSkills] },
	{ version: 1, exportedAtUnixMs: 100, templates: [missingReferences] },
	{
		version: 1,
		exportedAtUnixMs: 100,
		templates: [{ ...templates[0], skills: "not-an-array" }],
	},
	{
		version: 1,
		exportedAtUnixMs: 100,
		templates: [{ ...templates[0], researchReferences: ["valid", 5] }],
	},
	{
		version: 1,
		exportedAtUnixMs: 100,
		templates: [{ ...templates[0], steps: Array(6).fill(templates[0].steps[0]) }],
	},
	{
		version: 1,
		exportedAtUnixMs: 100,
		templates: [
			{
				...templates[0],
				learningEvents: [
					{
						...templates[0].learningEvents[0],
						actions: [
							{
								...templates[0].learningEvents[0].actions[0],
								name: "unknown-effect",
							},
						],
					},
				],
			},
		],
	},
]) {
	let allocated = 0;
	assert.throws(() => parseTemplateImport(invalid, () => `invalid-${++allocated}`));
	assert.equal(allocated, 0, "a rejected batch must not allocate identities");
}
imported.customTemplateData.nested = false;
assert.deepEqual(templates, snapshot, "imported opaque data must not alias the input");
console.log("Template interchange preserves authored content and rejects invalid imports.");

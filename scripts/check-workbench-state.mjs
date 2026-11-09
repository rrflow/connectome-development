import assert from "node:assert/strict";
import { normalizeWorkbenchState } from "../src/screens/connectome/pages/RuntimeConnection/workbenchState.ts";

const newId = () => "manual-trigger";
assert.deepEqual(normalizeWorkbenchState(undefined, newId), {
	workbenches: [],
	receipts: [],
	templates: [],
	linkedPaths: [],
	remoteSources: [],
});

const legacy = {
	workbenches: [{ id: "local" }],
	activeWorkbenchId: "local",
	receipts: [{ id: "note" }],
};
const before = structuredClone(legacy);
const normalized = normalizeWorkbenchState(legacy, newId);
assert.deepEqual(legacy, before);
assert.deepEqual(normalized, {
	...before,
	templates: [],
	linkedPaths: [],
	remoteSources: [],
});

const populated = {
	...before,
	templates: [{ id: "template", skills: ["rust"], researchReferences: [], learningEvents: [] }],
	linkedPaths: [{ id: "path" }],
	remoteSources: [{ id: "source" }],
};
assert.deepEqual(normalizeWorkbenchState(populated, newId), populated);
assert.notEqual(normalizeWorkbenchState(populated, newId), populated);

const legacyTemplates = {
	...legacy,
	templates: [
		{
			id: "old",
			learningEvents: [
				{ id: "interactive", mode: "interactive" },
				{ id: "passive-default", mode: "passive" },
				{
					id: "passive",
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
const templatesBefore = structuredClone(legacyTemplates);
const migrated = normalizeWorkbenchState(legacyTemplates, newId);
assert.deepEqual(legacyTemplates, templatesBefore);
assert.deepEqual(migrated.templates[0].skills, []);
assert.deepEqual(migrated.templates[0].researchReferences, []);
assert.deepEqual(migrated.templates[0].learningEvents[0], {
	id: "interactive",
	mode: "interactive",
	requiresOperatorSignoff: true,
	triggers: [{ id: "manual-trigger", kind: "manual", description: "Run on operator command." }],
	actions: [],
});
assert.equal(migrated.templates[0].learningEvents[1].requiresOperatorSignoff, false);
assert.deepEqual(
	migrated.templates[0].learningEvents[2],
	templatesBefore.templates[0].learningEvents[2],
);
assert.deepEqual(migrated.templates[1].learningEvents, []);

console.log("Workbench profile normalization preserves legacy and populated data.");

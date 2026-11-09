import * as v from "valibot";
import type { WorkbenchDatasetTemplate } from "~/types";

const action = v.looseObject({
	id: v.string(),
	name: v.picklist([
		"navigate-route",
		"refresh-storage-signals",
		"refresh-governed-flights",
		"open-workbench",
		"capture-runtime-receipt",
	]),
	label: v.string(),
	payload: v.optional(v.string()),
});
const trigger = v.looseObject({
	id: v.string(),
	kind: v.picklist([
		"manual",
		"cold-signal",
		"linked-path-missing",
		"governed-flights-available",
	]),
	description: v.string(),
});
const event = v.looseObject({
	id: v.string(),
	kind: v.picklist(["did-you-know", "knowledge-drop", "factoid"]),
	mode: v.picklist(["passive", "interactive"]),
	title: v.string(),
	body: v.string(),
	component: v.picklist(["card", "alert", "badge"]),
	route: v.optional(v.string()),
	requiresOperatorSignoff: v.boolean(),
	triggers: v.array(trigger),
	actions: v.array(action),
	catamorphismTarget: v.string(),
	catamorphismNote: v.string(),
});
const step = v.looseObject({
	id: v.string(),
	title: v.string(),
	detail: v.string(),
	route: v.string(),
	linkedPathId: v.optional(v.string()),
});
const template = v.looseObject({
	id: v.string(),
	name: v.pipe(v.string(), v.nonEmpty()),
	description: v.string(),
	schema: v.string(),
	skills: v.array(v.string()),
	researchReferences: v.array(v.string()),
	minimumRequirements: v.array(v.string()),
	filePatterns: v.array(v.string()),
	folderPatterns: v.array(v.string()),
	createdAtUnixMs: v.number(),
	updatedAtUnixMs: v.number(),
	steps: v.pipe(v.array(step), v.maxLength(5)),
	learningEvents: v.array(event),
});
const payload = v.looseObject({
	version: v.literal(1),
	exportedAtUnixMs: v.number(),
	templates: v.pipe(v.array(template), v.minLength(1)),
});

export function exportWorkbenchTemplates(templates: WorkbenchDatasetTemplate[], now: number) {
	return { version: 1 as const, exportedAtUnixMs: now, templates };
}

export function importWorkbenchTemplates(
	input: unknown,
	newId: () => string,
): WorkbenchDatasetTemplate[] {
	const result = v.safeParse(payload, input);
	if (!result.success) {
		throw new Error(`Invalid or unsupported template export: ${result.issues[0].message}`);
	}
	return result.output.templates.map((entry) => ({
		...entry,
		id: newId(),
		steps: entry.steps.map((item) => ({ ...item, id: newId() })),
		learningEvents: entry.learningEvents.map((item) => ({
			...item,
			id: newId(),
			triggers: item.triggers.map((value) => ({ ...value, id: newId() })),
			actions: item.actions.map((value) => ({ ...value, id: newId() })),
		})),
	}));
}

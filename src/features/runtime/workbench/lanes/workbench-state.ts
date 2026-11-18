import type {
	ConnectionWorkbenchState,
	WorkbenchDatasetTemplate,
	WorkbenchLearningAction,
	WorkbenchLearningEvent,
	WorkbenchLearningTrigger,
	WorkbenchLinkedPath,
	WorkbenchTemplateStep,
} from "~/shared/types";

/**
 * What a workbench profile keeps, read and written without a screen: the
 * state a connection saves, the template file a person exports and imports,
 * and the defaults those fill. Ids come from the caller, so the same input
 * gives the same result under test.
 */
export type NewId = () => string;

export const TEMPLATE_EXPORT_VERSION = 1;

export interface TemplateExportPayload {
	version: number;
	exportedAtUnixMs: number;
	templates: WorkbenchDatasetTemplate[];
}

export function manualTrigger(newId: NewId): WorkbenchLearningTrigger {
	return { id: newId(), kind: "manual", description: "Run on operator command." };
}

export function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry: unknown): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseLearningEvents(value: unknown, newId: NewId): WorkbenchLearningEvent[] {
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
	newId: NewId,
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
			learningEvents: parseLearningEvents(template.learningEvents, newId),
		});
	}
	return imported;
}

/** Fills the fields a connection saved before these lanes existed. */
export function normalizeWorkbench(
	state: ConnectionWorkbenchState | undefined,
	newId: NewId,
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
			triggers: event.triggers ?? [manualTrigger(newId)],
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

/** The file a person exports: every template, with its version and time. */
export function buildTemplateExport(
	templates: WorkbenchDatasetTemplate[],
	exportedAtUnixMs: number,
): TemplateExportPayload {
	return { version: TEMPLATE_EXPORT_VERSION, exportedAtUnixMs, templates };
}

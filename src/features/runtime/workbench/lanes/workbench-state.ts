import type {
	ConnectionWorkbenchState,
	WorkbenchDatasetTemplate,
	WorkbenchLearningTrigger,
} from "~/shared/types";
import { parseTemplateImport } from "../templates/template-interchange.ts";

/**
 * What a workbench profile keeps, read and written without a screen: the
 * state a connection saves, the template file a person exports and imports,
 * and the defaults those fill. Ids come from the caller, so the same input
 * gives the same result under test.
 */
export type NewId = () => string;

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

export type TemplateImportOutcome = { templates: WorkbenchDatasetTemplate[] } | { error: string };

/**
 * What an import does once its file has been read. Reading takes time, so
 * the workbench is looked at again now: `latest` is what the connection
 * holds at this moment, and `current` says whether the person is still in
 * the workbench the import was started in. An import whose workbench is
 * gone writes nothing, and the imported templates go in front of the ones
 * the connection has now, not the ones it had when the import began.
 */
export function finishTemplateImport(
	parsed: unknown,
	latest: ConnectionWorkbenchState | null,
	current: boolean,
	newId: NewId,
): TemplateImportOutcome {
	if (!current || !latest) {
		return { error: "Workbench context changed; import stopped." };
	}
	try {
		const imported = parseTemplateImport(parsed, newId);
		return { templates: [...imported, ...latest.templates] };
	} catch (error) {
		return {
			error:
				error instanceof Error ? error.message : "Invalid or unsupported template export.",
		};
	}
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

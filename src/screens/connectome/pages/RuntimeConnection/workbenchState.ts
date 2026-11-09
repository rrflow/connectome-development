import type { ConnectionWorkbenchState } from "~/types";

export function normalizeWorkbenchState(
	state: ConnectionWorkbenchState | undefined,
	newId: () => string,
): ConnectionWorkbenchState {
	return {
		...state,
		workbenches: state?.workbenches ?? [],
		receipts: state?.receipts ?? [],
		templates: (state?.templates ?? []).map((template) => ({
			...template,
			skills: template.skills ?? [],
			researchReferences: template.researchReferences ?? [],
			learningEvents: (template.learningEvents ?? []).map((event) => ({
				...event,
				requiresOperatorSignoff:
					typeof event.requiresOperatorSignoff === "boolean"
						? event.requiresOperatorSignoff
						: event.mode === "interactive",
				triggers: event.triggers ?? [
					{ id: newId(), kind: "manual", description: "Run on operator command." },
				],
				actions: event.actions ?? [],
			})),
		})),
		linkedPaths: state?.linkedPaths ?? [],
		remoteSources: state?.remoteSources ?? [],
	};
}

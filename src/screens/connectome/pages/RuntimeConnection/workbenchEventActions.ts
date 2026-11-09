import type { WorkbenchLearningAction } from "~/types";

export interface WorkbenchEventActionContext {
	resolveRoute: (route: string) => string | undefined;
	canReadEngine: boolean;
	canCapture: boolean;
	isCurrent: () => boolean;
	openRoute: (route: string) => void;
	refreshStorage: () => Promise<void>;
	refreshFlights: () => Promise<void>;
	captureDiagnostics: () => Promise<void>;
}

export async function runWorkbenchEventActions(
	actions: WorkbenchLearningAction[],
	context: WorkbenchEventActionContext,
): Promise<void> {
	if (actions.length === 0) throw new Error("The event has no actions.");
	const planned = actions.map((action, index) => {
		switch (action.name) {
			case "navigate-route":
			case "open-workbench": {
				const requested =
					action.name === "open-workbench"
						? "reasoning/workbench"
						: action.payload?.trim() || "reasoning/workbench";
				const route = context.resolveRoute(requested);
				if (!route) throw new Error(`Route unavailable: ${requested}`);
				if (index !== actions.length - 1)
					throw new Error("Navigation must be the final event action.");
				return () => context.openRoute(route);
			}
			case "refresh-storage-signals":
				if (!context.canReadEngine) throw new Error("A connected engine is required.");
				return () => context.refreshStorage();
			case "refresh-governed-flights":
				if (!context.canReadEngine) throw new Error("A connected engine is required.");
				return () => context.refreshFlights();
			case "capture-runtime-receipt":
				if (!context.canReadEngine || !context.canCapture)
					throw new Error("A connected engine and local workbench are required.");
				return () => context.captureDiagnostics();
			default: {
				const unsupported: never = action.name;
				throw new Error(`Unsupported event action: ${unsupported}`);
			}
		}
	});
	for (const execute of planned) {
		if (!context.isCurrent()) throw new Error("Workbench context changed; event stopped.");
		await execute();
		if (!context.isCurrent()) throw new Error("Workbench context changed; event stopped.");
	}
}

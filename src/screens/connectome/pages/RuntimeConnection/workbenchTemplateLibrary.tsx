import { Alert, Stack } from "@mantine/core";
import { useMemo, useState } from "react";
import { newId } from "~/shared/util/helpers";
import { useConfigStore } from "~/shell/stores/config";
import type { WorkbenchLearningEvent, WorkbenchLearningTrigger } from "~/types";
import { WORKSPACE_AREAS } from "./areas";
import { normalizeWorkbenchState } from "./workbenchState";
import { WorkbenchTemplateLibraryPanel } from "./workbenchTemplateLibraryPanel";

const routes = new Set(WORKSPACE_AREAS.flatMap((area) => area.tabs.map((tab) => tab.route)));
const legacyRoutes = new Map([
	["workbench", "reasoning/workbench"],
	["knowledge/storage", "system/storage"],
]);

export function resolveTemplateRoute(route: string): string | undefined {
	if (routes.has(route)) return route;
	return legacyRoutes.get(route);
}

export function WorkbenchTemplateLibrary({
	connectionId,
	onOpenRoute,
	eventExecutionError = null,
	onRunLearningEvent,
	runningEventIds = [],
	isTriggerActive,
}: {
	connectionId: string;
	onOpenRoute: (route: string) => void;
	eventExecutionError?: string | null;
	onRunLearningEvent?: (templateId: string, event: WorkbenchLearningEvent) => void;
	runningEventIds?: string[];
	isTriggerActive?: (trigger: WorkbenchLearningTrigger) => boolean;
}) {
	const local = useConfigStore(
		(state) =>
			state.connections.find((connection) => connection.id === connectionId)?.workbench,
	);
	const profile = useMemo(() => normalizeWorkbenchState(local, newId), [local]);
	const [error, setError] = useState<string | null>(null);

	const removeTemplate = (templateId: string) => {
		const store = useConfigStore.getState();
		const connection = store.connections.find((candidate) => candidate.id === connectionId);
		if (!connection?.workbench) {
			setError("Project profile is no longer available.");
			return;
		}
		const current = normalizeWorkbenchState(connection.workbench, newId);
		if (!current.templates.some((template) => template.id === templateId)) {
			setError("The template is no longer available.");
			return;
		}
		store.updateConnection({
			id: connectionId,
			workbench: {
				...current,
				templates: current.templates.filter((template) => template.id !== templateId),
			},
		});
		setError(null);
	};

	return (
		<Stack>
			{error && (
				<Alert
					color="red"
					title="Template library error"
				>
					{error}
				</Alert>
			)}
			<WorkbenchTemplateLibraryPanel
				eventExecutionError={eventExecutionError}
				templates={profile.templates}
				linkedPaths={profile.linkedPaths}
				onRemoveTemplate={removeTemplate}
				canOpenRoute={(route) => resolveTemplateRoute(route) !== undefined}
				onOpenRoute={(route) => {
					const resolved = resolveTemplateRoute(route);
					if (resolved) onOpenRoute(resolved);
					else setError(`Template route is unavailable: ${route}`);
				}}
				onRunLearningEvent={onRunLearningEvent}
				isTriggerActive={isTriggerActive}
				runningEventIds={runningEventIds}
			/>
		</Stack>
	);
}

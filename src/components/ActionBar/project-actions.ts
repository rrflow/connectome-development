import type { QueryClient } from "@tanstack/react-query";
import { adapter } from "~/adapter";
import { connectionProject } from "~/rrflow/instances";
import { rowControls } from "~/rrflow/project-manager";
import { describeRrdError } from "~/rrflow/runtime";
import { RrdSessionClient, sessionQueryKey } from "~/rrflow/session";
import { persistCurrentConfig } from "~/shared/util/config/config";
import { useConfigStore } from "~/shell/stores/config";
import { useDatabaseStore } from "~/stores/database";

/** The query every screen that lists project instances shares. */
export const INSTANCES_QUERY_KEY = ["project-instances"] as const;

/** The saved connections that open `project`. */
export function projectConnections(project: string) {
	return useConfigStore
		.getState()
		.connections.filter((connection) => connectionProject(connection) === project);
}

/** Closes every native session that reaches `project`, before its engine goes away. */
export async function disconnectProject(project: string, queryClient: QueryClient) {
	for (const profile of projectConnections(project)) {
		await new RrdSessionClient(profile.id).disconnect();
		queryClient.setQueryData(sessionQueryKey(profile.id), null);
	}
}

/**
 * Removes a project from Connectome, the one way it is removed anywhere in
 * the app. Its sessions are closed, the engine Connectome started for it is
 * stopped (an instance started elsewhere keeps running), and its saved
 * connections leave the list and the saved configuration. Nothing in the
 * project's folder is deleted.
 *
 * A project that is starting or stopping is refused before anything is done,
 * with the reason its row shows. If the native side refuses after that, the
 * project stays listed and its sessions reconnect when it is next opened. If
 * the removal cannot be saved, its connections are put back so it stays
 * listed with that error; its engine has already been stopped by then, and
 * the error says so.
 */
export async function removeProject(project: string, queryClient: QueryClient) {
	const instance = useDatabaseStore.getState().instances[project];
	const blocked = instance && rowControls(instance, undefined, false).removeBlocked;
	if (blocked) throw new Error(blocked);
	// A session is closed through its engine, so before the engine is stopped.
	await disconnectProject(project, queryClient);
	const stopped = await adapter.forgetProject(project);
	const { connections, removeConnection, setConnections } = useConfigStore.getState();
	for (const connection of projectConnections(project)) {
		removeConnection(connection.id);
	}
	try {
		await persistCurrentConfig();
	} catch (cause) {
		setConnections(connections);
		throw new Error(
			`${stopped ? "Its engine was stopped, but the" : "The"} removal could not be saved, so the project is still listed: ${describeRrdError(cause)}`,
		);
	} finally {
		await queryClient.invalidateQueries({ queryKey: INSTANCES_QUERY_KEY });
	}
}

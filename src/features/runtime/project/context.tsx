import type { UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { RrdHandshake } from "~/rrflow/runtime";
import type { RrdConnectionView, RrdSessionClient } from "~/rrflow/session";
import type { Connection } from "~/shared/types";
import type { RuntimeLens } from "../types";

/**
 * Everything a project view needs, read once by the project layout from the
 * engine that serves this project. Views never open their own session.
 */
export interface ProjectContextValue {
	id: string;
	connection: Connection;
	endpoint: string;
	handshake: RrdHandshake | undefined;
	handshakeQuery: UseQueryResult<RrdHandshake>;
	/** The native session this window owns for this project's engine, if any. */
	session: RrdConnectionView | null;
	/** A session this window holds for a different engine or instance. */
	foreign: RrdConnectionView | null;
	/** Whether the native session lookup has answered yet. */
	sessionReady: boolean;
	client: RrdSessionClient;
	/** Changes whenever the session does, so cached reads never cross sessions. */
	sessionKey: string;
	selected: string | null;
	onSelect: (record: string | null) => void;
	colorBy: string;
	onColorBy: (key: string) => void;
	/** Opens another view of this project by its path under the project. */
	open: (path: string) => void;
	openLens: (lens: RuntimeLens) => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
	const value = useContext(ProjectContext);
	if (!value) {
		throw new Error("a project view was rendered outside the project layout");
	}
	return value;
}

/** The props the knowledge lenses share. */
export function useLensProps() {
	const project = useProject();
	return {
		client: project.client,
		sessionKey: project.sessionKey,
		selected: project.selected,
		onSelect: project.onSelect,
		colorBy: project.colorBy,
		onColorBy: project.onColorBy,
		onOpenLens: project.openLens,
	};
}

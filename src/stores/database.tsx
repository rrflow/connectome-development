import { omit } from "radash";
import { create } from "zustand";
import type { GraphqlResponse } from "~/connection/connection";
import { applyInstance, applyStatus, firstServed, type InstanceMap } from "~/rrflow/instances";
import type {
	ConnectionSchema,
	EngramStage,
	InstanceStatus,
	ProjectInstance,
	QueryResponse,
	ServedEngram,
} from "~/shared/types";
import { createConnectionSchema } from "~/shared/util/config/defaults";
import type { Diagnostic } from "~/vendor/rrflow-client";

export type State = "disconnected" | "connecting" | "retrying" | "connected";
export type DiagnosticWithTime = Diagnostic & { timestamp: number };

export type DatabaseStore = {
	isServing: boolean;
	servePending: boolean;
	/** The engram the native process is serving; null while nothing is served. */
	servedEngram: ServedEngram | null;
	/** Each project's instance, as the native registry last numbered it. */
	instances: InstanceMap;
	/** The serve sequence's boundaries, oldest first, cleared on each start. */
	engramStages: EngramStage[];
	currentState: State;
	latestError: string;
	isSyncingSchema: boolean;
	isQueryActive: boolean;
	isGraphqlQueryActive: boolean;
	consoleOutput: string[];
	connectionSchema: ConnectionSchema;
	version: string;
	queryResponses: Record<string, QueryResponse[]>;
	graphqlResponse: Record<string, GraphqlResponse>;
	diagnostics: DiagnosticWithTime[];

	setQueryActive: (isQueryActive: boolean) => void;
	setGraphqlQueryActive: (isQueryActive: boolean) => void;
	clearSchema: () => void;
	prepareServe: () => void;
	confirmServing: (engram: ServedEngram) => void;
	stopServing: () => void;
	applyInstance: (instance: ProjectInstance) => void;
	applyStatus: (status: InstanceStatus) => void;
	cancelServe: () => void;
	pushStage: (stage: EngramStage) => void;
	pushConsoleLine: (line: string, max: number) => void;
	clearConsole: () => void;
	setIsSyncingSchema: (isSyncingSchema: boolean) => void;
	setDatabaseSchema: (databaseSchema: ConnectionSchema) => void;
	setCurrentState: (currentState: State) => void;
	setLatestError: (latestError: string) => void;
	setVersion: (version: string) => void;
	setQueryResponse: (tab: string, response: QueryResponse[]) => void;
	clearQueryResponse: (tab: string) => void;
	setGraphqlResponse: (connection: string, response: GraphqlResponse) => void;
	clearGraphqlResponse: (connection: string) => void;
	pushDiagnostic: (diagnostic: Diagnostic, max: number) => void;
};

export const useDatabaseStore = create<DatabaseStore>((set) => ({
	isServing: false,
	servePending: false,
	servedEngram: null,
	instances: {},
	engramStages: [],
	currentState: "disconnected",
	latestError: "",
	isSyncingSchema: false,
	isQueryActive: false,
	isGraphqlQueryActive: false,
	consoleOutput: [],
	connectionSchema: createConnectionSchema(),
	version: "",
	queryResponses: {},
	graphqlResponse: {},
	diagnostics: [],

	setQueryActive: (isQueryActive) =>
		set(() => ({
			isQueryActive,
		})),

	setGraphqlQueryActive: (isGraphqlQueryActive) =>
		set(() => ({
			isGraphqlQueryActive,
		})),

	clearSchema: () =>
		set(() => ({
			connectionSchema: createConnectionSchema(),
		})),

	prepareServe: () =>
		set(() => ({
			servePending: true,
			consoleOutput: [],
			engramStages: [],
		})),

	confirmServing: (servedEngram) =>
		set(() => ({
			isServing: true,
			servePending: false,
			servedEngram,
		})),

	stopServing: () =>
		set(() => ({
			isServing: false,
			servePending: false,
			servedEngram: null,
		})),

	applyInstance: (instance) =>
		set((state) => {
			const instances = applyInstance(state.instances, instance);
			const servedEngram = firstServed(instances);
			return { instances, servedEngram, isServing: servedEngram !== null };
		}),

	applyStatus: (status) =>
		set((state) => {
			const instances = applyStatus(state.instances, status);
			const servedEngram = firstServed(instances);
			return { instances, servedEngram, isServing: servedEngram !== null };
		}),

	pushStage: (stage) =>
		set((state) => ({
			engramStages: [...state.engramStages, stage].slice(-128),
		})),

	cancelServe: () =>
		set(() => ({
			servePending: true,
		})),

	pushConsoleLine: (line, max) =>
		set((state) => ({
			consoleOutput: [...state.consoleOutput, line].slice(-max),
		})),

	clearConsole: () =>
		set(() => ({
			consoleOutput: [],
		})),

	setIsSyncingSchema: (isSyncingSchema) =>
		set(() => ({
			isSyncingSchema,
		})),

	setDatabaseSchema: (databaseSchema) =>
		set(() => ({
			connectionSchema: databaseSchema,
		})),

	setCurrentState: (currentState) =>
		set(() => ({
			currentState,
		})),

	setLatestError: (latestError) =>
		set(() => ({
			latestError,
		})),

	setVersion: (version) =>
		set(() => ({
			version,
		})),

	setQueryResponse: (tab, response) =>
		set((state) => ({
			queryResponses: {
				...state.queryResponses,
				[tab]: response,
			},
		})),

	clearQueryResponse: (tab) =>
		set((state) => ({
			queryResponses: omit(state.queryResponses, [tab]),
		})),

	setGraphqlResponse: (connection, response) =>
		set((state) => ({
			graphqlResponse: {
				...state.graphqlResponse,
				[connection]: response,
			},
		})),

	clearGraphqlResponse: (connection) =>
		set((state) => ({
			graphqlResponse: omit(state.graphqlResponse, [connection]),
		})),

	pushDiagnostic: (diagnostic, max) =>
		set((state) => ({
			diagnostics: [...state.diagnostics, { ...diagnostic, timestamp: Date.now() }].slice(
				-max,
			),
		})),
}));

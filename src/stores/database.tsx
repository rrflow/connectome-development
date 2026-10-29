import { omit } from "radash";
import { create } from "zustand";
import { applyInstance, applyStatus, firstServed, type InstanceMap } from "~/rrflow/instances";
import type { GraphqlResponse } from "~/screens/connectome/connection/connection";
import { createConnectionSchema } from "~/shared/util/defaults";
import type {
	ConnectionSchema,
	EstateStage,
	InstanceStatus,
	ProjectInstance,
	QueryResponse,
	ServedEstate,
} from "~/types";
import type { Diagnostic } from "~/vendor/rrflow-client";

export type State = "disconnected" | "connecting" | "retrying" | "connected";
export type DiagnosticWithTime = Diagnostic & { timestamp: number };

export type DatabaseStore = {
	isServing: boolean;
	servePending: boolean;
	/** The estate the native process is serving; null while nothing is served. */
	servedEstate: ServedEstate | null;
	/** Each project's instance, as the native registry last numbered it. */
	instances: InstanceMap;
	/** The serve sequence's boundaries, oldest first, cleared on each start. */
	estateStages: EstateStage[];
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
	confirmServing: (estate: ServedEstate) => void;
	stopServing: () => void;
	applyInstance: (instance: ProjectInstance) => void;
	applyStatus: (status: InstanceStatus) => void;
	cancelServe: () => void;
	pushStage: (stage: EstateStage) => void;
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
	servedEstate: null,
	instances: {},
	estateStages: [],
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
			estateStages: [],
		})),

	confirmServing: (servedEstate) =>
		set(() => ({
			isServing: true,
			servePending: false,
			servedEstate,
		})),

	stopServing: () =>
		set(() => ({
			isServing: false,
			servePending: false,
			servedEstate: null,
		})),

	applyInstance: (instance) =>
		set((state) => {
			const instances = applyInstance(state.instances, instance);
			const servedEstate = firstServed(instances);
			return { instances, servedEstate, isServing: servedEstate !== null };
		}),

	applyStatus: (status) =>
		set((state) => {
			const instances = applyStatus(state.instances, status);
			const servedEstate = firstServed(instances);
			return { instances, servedEstate, isServing: servedEstate !== null };
		}),

	pushStage: (stage) =>
		set((state) => ({
			estateStages: [...state.estateStages, stage].slice(-128),
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

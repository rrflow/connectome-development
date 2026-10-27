import { compareVersions } from "compare-versions";
import { adapter } from "~/adapter";
import { MAX_HISTORY_QUERY_LENGTH, SANDBOX } from "~/constants";
import { hasCompletedOnboarding } from "~/hooks/onboarding";
import { getSetting } from "~/shared/util/config";
import { getActiveConnection, getAuthDB, getAuthNS, getConnection } from "~/shared/util/connection";
import {
	RRFLOW_START_BASICS,
	RRFLOW_START_GRAPH_V2,
	RRFLOW_START_GRAPH_V3,
	RRFLOW_START_VECTOR_V2,
	RRFLOW_START_VECTOR_V3,
} from "~/shared/util/dataset";
import { createBaseQuery } from "~/shared/util/defaults";
import {
	ActivateDatabaseEvent,
	ConnectedEvent,
	DisconnectedEvent,
} from "~/shared/util/global-events";
import {
	__throw,
	connectionUri,
	exposeDebug,
	newId,
	showErrorNotification,
	showWarning,
} from "~/shared/util/helpers";
import { parseIdent } from "~/shared/util/language";
import { createRRFlowQL } from "~/shared/util/rrflowql";
import { RRFlowQL } from "~/shared/util/rrflowql/contract";
import { syncConnectionSchema } from "~/shared/util/schema";
import { useConfigStore } from "~/shell/stores/config";
import { useInterfaceStore } from "~/shell/stores/interface";
import { State, useDatabaseStore } from "~/stores/database";
import { useQueryStore } from "~/stores/query";
import type {
	Authentication,
	Connection,
	Protocol,
	QueryResponse,
	SchemaInfoKV,
	SchemaInfoNS,
} from "~/types";
import {
	type AccessRecordAuth,
	Features,
	ProvidedAuth,
	RRFlow,
	SqlExportOptions,
	SystemAuth,
	UnsupportedVersionError,
	Uuid,
} from "~/vendor/rrflow-client";
import { composeAuthentication, getVersionTimeout } from "./helpers";
import { createRRFlow } from "./rrflow";

export interface ConnectOptions {
	connection?: Connection;
	isRetry?: boolean;
}

export interface UserQueryOptions {
	override?: string;
}

export interface GraphqlResponse {
	success: boolean;
	result: any;
	errors?: any;
}

let openedConnection: Connection;
let instance = new RRFlow();
let rrflowql: RRFlowQL | null = null;

const LQ_SUPPORTED = new Set<Protocol>(["ws", "wss", "mem", "indxdb"]);
const LIVE_QUERIES = new Map<string, Set<Uuid>>();

/**
 * Open a new connection to the data
 *
 * @param options Connection options
 */
export async function openConnection(options?: ConnectOptions) {
	const params = new URLSearchParams(location.search);
	const currentConnection = getConnection();
	const hasCompletedSandboxOnboarding = hasCompletedOnboarding("sandbox");
	const connection = options?.connection || currentConnection;

	const { settings, updateConnection } = useConfigStore.getState();

	if (!connection) {
		throw new Error("No connection available");
	}

	const strictSandbox = getSetting("behavior", "strictSandbox");
	const newState = options?.isRetry ? "retrying" : "connecting";
	const rrflow = await createRRFlow();

	await _closeConnection(newState, false);

	instance = rrflow;
	openedConnection = connection;

	exposeDebug({ rrflow, rrflowql });

	const { setCurrentState, setVersion, setLatestError, clearSchema } =
		useDatabaseStore.getState();

	const rpcEndpoint = connectionUri(
		connection.authentication.protocol,
		connection.authentication.hostname,
	);

	clearSchema();

	adapter.log("DB", `Opening connection to ${rpcEndpoint}`);

	try {
		const [versionCheck] = getVersionTimeout();

		const namespace = getAuthNS(connection.authentication) || connection.lastNamespace;
		const database = getAuthDB(connection.authentication) || connection.lastDatabase;

		instance.subscribe("connecting", () => {
			setCurrentState("connecting");
		});

		instance.subscribe("reconnecting", () => {
			setCurrentState("retrying");
		});

		instance.subscribe("disconnected", () => {
			DisconnectedEvent.dispatch(null);

			setCurrentState("disconnected");
			setVersion("");
		});

		instance.subscribe("error", (err) => {
			setLatestError(err.message);
			console.error(err);
		});

		try {
			await instance.connect(rpcEndpoint, {
				versionCheck,
				reconnect: {
					enabled: true,
					attempts: -1,
					retryDelayMultiplier: 1.2,
					retryDelayJitter: 0,
				},
				authentication: async () => {
					const credentials = await composeAuthentication(connection.authentication);

					if (credentials) {
						return credentials as string | SystemAuth;
					}

					return null;
				},
			});
		} catch (err: any) {
			console.error("Connection failed", err);
		}

		adapter.log("DB", "Connection established");

		const v = await instance.version();
		const version = v.version.replace(/^rrflow-/, "");
		const isPreview = version.includes("-alpha") || version.includes("-beta");

		if (isPreview) {
			showWarning({
				autoClose: 10_000,
				title: "Preview version detected",
				subtitle:
					"You are connected to a preview version of RRFlow. Some features may not work as intended.",
			});
		}

		adapter.log("DB", `Database version ${version ?? "unknown"}`);

		rrflowql = createRRFlowQL(version);

		setVersion(version);
		setCurrentState("connected");
		setLatestError("");

		if (connection.id === SANDBOX) {
			await instance.use({
				namespace: "sandbox",
				database: "sandbox",
			});

			await instance.query(`
				DEFINE NAMESPACE OVERWRITE sandbox;
				DEFINE DATABASE OVERWRITE sandbox ${strictSandbox ? "STRICT" : ""};
			`);

			if (!hasCompletedSandboxOnboarding && adapter.isSampleSandboxEnabled) {
				const queries = [RRFLOW_START_BASICS];

				const canUse30Queries = compareVersions(version, "3.0.0") >= 0;

				if (canUse30Queries) {
					queries.push(RRFLOW_START_GRAPH_V3);
					queries.push(RRFLOW_START_VECTOR_V3);
				} else {
					queries.push(RRFLOW_START_GRAPH_V2);
					queries.push(RRFLOW_START_VECTOR_V2);
				}

				const configs = queries.map((query) => ({
					...createBaseQuery(settings, "config"),
					name: query.name,
					query: query.query,
				}));

				// Clear empty queries and existing sample queries
				const existingQueries = connection.queries.filter(
					(it) =>
						it.query.length > 0 &&
						![
							RRFLOW_START_BASICS.name,
							RRFLOW_START_GRAPH_V2.name,
							RRFLOW_START_GRAPH_V3.name,
							RRFLOW_START_VECTOR_V2.name,
							RRFLOW_START_VECTOR_V3.name,
						].includes(it.name ?? ""),
				);

				updateConnection({
					id: connection.id,
					activeQuery: configs[0].id,
					queries: [...configs, ...existingQueries],
				});

				params.delete("queries");
			}
		} else {
			await activateDatabase(namespace, database);
		}

		ConnectedEvent.dispatch(null);
	} catch (err: any) {
		console.error("Connection failed", err);
		instance.close();

		setLatestError(err.message);

		if (err instanceof UnsupportedVersionError) {
			showErrorNotification({
				title: "Unsupported version",
				content: `The database version (${err.version}) must satisfy ">= ${err.minimum} < ${err.maximum}"`,
			});
		} else {
			console.error(err);
			showErrorNotification({
				title: "Connection failed",
				content: err,
			});
		}
	}
}

async function _closeConnection(state: State, reconnect: boolean) {
	const { setCurrentState, setVersion } = useDatabaseStore.getState();

	await instance.close();

	setCurrentState(state);
	setVersion("");

	if (reconnect) {
		await openConnection();
	}
}

/**
 * Close the active rrflow connection
 */
export async function closeConnection(reconnect: boolean = false) {
	await _closeConnection(reconnect ? "retrying" : "disconnected", reconnect);
}

/**
 * Returns whether the connection is considered active
 */
export function isConnected() {
	return instance.status === "connected" || instance.status === "connecting";
}

/**
 * Register a new record access user
 *
 * @param auth The authentication details
 * @param rrflow The optional rrflow instance
 */
export async function register(auth: AccessRecordAuth, rrflow?: RRFlow) {
	const db = rrflow ?? instance;

	await db.signup(auth).catch(() => {
		throw new Error("Could not sign up");
	});
}

/**
 * Authenticate the connection
 *
 * @param auth The authentication details
 * @param rrflow The optional rrflow instance
 */
export async function authenticate(auth: ProvidedAuth, rrflow?: RRFlow) {
	const db = rrflow ?? instance;

	if (auth === undefined) {
		await db.invalidate();
	} else if (typeof auth === "string") {
		await db.authenticate(auth).catch(() => {
			throw new Error("Authentication token invalid");
		});
	} else if (auth) {
		await db.signin(auth).catch((err) => {
			const { openAccessSignup } = useInterfaceStore.getState();

			if (err.message.includes("No record was returned")) {
				openAccessSignup();
			} else {
				throw new Error(err.message);
			}
		});
	}
}

/**
 * Execute a query against the active connection
 */
export async function executeQuery(
	query: string,
	bindings?: Record<string, unknown>,
): Promise<QueryResponse[]> {
	try {
		const results: QueryResponse[] = [];
		const queryResponses: Map<number, any> = new Map();
		const stream = instance.query(query, bindings).stream();

		for await (const frame of stream) {
			if (frame.isValue<any>()) {
				if (frame.isSingle) {
					queryResponses.set(frame.query, frame.value);
				} else {
					let queryResults = queryResponses.get(frame.query);

					if (!queryResults) {
						queryResults = [];
						queryResponses.set(frame.query, queryResults);
					}

					queryResults.push(frame.value);
				}
			} else if (frame.isDone()) {
				const result = queryResponses.has(frame.query)
					? queryResponses.get(frame.query)
					: [];

				results.push({
					success: true,
					duration: frame.stats?.duration,
					type: frame.type,
					result,
				});
			} else if (frame.isError()) {
				results.push({
					success: false,
					result: frame.error.message,
					duration: frame.stats?.duration,
				});
			}
		}

		return results;
	} catch (err: any) {
		return [
			{
				success: false,
				result: typeof err === "string" ? err : err.message,
			},
		];
	}
}

/**
 * Execute a query against the active connection and
 * return the first response
 */
export async function executeQueryFirst(query: string, bindings?: Record<string, unknown>) {
	const results = await executeQuery(query, bindings);
	const { success, result } = results[0];

	if (success) {
		return result;
	}

	throw new Error(result);
}

/**
 * Execute a query against the active connection and
 * return the first record of the first response
 */
export async function executeQuerySingle<T = any>(
	query: string,
	bindings?: Record<string, unknown>,
): Promise<T> {
	const results = await executeQuery(query, bindings);
	const { success, result } = results[0];

	if (success) {
		return Array.isArray(result) ? result[0] : result;
	}

	throw new Error(result);
}

/**
 * Execute a query against the active connection
 *
 * @param options Query options
 */
export async function executeUserQuery(options?: UserQueryOptions) {
	const { setIsLive, pushLiveQueryMessage, clearLiveQueryMessages } =
		useInterfaceStore.getState();
	const { setQueryActive, currentState, setQueryResponse } = useDatabaseStore.getState();
	const { addHistoryEntry } = useConfigStore.getState();
	const connection = getConnection();

	if (!connection || currentState !== "connected") {
		showErrorNotification({
			title: "Failed to execute",
			content: "You must be connected to the remote instance",
		});
		return;
	}

	const tabQuery = connection.queries.find((q) => q.id === connection.activeQuery);

	if (!tabQuery) {
		return;
	}

	const { id, variables, name } = tabQuery;

	const queryValue = getQueryOr(id, options?.override);
	const query = (typeof queryValue === "string" ? queryValue : "").trim();

	if (query.length === 0) {
		return;
	}

	try {
		setQueryActive(true);

		let liveIndexes: number[];

		const variablesObject = await getRRFlowQL().parseValue<Record<string, unknown>>(variables);
		const response = await executeQuery(query, variablesObject);

		try {
			liveIndexes = await getRRFlowQL().getLiveQueries(query, response);
		} catch (err: any) {
			adapter.warn("DB", `Failed to parse live queries: ${err.message}`);
			liveIndexes = [];
		}

		if (liveIndexes.length > 0 && !LQ_SUPPORTED.has(connection.authentication.protocol)) {
			showErrorNotification({
				title: "Live queries unsupported",
				content:
					"Unfortunately live queries are not supported in the active connection protocol",
			});
		}

		const liveIds = liveIndexes.flatMap((idx) => {
			const res = response[idx];

			if (!res.success || !(res.result instanceof Uuid)) {
				return [];
			}

			return [res.result];
		});

		cancelLiveQueries(id);
		clearLiveQueryMessages(id);
		setIsLive(id, liveIds.length > 0);

		LIVE_QUERIES.set(id, new Set(liveIds));

		for (const queryId of liveIds) {
			const subscription = await instance.liveOf(queryId);

			subscription.subscribe(({ action, value }) => {
				pushLiveQueryMessage(id, {
					id: newId(),
					queryId: queryId.toString(),
					action,
					data: value,
					timestamp: Date.now(),
				});
			});
		}

		setQueryResponse(id, response);

		if (query.length <= MAX_HISTORY_QUERY_LENGTH) {
			addHistoryEntry(connection.id, {
				id: newId(),
				query: query,
				timestamp: Date.now(),
				origin: name,
			});
		}
	} catch (err: any) {
		showErrorNotification({
			title: "Failed to execute",
			content: err,
		});
	} finally {
		setQueryActive(false);
	}
}

function getQueryOr(id: string, override?: string) {
	if (override) {
		return override;
	}

	return useQueryStore.getState().queryState[id]?.doc ?? "";
}

function isGraphqlSupportedError(err: string) {
	return (
		err.includes("Method not found") ||
		err.includes("A GraphQL request was made, but GraphQL is not supported by the context")
	);
}

/**
 * Check whether the active connection supports GraphQL
 */
export async function checkGraphqlSupport() {
	try {
		const res = await sendGraphqlRequest("");
		const someError = res.errors?.some((err: any) => isGraphqlSupportedError(err.message));

		return !!res.errors && !someError;
	} catch (err: any) {
		return !isGraphqlSupportedError(err.message);
	}
}

/**
 * Send a raw GraphQL request to the active connection
 */
export async function sendGraphqlRequest(
	query: string,
	params?: Record<string, any>,
	operation?: string,
) {
	try {
		const start = performance.now();
		const connection = getConnection();

		const { currentState } = useDatabaseStore.getState();

		if (!connection || currentState !== "connected") {
			throw new Error("Not connected to an instance");
		}

		const { endpoint, headers } = composeHttpConnection(connection.authentication, "/graphql");

		const response = await fetch(endpoint, {
			headers,
			method: "POST",
			body: JSON.stringify({
				query,
				variables: params,
				operationName: operation,
			}),
		});

		const result: GraphqlResponse = await response.json();
		const end = performance.now();

		return {
			success: !!response.ok && !result.errors,
			result: result.result.data,
			errors: result.errors,
			execution_time: `${(end - start).toFixed(2)}ms`,
		};
	} catch (err: any) {
		return {
			success: false,
			result: null,
			errors: err.message,
			execution_time: "",
		};
	}
}

/**
 * Execute a GraphQL query against the active connection
 */
export async function executeGraphql(
	query: string,
	params?: Record<string, any>,
	operation?: string,
) {
	const { currentState, setGraphqlQueryActive, setGraphqlResponse } = useDatabaseStore.getState();
	const connection = getConnection();

	if (!connection || currentState !== "connected") {
		showErrorNotification({
			title: "Failed to execute",
			content: "You must be connected to the remote instance",
		});

		throw new Error("Not connected");
	}

	setGraphqlQueryActive(true);

	try {
		const response = await sendGraphqlRequest(query, params, operation);

		setGraphqlResponse(connection.id, response);
	} catch (err: any) {
		console.warn("executeGraphql fail", err);

		return {
			success: false,
			result: err.message,
		};
	} finally {
		setGraphqlQueryActive(false);
	}
}

/**
 * Cancel the active live queries for the given query ID
 */
export function cancelLiveQueries(tab: string) {
	const { setIsLive } = useInterfaceStore.getState();

	for (const id of LIVE_QUERIES.get(tab) || []) {
		instance.liveOf(id).then((live) => {
			live.kill();
		});
	}

	setIsLive(tab, false);
}

/**
 * Activate the given database within the specified namespace
 */
export async function activateDatabase(namespace: string, database: string) {
	const { updateConnection } = useConfigStore.getState();
	const { setIsSyncingSchema } = useDatabaseStore.getState();
	const connection = getActiveConnection();
	let invalidNS = false;

	if (!connection) {
		return;
	}

	setIsSyncingSchema(true);

	// Select a namespace only
	if (namespace) {
		const isValid = await isNamespaceValid(namespace);

		if (isValid) {
			updateConnection({
				id: connection,
				lastNamespace: namespace,
				lastDatabase: database,
			});

			await instance.use({
				namespace,
				database: null,
			});
		} else {
			invalidNS = true;

			updateConnection({
				id: connection,
				lastNamespace: "",
				lastDatabase: "",
			});
		}
	} else {
		updateConnection({
			id: connection,
			lastNamespace: "",
			lastDatabase: "",
		});
	}

	// Select a database
	if (!invalidNS && namespace && database) {
		const isValid = await isDatabaseValid(database);

		if (isValid) {
			updateConnection({
				id: connection,
				lastDatabase: database,
			});

			await instance.use({ database });
		} else {
			updateConnection({
				id: connection,
				lastDatabase: "",
			});
		}
	}

	// Select the default namespace and database
	if (invalidNS || !namespace) {
		console.log("Selecting default namespace and database");

		const { namespace, database } = await instance.use({});

		console.log("namespace", namespace);
		console.log("database", database);

		updateConnection({
			id: connection,
			lastNamespace: namespace,
			lastDatabase: database,
		});
	}

	try {
		ActivateDatabaseEvent.dispatch(null);

		await syncConnectionSchema({
			clearDatabase: true,
		});
	} catch (err: any) {
		showErrorNotification({
			title: "Failed to parse schema",
			content: err,
		});
	}
}

/**
 * Request a database export from the remote connection
 *
 * @param config The export configuration
 */
export async function requestDatabaseExport(config?: Partial<SqlExportOptions>): Promise<Response> {
	const { currentState, version } = useDatabaseStore.getState();
	const connection = getConnection();
	const useModern = compareVersions(version, "2.1.0");

	if (!connection || currentState !== "connected") {
		throw new Error("Not connected to an instance");
	}

	if (useModern) {
		if (instance.isFeatureSupported(Features.ExportImportRaw)) {
			return instance.export(config).raw();
		} else {
			return new Response(await instance.export(config));
		}
	}

	const { endpoint, headers } = composeHttpConnection(connection.authentication, "/export");

	return fetch(endpoint, {
		headers,
		method: "GET",
	});
}

export type StreamingSupport = "unsupported-browser" | "unsupported-engine" | "supported";

/**
 * Returns whether streaming imports or exports are supported
 */
export function isStreamingSupported() {
	const rrflow = getRRFlow();

	if (!("showSaveFilePicker" in window) || !("showOpenFilePicker" in window)) {
		return "unsupported-browser";
	}

	if (!rrflow.isConnected || !rrflow.isFeatureSupported(Features.ExportImportRaw)) {
		return "unsupported-engine";
	}

	return "supported";
}

/**
 * Reset the current connection, which includes re-connecting and resetting
 * any temporary state.
 */
export function resetConnection() {
	const { clearQueryResponse, clearGraphqlResponse } = useDatabaseStore.getState();
	const connection = getConnection();

	openConnection();

	if (connection) {
		for (const query of connection.queries) {
			clearQueryResponse(query.id);
		}

		clearGraphqlResponse(connection.id);
	}
}

/**
 * Compose HTTP authentication headers
 */
export function composeHttpConnection(
	authentication: Authentication,
	path: string,
	extraHeaders?: Record<string, string>,
) {
	const { protocol, hostname } = authentication;

	const isSecure = protocol === "https" || protocol === "wss";
	const endpoint = new URL(path, `${isSecure ? "https" : "http"}://${hostname}`).toString();

	const headers: Record<string, string> = {
		...extraHeaders,
		Authorization: `Bearer ${authentication.token}`,
	};

	if (authentication.namespace) {
		headers["RRFlow-NS"] = authentication.namespace;
	}

	if (authentication.database) {
		headers["RRFlow-DB"] = authentication.database;
	}

	return { endpoint, headers };
}

/**
 * The connection instance currently in use
 */
export function getOpenConnection() {
	return openedConnection;
}

/**
 * Get the rrflow instance
 */
export function getRRFlow() {
	return instance;
}

/**
 * Schedule a reconnect attempt
 */

async function isNamespaceValid(namespace: string) {
	try {
		const [result] = await instance.query("INFO FOR KV").collect<[SchemaInfoKV]>();
		const namespaces = Object.keys(result?.namespaces ?? {}).map((ns) => parseIdent(ns));

		return namespaces.includes(namespace);
	} catch {
		return true;
	}
}

async function isDatabaseValid(database: string) {
	try {
		const [result] = await instance.query("INFO FOR NS").collect<[SchemaInfoNS]>();
		const databases = Object.keys(result?.databases ?? {}).map((db) => parseIdent(db));

		return databases.includes(database);
	} catch {
		return true;
	}
}

export function hasRRFlowQL() {
	return rrflowql !== null;
}

export function getRRFlowQL() {
	return rrflowql ?? __throw("No RRFlowQL instance available");
}

/**
 * Attempt to parse the given string as a valid params object
 * while silently handling any errors
 *
 * It parses through the inherited client's value parser, so it lives with
 * that client rather than in the shared helpers the RRFlow pages load.
 *
 * @param paramString The string to parse
 * @returns The parsed params object
 */
export async function tryParseParams(paramString: string) {
	let params: any = {};

	try {
		const parsed = await getRRFlowQL().parseValue(paramString);

		if (typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new TypeError("Must be object");
		}

		params = parsed;
	} catch {
		adapter.warn("Params", "Invalid JSON in variables");
	}

	return params;
}

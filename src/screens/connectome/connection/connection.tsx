import { adapter } from "~/adapter";
import { MAX_HISTORY_QUERY_LENGTH } from "~/constants";
import { tagEvent } from "~/shared/util/analytics";
import { getConnection } from "~/shared/util/connection";
import { rrflowqlDurationToSeconds } from "~/shared/util/duration";
import { ConnectedEvent, DisconnectedEvent } from "~/shared/util/global-events";
import { __throw, exposeDebug, newId, showErrorNotification } from "~/shared/util/helpers";
import { createRRFlowQL } from "~/shared/util/rrflowql";
import type { RRFlowQL } from "~/shared/util/rrflowql/contract";
import { useConfigStore } from "~/shell/stores/config";
import { useInterfaceStore } from "~/shell/stores/interface";
import { type State, useDatabaseStore } from "~/stores/database";
import { useQueryStore } from "~/stores/query";
import type { Authentication, Connection, Protocol, QueryResponse } from "~/types";
import {
	type AccessRecordAuth,
	type ProvidedAuth,
	RRFlow,
	RRFlowCapabilityUnavailableError,
	type SqlExportOptions,
} from "../../../rrflow/client/native";
import { Uuid } from "../../../rrflow/client/values";
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

const LQ_SUPPORTED = new Set<Protocol>();
const LIVE_QUERIES = new Map<string, Set<Uuid>>();

/**
 * Open a new connection to the data
 *
 * @param options Connection options
 */
export async function openConnection(options?: ConnectOptions) {
	const connection = options?.connection || getConnection();
	if (!connection) throw new Error("No connection available");
	const { setCurrentState, setVersion, setLatestError, clearSchema } =
		useDatabaseStore.getState();
	const rrflow = await createRRFlow();
	await _closeConnection(options?.isRetry ? "retrying" : "connecting", false);
	instance = rrflow;
	openedConnection = connection;
	clearSchema();
	exposeDebug({ rrflow, rrflowql });
	instance.subscribe("connecting", () => setCurrentState("connecting"));
	instance.subscribe("disconnected", () => {
		setCurrentState("disconnected");
		setVersion("");
		DisconnectedEvent.dispatch(null);
	});
	instance.subscribe("error", (error) => setLatestError(error.message));
	try {
		const { protocol, hostname } = connection.authentication;
		if (protocol !== "http" && protocol !== "https") {
			throw new RRFlowCapabilityUnavailableError(
				"Connection transport",
				"select the RRD HTTP origin in the Runtime connection lens; embedded and database RPC engines are unavailable",
			);
		}
		await instance.connect(`${protocol}://${hostname}`, {
			credentialPath: connection.runtimeCredential,
			expectedInstance: connection.runtimeInstance,
			sshHost: connection.runtimeSshHost,
		});
		const { version } = await instance.version();
		rrflowql = createRRFlowQL();
		setVersion(version);
		setCurrentState("connected");
		setLatestError("");
		adapter.log("RRD", "Authenticated native RRD session attached");
		ConnectedEvent.dispatch(null);
	} catch (cause) {
		await instance.close();
		const error = cause instanceof Error ? cause : new Error(String(cause));
		setLatestError(error.message);
		showErrorNotification({ title: "Connection failed", content: error.message });
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
	return instance.isConnected;
}

/**
 * Register a new record access user
 *
 * @param auth The authentication details
 * @param rrflow The optional rrflow instance
 */
export async function register(auth: AccessRecordAuth, rrflow?: RRFlow) {
	const db = rrflow ?? instance;

	await db.signup(auth);
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
		await db.authenticate(auth);
	} else if (auth) {
		await db.signin(auth).catch((err) => {
			const { openAccessSignup } = useInterfaceStore.getState();

			if (err.message.includes("No record was returned")) {
				openAccessSignup();
			} else {
				throw err;
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

		const compute_time = response
			.map(({ duration }) => (duration?.seconds ? Number(duration.seconds) : 0))
			.reduce((a, b) => a + b, 0);

		tagEvent("query_execute", {
			protocol: connection.authentication.protocol.toString(),
			type: "rrflowql",
			compute_time: compute_time,
		});

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

/** GraphQL needs a typed native operation before this view can execute it. */
export async function checkGraphqlSupport() {
	return false;
}

export async function sendGraphqlRequest(
	_query: string,
	_params?: Record<string, any>,
	_operation?: string,
): Promise<GraphqlResponse & { execution_time: string }> {
	return {
		success: false,
		result: null,
		errors: "GraphQL is unavailable: the native RRD adapter has no negotiated GraphQL operation",
		execution_time: "",
	};
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

		tagEvent("query_execute", {
			protocol: connection.authentication.protocol.toString(),
			type: "graphql",
			compute_time: rrflowqlDurationToSeconds(response.execution_time),
		});
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
export async function activateDatabase(_namespace: string, _database: string): Promise<never> {
	throw new RRFlowCapabilityUnavailableError(
		"Namespace/database selection",
		"an RRD session is bound to one exact project estate; use the Runtime instance connection",
	);
}

/** Preserves the export dialog while refusing an unnegotiated external effect. */
export async function requestDatabaseExport(
	_config?: Partial<SqlExportOptions>,
): Promise<Response> {
	throw new RRFlowCapabilityUnavailableError(
		"QL database export",
		"the native RRD adapter does not expose this export format; no HTTP fallback was sent",
	);
}

export type StreamingSupport = "unsupported-browser" | "unsupported-engine" | "supported";

/**
 * Returns whether streaming imports or exports are supported
 */
export function isStreamingSupported(): StreamingSupport {
	return "unsupported-engine";
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
	_authentication: Authentication,
	_path: string,
	_extraHeaders?: Record<string, string>,
): { endpoint: string; headers: Record<string, string> } {
	throw new RRFlowCapabilityUnavailableError(
		"Direct renderer HTTP effects",
		"this action requires an explicit typed operation through the native RRD session",
	);
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

export function hasRRFlowQL() {
	return rrflowql !== null;
}

export function getRRFlowQL() {
	return rrflowql ?? __throw("No RRFlowQL instance available");
}

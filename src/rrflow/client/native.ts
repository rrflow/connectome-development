import { RrdRuntimeClient } from "../runtime";
import { type RrdConnectionView, type RrdQueryView, RrdSessionClient } from "../session";
import { Duration, type RRFlowQueryIntent, type Uuid } from "./values";

export class RRFlowCapabilityUnavailableError extends Error {
	constructor(
		readonly capability: string,
		limitation: string,
	) {
		super(`${capability} is unavailable: ${limitation}`);
		this.name = "RRFlowCapabilityUnavailableError";
	}
}

export interface SystemAuth {
	username: string;
	password: string;
	namespace?: string;
	database?: string;
}
export interface AccessRecordAuth {
	namespace: string;
	database: string;
	access: string;
	variables: Record<string, unknown>;
}
/** Retained form inputs; these are never sent as an RRD authentication request. */
export type ProvidedAuth = string | SystemAuth | AccessRecordAuth | null | undefined;

/** Retained export-dialog intent. It is not an RRD export wire model. */
export interface SqlExportOptions {
	users: boolean;
	accesses: boolean;
	params: boolean;
	functions: boolean;
	analyzers: boolean;
	apis: boolean;
	buckets: boolean;
	modules: boolean;
	configs: boolean;
	records: boolean;
	sequences: boolean;
	tables: string[] | boolean;
	v3: boolean;
}

export type Diagnostic = {
	key: string;
	type: "open" | "close" | "version" | "query";
} & (
	| { phase: "before" }
	| { phase: "progress"; result: unknown }
	| { phase: "after"; duration: Duration; success: true; result: unknown }
	| { phase: "after"; duration: Duration; success: false; error: unknown }
);

type ClientEvent = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
type QueryStats = { duration?: Duration };

/** A presentation frame over one completed, bounded native query response. */
class QueryFrame {
	readonly query = 0;
	readonly isSingle = true;
	readonly type = "other" as const;
	readonly stats: QueryStats = {};
	readonly error = new Error("This frame contains a validated query result");
	constructor(
		readonly value: RrdQueryView,
		private readonly complete: boolean,
	) {}
	isValue<T>(): this is this & { value: T } {
		return !this.complete;
	}
	isDone() {
		return this.complete;
	}
	isError() {
		return false;
	}
}

/**
 * Connectome query presentation. `stream` iterates a completed native snapshot;
 * it does not claim WebSocket, live delivery, or engine-streaming support.
 */
class QueryResult implements PromiseLike<[RrdQueryView]> {
	private result: Promise<RrdQueryView> | undefined;
	constructor(private readonly execute: () => Promise<RrdQueryView>) {}
	private run() {
		if (!this.result) this.result = this.execute();
		return this.result;
	}
	collect<T = [RrdQueryView]>(): Promise<T> {
		return this.run().then((result) => [result] as T);
	}
	then<TResult1 = [RrdQueryView], TResult2 = never>(
		onfulfilled?: ((value: [RrdQueryView]) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): Promise<TResult1 | TResult2> {
		return this.collect().then(onfulfilled, onrejected);
	}
	async *stream() {
		const value = await this.run();
		yield new QueryFrame(value, false);
		yield new QueryFrame(value, true);
	}
}

interface ClientOptions {
	onDiagnostic?: (diagnostic: Diagnostic) => void;
}
interface ConnectOptions {
	credentialPath?: string;
	expectedInstance?: string;
	sshHost?: string;
}

/**
 * RRFlow's native-session boundary for existing Connectome feature consumers.
 * Transport, credential acquisition, authorization, and parsing stay in the
 * Rust SDK. This class neither speaks a database RPC protocol nor embeds one.
 */
export class RRFlow {
	private readonly native = new RrdSessionClient();
	private connection: RrdConnectionView | null = null;
	private readonly listeners = new Map<ClientEvent, Set<(error: Error) => void>>();
	private readonly diagnosticScope = crypto.randomUUID();
	private sequence = 0;
	status: "disconnected" | "connecting" | "connected" = "disconnected";
	constructor(private readonly options: ClientOptions = {}) {}
	get isConnected() {
		return this.status === "connected";
	}

	subscribe(event: ClientEvent, listener: (error: Error) => void) {
		const listeners = this.listeners.get(event) ?? new Set();
		listeners.add(listener);
		this.listeners.set(event, listeners);
		return () => listeners.delete(listener);
	}
	private emit(event: ClientEvent, error = new Error(event)) {
		for (const listener of this.listeners.get(event) ?? []) listener(error);
	}
	private async observe<T>(type: Diagnostic["type"], operation: () => Promise<T>): Promise<T> {
		const key = `connectome-${this.diagnosticScope}-${++this.sequence}`;
		const start = performance.now();
		this.options.onDiagnostic?.({ key, type, phase: "before" });
		try {
			const result = await operation();
			this.options.onDiagnostic?.({
				key,
				type,
				phase: "after",
				success: true,
				result,
				duration: new Duration(BigInt(Math.round((performance.now() - start) * 1_000_000))),
			});
			return result;
		} catch (error) {
			this.options.onDiagnostic?.({
				key,
				type,
				phase: "after",
				success: false,
				error: error instanceof Error ? error.message : String(error),
				duration: new Duration(BigInt(Math.round((performance.now() - start) * 1_000_000))),
			});
			throw error;
		}
	}

	async connect(endpoint: string, options: ConnectOptions = {}) {
		this.status = "connecting";
		this.emit("connecting");
		try {
			await this.observe("open", async () => {
				const origin = new URL(endpoint);
				if (
					!["http:", "https:"].includes(origin.protocol) ||
					origin.pathname !== "/" ||
					origin.search ||
					origin.hash ||
					origin.username ||
					origin.password
				) {
					throw new Error(
						"Use an explicit RRD HTTP origin; embedded and database RPC transports are unavailable",
					);
				}
				const handshake = await new RrdRuntimeClient(
					origin.origin,
					options.expectedInstance,
					options.sshHost,
				).handshake();
				const current = await this.native.current();
				if (
					current &&
					new URL(current.endpoint).origin === origin.origin &&
					current.instance === handshake.service.instance.id
				) {
					this.connection = current;
				} else {
					if (!options.credentialPath) {
						throw new Error(
							"Select the RRD operator credential in the Runtime connection lens before connecting",
						);
					}
					if (current)
						throw new Error(
							"Disconnect the current RRD instance before opening another",
						);
					this.connection = await this.native.connect({
						endpoint: origin.origin,
						instance: handshake.service.instance.id,
						credential_path: options.credentialPath,
					});
				}
				return this.connection;
			});
			this.status = "connected";
			this.emit("connected");
		} catch (cause) {
			this.connection = null;
			this.status = "disconnected";
			const error = cause instanceof Error ? cause : new Error(String(cause));
			this.emit("error", error);
			this.emit("disconnected");
			throw error;
		}
	}

	private async requireConnection() {
		if (!this.connection || !this.isConnected)
			throw new Error("No authenticated RRD session is attached");
		const current = await this.native.current();
		if (
			!current ||
			current.instance !== this.connection.instance ||
			current.endpoint !== this.connection.endpoint ||
			current.principal !== this.connection.principal
		) {
			this.connection = null;
			this.status = "disconnected";
			this.emit("disconnected");
			throw new Error(
				"The native RRD session closed or changed identity; reconnect explicitly",
			);
		}
		return current;
	}

	async version() {
		return this.observe("version", async () => {
			const connection = await this.requireConnection();
			const service = await this.native.capabilities();
			if (service.instance !== connection.instance) {
				throw new Error("The native RRD instance changed while reading its version");
			}
			return { version: service.implementation_version };
		});
	}

	query(query: string | RRFlowQueryIntent, bindings?: Record<string, unknown>) {
		return new QueryResult(() =>
			this.observe("query", async () => {
				const connection = await this.requireConnection();
				const intent =
					typeof query === "string" ? { text: query, bindings: bindings ?? {} } : query;
				if (
					Object.keys(intent.bindings).length ||
					(bindings && Object.keys(bindings).length)
				) {
					throw new RRFlowCapabilityUnavailableError(
						"Query bindings",
						"the native ExecuteQuery request currently accepts query text only; no values were interpolated or sent",
					);
				}
				return this.native.query(intent.text, connection.instance);
			}),
		);
	}

	/** Detaches this presentation client. The explicit Runtime disconnect owns the native session. */
	async close() {
		this.connection = null;
		this.status = "disconnected";
		this.emit("disconnected");
	}
	async signup(_auth: AccessRecordAuth): Promise<never> {
		throw new RRFlowCapabilityUnavailableError(
			"Record sign-up",
			"use the engine's installed credential/session flow",
		);
	}
	async signin(_auth: SystemAuth | AccessRecordAuth): Promise<never> {
		throw new RRFlowCapabilityUnavailableError(
			"Password sign-in",
			"the native process acquires an installed operator credential",
		);
	}
	async authenticate(_token: string): Promise<never> {
		throw new RRFlowCapabilityUnavailableError(
			"Renderer bearer authentication",
			"RRD credentials and session bearers remain in the native process",
		);
	}
	async invalidate(): Promise<void> {
		await this.close();
	}
	async import(_source: unknown): Promise<never> {
		throw new RRFlowCapabilityUnavailableError(
			"QL file import",
			"no authorized public RRD file-import capability is connected",
		);
	}
	async liveOf(_id: Uuid): Promise<{
		subscribe: (listener: (event: { action: string; value: unknown }) => void) => void;
		kill: () => Promise<void>;
	}> {
		throw new RRFlowCapabilityUnavailableError(
			"Live query",
			"the native adapter has no negotiated cursor/ACK subscription carriage",
		);
	}
}

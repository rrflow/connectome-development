import { invoke, isTauri } from "@tauri-apps/api/core";

export const RRD_PROTOCOL = "rrd" as const;
export const RRD_PROTOCOL_VERSION = 1 as const;

export interface RrdLiveness {
	observed_at_unix_ms: number;
}

export interface RrdReadiness {
	observed_at_unix_ms: number;
	claim_sequence: number;
	runtime_cursor: number;
	backend: string;
}

export interface RrdCapability {
	name: string;
	contract_version: number;
	status: "unavailable" | "experimental" | "available";
	limits?: Record<string, number>;
	limitation?: string;
}

export interface RrdServiceCapabilities {
	protocol: typeof RRD_PROTOCOL;
	protocol_version: typeof RRD_PROTOCOL_VERSION;
	implementation: string;
	implementation_version: string;
	deployment_mode: string;
	instance: {
		kind: "instance";
		id: string;
	};
	capabilities: RrdCapability[];
	product_capabilities: unknown;
}

export interface RrdHandshake {
	endpoint: string;
	connected_at_unix_ms: number;
	liveness: RrdLiveness;
	readiness: RrdReadiness;
	service: RrdServiceCapabilities;
}

export interface RrdConnectRequest {
	endpoint: string;
	instance: string;
	principal: string;
	api_key: string;
	scope: string;
}

export interface RrdSessionSummary {
	session_id: string;
	issued_at_unix_ms: number;
	idle_expires_at_unix_ms: number;
	absolute_expires_at_unix_ms: number;
}

export interface RrdConnectionSummary {
	endpoint: string;
	instance: string;
	principal: string;
	scope: string;
	connected_at_unix_ms: number;
	session: RrdSessionSummary;
	service: RrdServiceCapabilities;
}

export interface RrdContextRequest {
	query: string;
	seeds?: unknown[];
	valid_at?: number;
	max_graph_depth?: number;
	max_items?: number;
	max_output_bytes?: number;
	max_scanned_changes?: number;
}

type JsonRecord = Record<string, unknown>;
const DEPLOYMENT_MODES = ["memory", "embedded", "local_daemon", "edge", "remote", "distributed"];

function record(value: unknown, label: string): JsonRecord {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`RRD returned invalid ${label}`);
	}
	return value as JsonRecord;
}

function text(value: unknown, label: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`RRD returned invalid ${label}`);
	}
	return value;
}

function integer(value: unknown, label: string, positive = false): number {
	if (
		typeof value !== "number" ||
		!Number.isSafeInteger(value) ||
		(positive ? value <= 0 : value < 0)
	) {
		throw new Error(`RRD returned invalid ${label}`);
	}
	return Number(value);
}

function parseEnvelope(value: unknown, label: string): unknown {
	const envelope = record(value, `${label} envelope`);
	if (envelope.protocol !== RRD_PROTOCOL || envelope.protocol_version !== RRD_PROTOCOL_VERSION) {
		throw new Error(
			`Endpoint does not implement ${RRD_PROTOCOL} protocol v${RRD_PROTOCOL_VERSION}`,
		);
	}
	text(envelope.request_id, `${label} request_id`);
	text(envelope.operation_id, `${label} operation_id`);
	const outcome = record(envelope.outcome, `${label} outcome`);
	if (outcome.status === "error") {
		const error = record(outcome.error, `${label} error`);
		throw new Error(text(error.message, `${label} error message`));
	}
	if (outcome.status !== "ok" || !("payload" in outcome)) {
		throw new Error(`RRD returned invalid ${label} outcome`);
	}
	return outcome.payload;
}

function parseLiveness(value: unknown): RrdLiveness {
	const payload = record(parseEnvelope(value, "liveness"), "liveness payload");
	return {
		observed_at_unix_ms: integer(
			payload.observed_at_unix_ms,
			"liveness observed_at_unix_ms",
			true,
		),
	};
}

function parseReadiness(value: unknown): RrdReadiness {
	const payload = record(parseEnvelope(value, "readiness"), "readiness payload");
	return {
		observed_at_unix_ms: integer(
			payload.observed_at_unix_ms,
			"readiness observed_at_unix_ms",
			true,
		),
		claim_sequence: integer(payload.claim_sequence, "readiness claim_sequence"),
		runtime_cursor: integer(payload.runtime_cursor, "readiness runtime_cursor"),
		backend: text(payload.backend, "readiness backend"),
	};
}

function parseCapabilities(value: unknown): RrdServiceCapabilities {
	const payload = record(parseEnvelope(value, "capabilities"), "capabilities payload");
	if (payload.protocol !== RRD_PROTOCOL || payload.protocol_version !== RRD_PROTOCOL_VERSION) {
		throw new Error("RRD capability payload does not match protocol rrd v1");
	}
	const instance = record(payload.instance, "capability instance");
	if (instance.kind !== "instance") {
		throw new Error("RRD capability identity is not an instance resource");
	}
	if (!Array.isArray(payload.capabilities)) {
		throw new Error("RRD returned invalid capability catalogue");
	}
	if (!("product_capabilities" in payload)) {
		throw new Error("RRD capability payload has no product capability catalogue");
	}
	const capabilities = payload.capabilities.map((candidate, index): RrdCapability => {
		const capability = record(candidate, `capability ${index}`);
		if (!["unavailable", "experimental", "available"].includes(String(capability.status))) {
			throw new Error(`RRD returned invalid capability ${index} status`);
		}
		let limits: Record<string, number> | undefined;
		if (capability.limits !== undefined) {
			const rawLimits = record(capability.limits, `capability ${index} limits`);
			limits = Object.fromEntries(
				Object.entries(rawLimits).map(([name, limit]) => [
					name,
					integer(limit, `capability ${index} limit ${name}`),
				]),
			);
		}
		return {
			name: text(capability.name, `capability ${index} name`),
			contract_version: integer(
				capability.contract_version,
				`capability ${index} contract_version`,
				true,
			),
			status: capability.status as RrdCapability["status"],
			limits,
			limitation:
				capability.limitation === undefined
					? undefined
					: text(capability.limitation, `capability ${index} limitation`),
		};
	});
	const names = capabilities.map((capability) => capability.name);
	if (
		new Set(names).size !== names.length ||
		names.some((name, index) => index > 0 && names[index - 1] > name)
	) {
		throw new Error("RRD capability catalogue is not unique and canonically sorted");
	}
	const deploymentMode = text(payload.deployment_mode, "deployment mode");
	if (!DEPLOYMENT_MODES.includes(deploymentMode)) {
		throw new Error("RRD returned invalid deployment mode");
	}

	return {
		protocol: RRD_PROTOCOL,
		protocol_version: RRD_PROTOCOL_VERSION,
		implementation: text(payload.implementation, "implementation"),
		implementation_version: text(payload.implementation_version, "implementation version"),
		deployment_mode: deploymentMode,
		instance: {
			kind: "instance",
			id: text(instance.id, "instance id"),
		},
		capabilities,
		product_capabilities: payload.product_capabilities,
	};
}

function runtimeUrl(endpoint: string, path: string) {
	const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
	return new URL(path.replace(/^\//, ""), base);
}

function validateRuntimeOrigin(endpoint: string) {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		throw new Error("RRD endpoint must be a valid HTTP(S) origin");
	}
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.pathname !== "/"
	) {
		throw new Error("RRD endpoint must be a credential-free HTTP(S) origin");
	}
	const loopback =
		url.hostname === "localhost" ||
		url.hostname === "[::1]" ||
		/^127(?:\.\d{1,3}){3}$/.test(url.hostname);
	if (url.protocol === "http:" && !loopback) {
		throw new Error("Remote RRD endpoints require HTTPS");
	}
}

export class RrdRuntimeClient {
	constructor(
		private readonly endpoint: string,
		private readonly expectedInstance?: string,
	) {}

	private async publicGet(path: string): Promise<unknown> {
		if (isTauri()) {
			return invoke<unknown>("rrd_public_request", { endpoint: this.endpoint, path });
		}
		const response = await fetch(runtimeUrl(this.endpoint, path), {
			headers: { Accept: "application/json" },
		});
		const value = (await response.json()) as unknown;
		if (!response.ok) {
			throw new Error(`RRD HTTP request failed (${response.status})`);
		}
		return value;
	}

	async handshake(): Promise<RrdHandshake> {
		validateRuntimeOrigin(this.endpoint);
		const liveness = parseLiveness(await this.publicGet("/v1/health/live"));
		const readiness = parseReadiness(await this.publicGet("/v1/health/ready"));
		const service = parseCapabilities(await this.publicGet("/v1/capabilities"));
		if (this.expectedInstance && service.instance.id !== this.expectedInstance) {
			throw new Error(
				`RRD instance mismatch: expected ${this.expectedInstance}, received ${service.instance.id}`,
			);
		}
		return {
			endpoint: this.endpoint,
			connected_at_unix_ms: Date.now(),
			liveness,
			readiness,
			service,
		};
	}
}

/**
 * Native authenticated RRD session. The API key and bearer token remain in
 * the Tauri process; the webview receives only the bounded public results.
 */
export class RrdAuthenticatedClient {
	private requireNative() {
		if (!isTauri()) {
			throw new Error("Authenticated RRD operations require the native Connectome client");
		}
	}

	async connect(request: RrdConnectRequest): Promise<RrdConnectionSummary> {
		this.requireNative();
		const summary = await invoke<RrdConnectionSummary>("rrd_connect", { request });
		if (
			summary.instance !== request.instance ||
			summary.service.instance.id !== request.instance
		) {
			throw new Error("RRD connection summary changed the requested instance identity");
		}
		return summary;
	}

	async capabilities(): Promise<RrdServiceCapabilities> {
		this.requireNative();
		return invoke<RrdServiceCapabilities>("rrd_capabilities");
	}

	async diagnosticSnapshot(): Promise<unknown> {
		this.requireNative();
		return invoke<unknown>("rrd_diagnostic_snapshot");
	}

	async assembleContext(request: RrdContextRequest): Promise<unknown> {
		this.requireNative();
		return invoke<unknown>("rrd_assemble_context", { request });
	}

	async disconnect(): Promise<void> {
		this.requireNative();
		await invoke<void>("rrd_disconnect");
	}
}

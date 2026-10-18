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

export interface RrdDeploymentProfile {
	contract_version: number;
	deployment_form: string;
	storage_profile: string;
	endpoint_presentation: string;
}

export interface RrdInstalledEstate {
	project_id: string;
	estate_id: string;
	instance_id: string;
}

export interface RrdEstateConfiguration {
	revision: number;
	configuration_sha256: string;
}

export interface RrdServiceCapabilities {
	protocol: typeof RRD_PROTOCOL;
	protocol_version: typeof RRD_PROTOCOL_VERSION;
	implementation: string;
	implementation_version: string;
	deployment: RrdDeploymentProfile;
	installed_estate?: RrdInstalledEstate;
	configuration: RrdEstateConfiguration;
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

type JsonRecord = Record<string, unknown>;

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
	// Enumerated values stay with the contract: the native SDK validates them on
	// every authenticated session. The public handshake checks the shape only.
	const deployment = record(payload.deployment, "deployment profile");
	const configuration = record(payload.configuration, "estate configuration");
	const estate =
		payload.installed_estate === undefined || payload.installed_estate === null
			? undefined
			: record(payload.installed_estate, "installed estate");

	return {
		protocol: RRD_PROTOCOL,
		protocol_version: RRD_PROTOCOL_VERSION,
		implementation: text(payload.implementation, "implementation"),
		implementation_version: text(payload.implementation_version, "implementation version"),
		deployment: {
			contract_version: integer(
				deployment.contract_version,
				"deployment contract_version",
				true,
			),
			deployment_form: text(deployment.deployment_form, "deployment form"),
			storage_profile: text(deployment.storage_profile, "storage profile"),
			endpoint_presentation: text(deployment.endpoint_presentation, "endpoint presentation"),
		},
		installed_estate: estate && {
			project_id: text(estate.project_id, "estate project_id"),
			estate_id: text(estate.estate_id, "estate estate_id"),
			instance_id: text(estate.instance_id, "estate instance_id"),
		},
		configuration: {
			revision: integer(configuration.revision, "configuration revision", true),
			configuration_sha256: text(configuration.configuration_sha256, "configuration sha256"),
		},
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

/**
 * The message of a failed RRD call, whatever shape it arrived in: an `Error`,
 * a native command's `{ message }` rejection, or the plain string a public
 * request rejects with. The UI shows this instead of a generic fallback.
 */
export function describeRrdError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string" && error.length > 0) {
		return error;
	}
	if (typeof error === "object" && error !== null && "message" in error) {
		return String((error as { message: unknown }).message);
	}
	return "Unknown RRD connection error";
}

export class RrdRuntimeClient {
	constructor(
		private readonly endpoint: string,
		private readonly expectedInstance?: string,
	) {}

	private async publicGet(path: string): Promise<unknown> {
		if (isTauri()) {
			try {
				return await invoke<unknown>("rrd_public_request", {
					endpoint: this.endpoint,
					path,
				});
			} catch (error) {
				throw new Error(describeRrdError(error));
			}
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

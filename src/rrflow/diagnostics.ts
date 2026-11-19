import { invoke, isTauri } from "@tauri-apps/api/core";
import { type } from "arktype";

/** Replay shows one event every this long at speed 1. */
const PLAYBACK_STEP_MS = 700;
/** The shortest step replay takes, so every event is drawn before the next. */
const PLAYBACK_SHORTEST_STEP_MS = 80;

/**
 * How long replay stays on one event. The speed is the person's own choice in
 * the replay controls, from the speeds the diagnostics endpoint offers.
 */
export const playbackStepMs = (speed: number) =>
	Math.max(PLAYBACK_SHORTEST_STEP_MS, PLAYBACK_STEP_MS / speed);

export const VYRM_DIAGNOSTICS_PROTOCOL = "vyrm-diagnostics" as const;
export const VYRM_DIAGNOSTICS_VERSION = 1 as const;

const CapabilityMaturitySchema = type("'alpha' | 'partial' | 'experimental' | 'planned'");
const ContextModeSchema = type("'fresh' | 'pruned' | 'full'");
const ReasoningProfileSchema = type("'default' | 'high' | 'extreme' | 'ultra'");
const FlightStatusSchema = type("'preparing' | 'prepared' | 'running' | 'succeeded' | 'failed'");
const ReplaySpeedSchema = type("number > 0");

export const VyrmEngineCapabilitySchema = type({
	id: "string",
	label: "string",
	category: "string",
	maturity: CapabilityMaturitySchema,
	summary: "string",
	evidence: "string",
	limitation: "string",
});

export const VyrmDiagnosticsHandshakeSchema = type({
	protocol: "'vyrm-diagnostics'",
	version: "1",
	developer_diagnostics: "true",
	runners_enabled: "boolean",
	providers: "string[]",
	replay: {
		persisted: "true",
		restart_recoverable: "true",
		seekable: "true",
		reversible: "true",
		speeds: ReplaySpeedSchema.array(),
		lenses: "string[]",
	},
	engine: VyrmEngineCapabilitySchema.array(),
});

export const VyrmFlightEventSchema = type({
	ordinal: "number",
	at: "number",
	elapsed_ms: "number",
	stage: "string",
	kind: "string",
	label: "string",
	detail: "string",
	"data?": "unknown",
});

export const VyrmFlightSchema = type({
	id: "string",
	cohort_id: "string",
	prompt: "string",
	provider: "string",
	context_mode: ContextModeSchema,
	budget: "number",
	created_at: "number",
	status: FlightStatusSchema,
	reasoning_profile: ReasoningProfileSchema,
	metrics: {
		context_tokens: "number",
		input_tokens: "number | null",
		output_tokens: "number | null",
		tool_calls: "number",
		latency_ms: "number | null",
		acceptance_met: "boolean | null",
		cached_input_tokens: "number | null",
		reasoning_tokens: "number | null",
		provider_events: "number",
	},
	events: VyrmFlightEventSchema.array(),
	"demo_role?": "string",
});

const VyrmFlightsSchema = VyrmFlightSchema.array();

export const VyrmRuntimeSnapshotSchema = type({
	generated_at: "number",
	instance: {
		id: "string",
		mode: "string",
		root: "string",
	},
	health: {
		state: "string",
		storage_backend: "string",
		runtime_cursor: "number",
		current_claims: "number",
		vector_artifacts: "number",
	},
	flights: VyrmFlightsSchema,
	capabilities: VyrmDiagnosticsHandshakeSchema,
});

export const LaunchVyrmFlightSchema = type({
	prompt: "string >= 1",
	provider: "string >= 1",
	context_mode: ContextModeSchema,
	budget: "128 <= number.integer <= 32000",
	acceptance_marker: "string",
	reasoning_profile: ReasoningProfileSchema,
});

export type CapabilityMaturity = typeof CapabilityMaturitySchema.infer;
export type VyrmEngineCapability = typeof VyrmEngineCapabilitySchema.infer;
export type VyrmDiagnosticsHandshake = typeof VyrmDiagnosticsHandshakeSchema.infer;
export type VyrmFlightEvent = typeof VyrmFlightEventSchema.infer;
export type VyrmFlight = typeof VyrmFlightSchema.infer;
export type VyrmRuntimeSnapshot = typeof VyrmRuntimeSnapshotSchema.infer;
export type LaunchVyrmFlight = typeof LaunchVyrmFlightSchema.infer;

function runtimeURL(endpoint: string, path: string) {
	const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
	return new URL(path.replace(/^\//, ""), base);
}

function parseHandshake(value: unknown): VyrmDiagnosticsHandshake {
	const result = VyrmDiagnosticsHandshakeSchema(value);
	if (result instanceof type.errors) {
		throw new Error(`Endpoint does not implement vyrm-diagnostics v1: ${result.summary}`);
	}
	return result;
}

function parseFlights(value: unknown): VyrmFlight[] {
	const result = VyrmFlightsSchema(value);
	if (result instanceof type.errors) {
		throw new Error(`Vyrm runtime returned an invalid flight ledger: ${result.summary}`);
	}
	return result;
}

function parseFlight(value: unknown): VyrmFlight {
	const result = VyrmFlightSchema(value);
	if (result instanceof type.errors) {
		throw new Error(`Vyrm runtime returned an invalid flight: ${result.summary}`);
	}
	return result;
}

function parseSnapshot(value: unknown): VyrmRuntimeSnapshot {
	const result = VyrmRuntimeSnapshotSchema(value);
	if (result instanceof type.errors) {
		throw new Error(`Vyrm runtime returned an invalid snapshot: ${result.summary}`);
	}
	return result;
}

export class VyrmDiagnosticsClient {
	constructor(private readonly endpoint: string) {}

	private async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
		if (isTauri()) {
			return invoke<T>("runtime_diagnostics_request", {
				endpoint: this.endpoint,
				path,
				method,
				body,
			});
		}
		const response = await fetch(runtimeURL(this.endpoint, path), {
			method,
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const value = (await response.json()) as T;
		if (!response.ok) {
			throw new Error(`Vyrm diagnostics request failed (${response.status})`);
		}
		return value;
	}

	async handshake() {
		const value = await this.request<unknown>("/api/runtime/capabilities");
		return parseHandshake(value);
	}

	async snapshot() {
		const value = await this.request<unknown>("/api/snapshot");
		return parseSnapshot(value);
	}

	async flights() {
		const value = await this.request<unknown>("/api/flights");
		return parseFlights(value);
	}

	async launch(request: LaunchVyrmFlight) {
		const outbound = LaunchVyrmFlightSchema(request);
		if (outbound instanceof type.errors) {
			throw new Error(`Invalid Vyrm flight request: ${outbound.summary}`);
		}
		const value = await this.request<unknown>("/api/flights", "POST", outbound);
		return parseFlight(value);
	}

	async seedDemos() {
		const value = await this.request<unknown>("/api/demos/prompt-strength", "POST", {});
		return parseFlights(value);
	}
}

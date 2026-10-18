/**
 * The public RRD handshake, on the generated TypeScript SDK.
 *
 * `@rrflow/rrd-client` is pinned to the same RRFlow revision as the native
 * `rrd-client`/`rrd-contract` crates (the dependency-authority gate checks
 * the two pins name one commit). Its generated OpenAPI types own the wire
 * shapes; its transport validates every response envelope and error body.
 * Nothing in Connectome mirrors a contract type by hand any more.
 *
 * In the desktop the SDK's fetch is the native `rrd_public_request` command,
 * so the webview never opens a socket itself: loopback-only HTTP, a 1 MiB
 * response cap, and no redirects, enforced in the native process. In the
 * browser build the SDK uses the page's own fetch.
 */
import { RrdClient, type SuccessPayload } from "@rrflow/rrd-client";
import { invoke, isTauri } from "@tauri-apps/api/core";

export const RRD_PROTOCOL = "rrd" as const;
export const RRD_PROTOCOL_VERSION = 1 as const;

export type RrdLiveness = SuccessPayload<"health-live">;
export type RrdReadiness = SuccessPayload<"health-ready">;
export type RrdServiceCapabilities = SuccessPayload<"capabilities-read">;
export type RrdCapability = RrdServiceCapabilities["capabilities"][number];

export interface RrdHandshake {
	endpoint: string;
	connected_at_unix_ms: number;
	liveness: RrdLiveness;
	readiness: RrdReadiness;
	service: RrdServiceCapabilities;
}

/**
 * The SDK binds a client to one instance identity. A connection that has not
 * pinned an instance yet discovers it from the capabilities, so its client is
 * bound to this placeholder; the handshake never sends an authenticated or
 * resource-scoped request, which are the only requests that carry it.
 */
const DISCOVERY_INSTANCE = "discovery";

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

/**
 * A Fetch implementation for the SDK that crosses the native boundary: the
 * request path goes to `rrd_public_request`, which performs the loopback GET
 * and returns the decoded envelope; the SDK then validates it as it would any
 * response. Only reads exist on this path.
 */
function nativePublicFetch(endpoint: string): typeof globalThis.fetch {
	return async (input, init) => {
		const url =
			input instanceof URL
				? input
				: new URL(typeof input === "string" ? input : (input as Request).url);
		if ((init?.method ?? "GET").toUpperCase() !== "GET") {
			throw new Error("the public RRD handshake only reads");
		}
		let value: unknown;
		try {
			value = await invoke<unknown>("rrd_public_request", {
				endpoint,
				path: `${url.pathname}${url.search}`,
			});
		} catch (error) {
			throw new Error(describeRrdError(error));
		}
		return new Response(JSON.stringify(value), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	};
}

/**
 * The page's own fetch, called as a free function: a browser's `fetch` throws
 * "Illegal invocation" when it is invoked as a method of another object, and
 * the SDK keeps its transport as a property.
 */
const browserFetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init);

export class RrdRuntimeClient {
	private readonly client: RrdClient;

	constructor(
		private readonly endpoint: string,
		private readonly expectedInstance?: string,
	) {
		this.client = new RrdClient({
			baseUrl: endpoint,
			instance: expectedInstance || DISCOVERY_INSTANCE,
			maxAttempts: 1,
			fetch: isTauri() ? nativePublicFetch(endpoint) : browserFetch,
		});
	}

	async handshake(): Promise<RrdHandshake> {
		const liveness = await this.client.call("health-live", undefined, {});
		const readiness = await this.client.call("health-ready", undefined, {});
		const service = await this.client.call("capabilities-read", undefined, {});
		if (
			service.protocol !== RRD_PROTOCOL ||
			service.protocol_version !== RRD_PROTOCOL_VERSION
		) {
			throw new Error(
				`Endpoint does not implement ${RRD_PROTOCOL} protocol v${RRD_PROTOCOL_VERSION}`,
			);
		}
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

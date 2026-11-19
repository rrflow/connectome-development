import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** What the pinned engine serves, from the golden offer the RRD process test checks. */
const OFFER = JSON.parse(readFileSync("src/rrflow/fixtures/engine-offer.json", "utf8")) as {
	operations: string[];
	websocket_operations: string[];
	capabilities: { name: string; status: string; limitation: string | null }[];
};
/** The capabilities that engine declares, as its capabilities read returns them. */
export const CAPABILITIES = OFFER.capabilities.map((capability) => ({
	contract_version: 1,
	...capability,
}));
export const CATALOGUE = {
	endpoints: OFFER.operations.map((operation) => ({ operation })),
	websocket_endpoints: OFFER.websocket_operations.map((operation) => ({ operation })),
	families: [],
};

export async function createDiagnosticProfiles(page: Page) {
	await page.route(/http:\/\/localhost:947[78]\/v1\//, async (route) => {
		const requestUrl = new URL(route.request().url());
		const path = requestUrl.pathname;
		const payload =
			path === "/v1/schema/endpoints"
				? CATALOGUE
				: path === "/v1/health/live"
					? { observed_at_unix_ms: 1 }
					: path === "/v1/health/ready"
						? {
								observed_at_unix_ms: 2,
								claim_sequence: 3,
								runtime_cursor: 4,
								backend: "rrflow_kv",
							}
						: {
								protocol: "rrd",
								protocol_version: 1,
								implementation: "rrflow",
								implementation_version: "1.0.0",
								deployment: {
									contract_version: 1,
									deployment_form: "single_node_server",
									storage_profile: "rrflow_kv",
									endpoint_presentation: "loopback_http_websocket",
								},
								configuration: {
									format_version: 1,
									revision: 1,
									configuration_sha256: "b".repeat(64),
								},
								instance: {
									kind: "instance",
									id:
										requestUrl.port === "9478"
											? "diagnostic-profile-b"
											: "diagnostic-profile-a",
								},
								capabilities: CAPABILITIES,
								product_capabilities: {},
							};
		await route.fulfill({
			contentType: "application/json",
			headers: { "Access-Control-Allow-Origin": "*" },
			body: JSON.stringify({
				protocol: "rrd",
				protocol_version: 1,
				request_id: `request-${path}`,
				operation_id: `operation-${path}`,
				outcome: { status: "ok", payload },
			}),
		});
	});

	await page.goto("/connections/create", { waitUntil: "domcontentloaded" });
	await page.getByPlaceholder("Connection name").fill("Diagnostic Profile A");
	await page.getByLabel("RRD HTTP host").fill("localhost:9477");
	await page.getByRole("button", { name: "Save & connect to RRD" }).click();
	await expect(page.getByText("diagnostic-profile-a", { exact: true })).toBeVisible();
	const profileA = new URL(page.url()).pathname;
	await page.goto("/connections/create");
	await page.getByPlaceholder("Connection name").fill("Diagnostic Profile B");
	await page.getByLabel("RRD HTTP host").fill("localhost:9478");
	await page.getByRole("button", { name: "Save & connect to RRD" }).click();
	await expect(page.getByText("diagnostic-profile-b", { exact: true })).toBeVisible();
	const profileB = new URL(page.url()).pathname;
	await page.getByRole("button", { name: "Knowledge", exact: true }).click();
	await page.getByRole("textbox", { name: "Selected project", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic Profile A" }).click();
	await expect(page).toHaveURL(new RegExp(`${profileA}/knowledge/records$`));
	return { profileA, profileB };
}

export async function openDiagnosticWorkbench(page: Page, profileA: string, profileB: string) {
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await page.getByRole("tab", { name: "Workbench", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Prompt workbench", exact: true }),
	).toBeVisible();
	await page.getByLabel("Workbench name", { exact: true }).fill("Diagnostic lifecycle");
	await page.getByRole("button", { name: "Create local workbench", exact: true }).click();
	await page.getByLabel("Note intent", { exact: true }).fill("Manual note remains local");
	await page.getByRole("button", { name: "Save local note", exact: true }).click();
	await expect(
		page.getByText("testing · Manual note remains local", { exact: true }),
	).toBeVisible();
	await page.evaluate(
		({ profileA, profileB, catalogue, capabilities }) => {
			Object.assign(globalThis, { isTauri: true });
			let connectedAt = 101;
			let handshakeInstance = "diagnostic-profile-a";
			let showFlight = false;
			let emptyGraph = false;
			let liveNodeCommitted = false;
			let liveGraphClustered = false;
			let liveHead = 7;
			let unreachable = false;
			let boundedGraph = false;
			let liveChannel: { onmessage: (event: unknown) => void } | null = null;
			let callbackId = 1;
			let failStorage = false;
			const queryRequests: unknown[] = [];
			const profileSessions: Record<string, Record<string, unknown> | null> = {};
			let deferReads = false;
			const deferred: { command: string; resolve: (value: unknown) => void }[] = [];
			const calls: string[] = [];
			const service = (instance: string) => ({
				implementation: "rrflow",
				implementation_version: "1.0.0",
				instance,
				deployment_form: "single_node_server",
				storage_profile: "rrflow_kv",
				endpoint_presentation: "loopback_http_websocket",
				installed_engram: null,
				configuration_revision: 1,
				configuration_sha256: "c".repeat(64),
				capabilities: [],
			});
			const profileInstances: Record<string, string> = {
				[profileA.split("/")[2]]: "diagnostic-profile-a",
				[profileB.split("/")[2]]: "diagnostic-profile-b",
			};
			const makeSession = (profile: string, timestamp: number) => {
				const instance = profileInstances[profile] ?? "diagnostic-profile-a";
				return {
					endpoint:
						instance === "diagnostic-profile-b"
							? "http://localhost:9478"
							: "http://localhost:9477",
					instance,
					principal: "diagnostic-test",
					connected_at_unix_ms: timestamp,
					session: { idle_timeout_ms: 60000, absolute_timeout_ms: 3600000 },
					service: service(instance),
				};
			};
			Object.assign(window, {
				__diagnosticCaptureTest: {
					calls: () => calls,
					queryRequests: () => queryRequests,
					showFlight: () => {
						showFlight = true;
					},
					makeUnreachable: () => {
						unreachable = true;
					},
					sendBoundedGraph: () => {
						boundedGraph = true;
						liveHead = 40;
					},
					commitWhileClosed: () => {
						liveNodeCommitted = true;
						liveHead = 8;
					},
					commitLiveChange: (clustered = false) => {
						liveNodeCommitted = true;
						liveHead = Math.max(liveHead, 8);
						liveGraphClustered = clustered;
						liveChannel?.onmessage({
							event: "changes",
							from_cursor: 7,
							through_cursor: 8,
							page: {
								changes: [
									{ cursor: 8, mutation: { target: "document:live-node" } },
								],
							},
						});
					},
					showEmptyAndError: () => {
						emptyGraph = true;
						failStorage = true;
					},
					setHandshakeInstance: (instance: string) => {
						handshakeInstance = instance;
					},
					sessionTimestamp: (profile: string) =>
						(profileSessions[profile]?.connected_at_unix_ms as number | undefined) ??
						null,
					sessionInstance: (profile: string) =>
						(profileSessions[profile]?.instance as string | undefined) ?? null,
					defer: () => {
						calls.length = 0;
						deferReads = true;
					},
					pending: () => deferred.length,
					pendingCommands: () => deferred.map((item) => item.command),
					resolve: async (prefix: string) => {
						deferReads = false;
						for (const item of deferred.splice(0)) {
							if (item.command === "rrd_capabilities")
								item.resolve({
									...service(`${prefix}-instance`),
									implementation: prefix,
									configuration_revision: 99,
								});
							else if (item.command === "rrd_database")
								item.resolve({
									observed_at_unix_ms: 1,
									graph: {
										valid_at_unix_ms: 1,
										known_at_cursor: 99,
										nodes: Array.from({ length: 99 }, (_, index) => ({
											id: `${prefix}-${index}`,
											kind: "document",
											key: `${index}`,
											label: `${prefix} ${index}`,
											properties: {},
											cluster: 0,
										})),
										edges: Array.from({ length: 98 }, (_, index) => ({
											id: `${prefix}-edge-${index}`,
											kind: "links_to",
											from: `${prefix}-${index}`,
											to: `${prefix}-${index + 1}`,
										})),
										clusters: [],
									},
								});
							else if (item.command === "rrd_storage")
								item.resolve({
									runtime_cursor: 99,
									physical: {
										profile: prefix,
										observed_at_unix_ms: 1,
										evidence_level: "process-local",
										headline: [],
										groups: [],
									},
								});
							else
								item.resolve({
									collections: Array.from({ length: 97 }, () => ({
										vectors: [],
									})),
								});
						}
						await Promise.resolve();
						await new Promise<void>((done) => requestAnimationFrame(() => done()));
						await new Promise<void>((done) => requestAnimationFrame(() => done()));
					},
				},
			});
			Object.defineProperty(window, "__TAURI_INTERNALS__", {
				configurable: true,
				value: {
					transformCallback: () => callbackId++,
					invoke: async (
						command: string,
						args: {
							profile?: string;
							request?: { instance?: string; action?: string; query?: string };
							endpoint?: string;
							path?: string;
						},
					) => {
						const profile = args.profile ?? "";
						calls.push(`${command}:${profile}`);
						if (command === "rrd_session") {
							if (!(profile in profileSessions))
								profileSessions[profile] = makeSession(profile, connectedAt++);
							return profileSessions[profile];
						}
						if (command === "rrd_disconnect") {
							profileSessions[profile] = null;
							return null;
						}
						if (command === "rrd_connect") {
							const instance = args.request?.instance ?? "diagnostic-profile-a";
							const endpoint =
								instance === "diagnostic-profile-b"
									? "http://localhost:9478"
									: "http://localhost:9477";
							profileSessions[profile] = {
								...makeSession(instance, connectedAt++),
								endpoint,
								instance,
								service: service(instance),
							};
							return profileSessions[profile];
						}
						if (command === "rrd_public_request" && unreachable)
							throw new Error(
								"RRD transport failed: RRD HTTP request failed: error sending request for url (http://localhost:9477/v1/health/live)",
							);
						if (command === "rrd_public_request") {
							const path = args.path ?? "";
							const instanceId = args.endpoint?.endsWith(":9478")
								? "diagnostic-profile-b"
								: handshakeInstance;
							const payload =
								path === "/v1/schema/endpoints"
									? catalogue
									: path === "/v1/health/live"
										? { observed_at_unix_ms: 1 }
										: path === "/v1/health/ready"
											? {
													observed_at_unix_ms: 2,
													claim_sequence: 3,
													runtime_cursor: 4,
													backend: "rrflow_kv",
												}
											: {
													protocol: "rrd",
													protocol_version: 1,
													implementation: "rrflow",
													implementation_version: "1.0.0",
													deployment: {
														contract_version: 1,
														deployment_form: "single_node_server",
														storage_profile: "rrflow_kv",
														endpoint_presentation:
															"loopback_http_websocket",
													},
													configuration: {
														format_version: 1,
														revision: 1,
														configuration_sha256: "b".repeat(64),
													},
													instance: {
														kind: "instance",
														id: instanceId,
													},
													capabilities,
													product_capabilities: {},
												};
							return {
								protocol: "rrd",
								protocol_version: 1,
								request_id: `native-${path}`,
								operation_id: `native-${path}`,
								outcome: { status: "ok", payload },
							};
						}
						if (command === "rrd_attunement") {
							const profileB = profileInstances[profile] === "diagnostic-profile-b";
							const snapshot = (profileB ? "d" : "a").repeat(64);
							const job = profileB ? "job-b" : "job-a";
							if (args.request?.action === "list")
								return {
									kind: "page",
									page: {
										jobs: [{ job_id: job, checkpoint_count: "1" }],
										next_after_job_id: null,
									},
								};
							return {
								kind: "snapshot",
								snapshot: {
									status: {
										job: {
											id: job,
											checkpoints: [
												{
													phase: "inventory",
													output_sha256: snapshot,
													coordinates: { runtime_cursor: "27" },
													committed_at_unix_ms: "1000",
												},
											],
										},
									},
								},
							};
						}
						if (command === "rrd_query") {
							queryRequests.push(args.request);
							const profileB = profileInstances[profile] === "diagnostic-profile-b";
							const snapshot = (profileB ? "d" : "a").repeat(64);
							const root = (profileB ? "e" : "b").repeat(64);
							const child = (profileB ? "f" : "c").repeat(64);
							const query = args.request?.query ?? "";
							const edge = (fromKind: string, from: string, to: string) => ({
								values: {
									from_kind: fromKind,
									from_id: from,
									to_kind: "source-tree-entry",
									to_id: to,
									relation_kind: "source-tree-contains",
									relation_id: `edge-${to}`,
								},
							});
							const rows = query.includes("START source-tree-snapshot:")
								? [edge("source-tree-snapshot", snapshot, root)]
								: query.includes("START source-tree-entry:")
									? [edge("source-tree-entry", root, child)]
									: [
											{
												values: {
													id: query.includes(child) ? child : root,
													path: query.includes(child)
														? profileB
															? "Profile B source"
															: "Profile A source"
														: "",
												},
											},
										];
							// Only the engine view reads at the head; inventory reads pin a checkpoint.
							const probe = query.includes(" KNOWN HEAD ");
							return {
								known_at_cursor: probe ? liveHead : 27,
								rows,
								returned_rows: rows.length,
								truncated: false,
								keys_examined: 2,
								plan: {
									exact: true,
									candidates: [
										{
											name: "kind_prefix",
											selected: true,
											exact: true,
											reason: "the kind bounds the key range",
										},
									],
								},
								execution: {
									read_evidence: {
										point_reads: 0,
										range_scans: 1,
										keys_examined: 2,
										values_decoded: 2,
										decoded_bytes: 128,
										paths: [],
									},
									analysis: null,
								},
							};
						}
						if (
							deferReads &&
							deferred.length < 4 &&
							[
								"rrd_capabilities",
								"rrd_database",
								"rrd_storage",
								"rrd_vector_collections",
							].includes(command)
						)
							return new Promise((resolve) => deferred.push({ command, resolve }));
						if (command === "rrd_capabilities") return service("diagnostic-profile-a");
						if (command === "rrd_live_open") {
							liveChannel = (
								args as unknown as {
									onEvent: { onmessage: (event: unknown) => void };
								}
							).onEvent;
							liveChannel.onmessage({
								event: "subscribed",
								reason: "opened",
								generation: 1,
								acknowledged_cursor: liveHead,
								head_cursor: liveHead,
							});
							return { handle: "live-1", stream: "changes" };
						}
						if (command === "rrd_live_close") return null;
						if (command === "rrd_database" && boundedGraph)
							return {
								observed_at_unix_ms: 4,
								runtime_cursor: 40,
								schema_revision: null,
								tables: [],
								models: [],
								sections: [],
								graph: {
									valid_at_unix_ms: 4,
									known_at_cursor: 40,
									nodes: [
										{
											id: "document:hub",
											kind: "document",
											key: "hub",
											label: "hub",
											properties: {},
											cluster: 0,
										},
									],
									edges: [],
									records_total: 40,
									relations_total: 39,
									clusters: [],
								},
							};
						if (command === "rrd_database" && liveNodeCommitted && liveGraphClustered)
							return {
								observed_at_unix_ms: 3,
								runtime_cursor: 9,
								schema_revision: null,
								tables: [],
								models: [],
								sections: [],
								graph: {
									valid_at_unix_ms: 3,
									known_at_cursor: 9,
									nodes: [
										["document:a1", 0],
										["document:a2", 0],
										["document:b1", 1],
										["document:b2", 1],
									].map(([id, cluster]) => ({
										id,
										kind: "document",
										key: id,
										label: id,
										properties: {},
										cluster,
									})),
									edges: [
										["e1", "document:a1", "document:a2"],
										["e2", "document:b1", "document:b2"],
									].map(([id, from, to]) => ({ id, kind: "links_to", from, to })),
									clusters: [
										{ id: 0, size: 2, anchor: "document:a1", label: "Alpha" },
										{ id: 1, size: 2, anchor: "document:b1", label: "Beta" },
									],
								},
							};
						if (command === "rrd_database" && liveNodeCommitted)
							return {
								observed_at_unix_ms: 2,
								runtime_cursor: 8,
								schema_revision: null,
								tables: [],
								models: [],
								sections: [],
								graph: {
									valid_at_unix_ms: 2,
									known_at_cursor: 8,
									nodes: ["stable-node", "live-node"].map((id) => ({
										id: `document:${id}`,
										kind: "document",
										key: id,
										label: id,
										properties: {},
										cluster: 0,
									})),
									edges: [],
									clusters: [],
								},
							};
						if (command === "rrd_database")
							return {
								observed_at_unix_ms: 1,
								runtime_cursor: 7,
								schema_revision: null,
								tables: [],
								models: [],
								sections: [],
								graph: {
									valid_at_unix_ms: 1,
									known_at_cursor: 7,
									nodes: emptyGraph
										? []
										: [
												{
													id: "stable-node",
													kind: "document",
													key: "stable-node",
													label: "Stable document",
													properties: {},
													cluster: 0,
												},
											],
									edges: [],
									clusters: [],
								},
							};
						if (command === "rrd_physical_storage" && failStorage)
							throw new Error("Storage unavailable");
						if (command === "rrd_physical_storage")
							return {
								profile: "stable-profile",
								observed_at_unix_ms: 1,
								evidence_level: "process-local",
								headline: [],
								groups: [],
							};
						if (command === "rrd_storage")
							return {
								observed_at_unix_ms: Date.now(),
								runtime_cursor: liveHead,
								change_head_cursor: liveHead,
								oldest_retained_cursor: 1,
								vector_artifacts: [],
								query_indexes: [],
								physical: {
									profile: "stable-profile",
									observed_at_unix_ms: 1,
									evidence_level: "process-local",
									headline: [],
									cold_tier: {
										enabled: true,
										pending: false,
										through_cursor: 5,
										files: 14,
										stopped: null,
									},
									groups: [
										{
											id: "sequences",
											label: "Sequences",
											notes: [],
											metrics: ["physical_sequence", "durable_sequence"].map(
												(id) => ({
													id,
													label: id,
													unit: "count",
													value: 100 + liveHead,
													limit: null,
													cumulative: false,
												}),
											),
										},
										{
											id: "rrflow_cld",
											label: "rrflowCLD cold tier",
											metrics: [
												{
													id: "files",
													label: "Published files",
													unit: "count",
													value: 14,
													limit: null,
													cumulative: false,
												},
											],
											notes: [
												"Files are a copy today: LSM space is not reclaimed yet.",
											],
										},
									],
								},
							};
						if (command === "rrd_vector_collections") return { collections: [] };
						if (command === "rrd_workbench_snapshot")
							return {
								scope: "session",
								after_cursor: 0,
								truncated: false,
								flights: showFlight
									? [
											{
												flight_id: "flight-test",
												status: "completed",
												provider: "observe",
												context_mode: "fresh",
												flight_cursor: 8,
												known_at_cursor: 8,
											},
										]
									: [],
							};
						if (command === "rrd_read_prompt_flight")
							return {
								flight_id: "flight-test",
								status: "completed",
								provider: "observe",
								context_mode: "fresh",
								prompt: "test",
								acceptance_marker: null,
								cohort_sha256: "a".repeat(64),
								created_at_unix_ms: 1,
								flight_cursor: 8,
								known_at_cursor: 8,
								event_count: 2,
								context_items: 0,
								context_output_bytes: 0,
								elapsed_ms: 5,
								events: [
									{
										ordinal: 1,
										at_unix_ms: 1,
										elapsed_ms: 2,
										stage: "accepted",
										label: "Request accepted",
										detail: "Recorded by engine",
									},
									{
										ordinal: 2,
										at_unix_ms: 2,
										elapsed_ms: 5,
										stage: "completed",
										label: "Observe finished",
										detail: "Recorded by engine",
									},
								],
							};
						throw new Error(`Unexpected command ${command}`);
					},
				},
			});
		},
		{ profileA, profileB, catalogue: CATALOGUE, capabilities: CAPABILITIES },
	);
	await page.getByRole("button", { name: "System", exact: true }).click();
	await expect(page).toHaveURL(/\/system\/instance$/);
	await expect(page.getByText("Session open", { exact: false })).toBeVisible();
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await page.getByRole("tab", { name: "Workbench", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${profileA}/reasoning/workbench$`));
}

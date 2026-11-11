import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

async function createDiagnosticProfiles(page: Page) {
	await page.route(/http:\/\/localhost:947[78]\/v1\//, async (route) => {
		const requestUrl = new URL(route.request().url());
		const path = requestUrl.pathname;
		const payload =
			path === "/v1/health/live"
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
							capabilities: [],
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

async function openDiagnosticWorkbench(page: Page, profileA: string, profileB: string) {
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
		({ profileA, profileB }) => {
			Object.assign(globalThis, { isTauri: true });
			let connectedAt = 101;
			let handshakeInstance = "diagnostic-profile-a";
			let showFlight = false;
			let emptyGraph = false;
			let liveNodeCommitted = false;
			let liveGraphClustered = false;
			let liveChannel: { onmessage: (event: unknown) => void } | null = null;
			let callbackId = 1;
			let failStorage = false;
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
				installed_estate: null,
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
					showFlight: () => {
						showFlight = true;
					},
					commitLiveChange: (clustered = false) => {
						liveNodeCommitted = true;
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
						if (command === "rrd_public_request") {
							const path = args.path ?? "";
							const instanceId = args.endpoint?.endsWith(":9478")
								? "diagnostic-profile-b"
								: handshakeInstance;
							const payload =
								path === "/v1/health/live"
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
												capabilities: [],
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
							return {
								known_at_cursor: 27,
								rows,
								truncated: false,
								keys_examined: 2,
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
								acknowledged_cursor: 7,
								head_cursor: 7,
							});
							return { handle: "live-1", stream: "changes" };
						}
						if (command === "rrd_live_close") return null;
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
								runtime_cursor: 7,
								physical: {
									profile: "stable-profile",
									observed_at_unix_ms: 1,
									evidence_level: "process-local",
									headline: [],
									groups: [],
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
		{ profileA, profileB },
	);
	await page.getByRole("button", { name: "System", exact: true }).click();
	await expect(page).toHaveURL(/\/system\/instance$/);
	await expect(page.getByText("Session open", { exact: false })).toBeVisible();
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await page.getByRole("tab", { name: "Workbench", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${profileA}/reasoning/workbench$`));
}

test("workbench visualizes returned project data and recorded flight events", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await expect(page.getByRole("heading", { name: "Documents and relationships" })).toBeVisible();
	await page.getByRole("button", { name: "Read all-model graph", exact: true }).click();
	await expect(
		page.getByText(/Showing 1 of 1 returned records and 0 of 0 returned relationships/),
	).toBeVisible();
	await expect(page.getByText("No storage observation is available.")).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "Storage path", exact: true })).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "rrflowKV storage path", exact: true }),
	).toHaveCount(0);
	await expect(page.getByText(/reports process-local evidence/)).toBeVisible();
	await page.evaluate(() =>
		(
			window as unknown as { __diagnosticCaptureTest: { showFlight: () => void } }
		).__diagnosticCaptureTest.showFlight(),
	);
	await page.getByRole("button", { name: "Refresh flights" }).click();
	await page.getByRole("button", { name: "Inspect", exact: true }).click();
	const sequence = page.getByRole("list", { name: "Recorded flight event sequence" });
	await expect(sequence.locator("li")).toHaveCount(2);
	await expect(sequence.locator("li").nth(0)).toContainText("Request accepted");
	await expect(sequence.locator("li").nth(1)).toContainText("Observe finished");
	await page.getByText("Choose a record using the keyboard", { exact: true }).click();
	await page.getByRole("button", { name: "Stable document · stable-node" }).click();
	await expect(page).toHaveURL(new RegExp(`${profileA}/knowledge/records$`));
});

test("inventory neighborhood follows the selected project session", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	const inventory = page.getByLabel("Inventory neighborhood");
	await inventory.getByText("Choose a source entry using the keyboard", { exact: true }).click();
	await expect(
		inventory.getByRole("button", { name: "Profile A source", exact: true }),
	).toBeVisible();
	await page.getByRole("textbox", { name: "Selected project", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic Profile B" }).click();
	await expect(page).toHaveURL(new RegExp(`${profileB}/reasoning/workbench$`));
	await inventory.getByText("Choose a source entry using the keyboard", { exact: true }).click();
	await expect(
		inventory.getByRole("button", { name: "Profile B source", exact: true }),
	).toBeVisible();
	await expect(
		inventory.getByRole("button", { name: "Profile A source", exact: true }),
	).toHaveCount(0);
});

test("a committed change reaches the graph without a reload", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "Knowledge", exact: true }).click();
	await page.getByRole("tab", { name: "Graph", exact: true }).click();
	await expect(page.getByText(/Drawing 1 of 1 records/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Live", exact: true })).toBeVisible();
	await page.evaluate(() =>
		(
			window as unknown as { __diagnosticCaptureTest: { commitLiveChange: () => void } }
		).__diagnosticCaptureTest.commitLiveChange(),
	);
	await expect(page.getByText(/Drawing 2 of 2 records/)).toBeVisible();
	const activity = page.getByRole("button", { name: "Live · 1 change", exact: true });
	await expect(activity).toBeVisible();
	await activity.click();
	await expect(
		page.getByRole("button", { name: "document:live-node", exact: true }),
	).toBeVisible();
});

test("the graph opens a cluster and returns to the overview", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "Knowledge", exact: true }).click();
	await page.getByRole("tab", { name: "Graph", exact: true }).click();
	await page.evaluate(() =>
		(
			window as unknown as {
				__diagnosticCaptureTest: { commitLiveChange: (clustered: boolean) => void };
			}
		).__diagnosticCaptureTest.commitLiveChange(true),
	);
	await expect(page.getByText(/Drawing 4 of 4 records/)).toBeVisible();
	await page.getByText("By cluster", { exact: true }).click();
	await expect(page.getByText(/Grouping 4 of 4 records/)).toBeVisible();
	await expect(page.getByText("2 clusters", { exact: false })).toBeVisible();
	await page.getByRole("textbox", { name: "Open a cluster", exact: true }).click();
	await page.getByRole("option", { name: "Alpha (2)", exact: true }).click();
	await expect(page.getByText("2 records", { exact: false })).toBeVisible();
	await page.getByRole("button", { name: "All clusters", exact: true }).click();
	await expect(page.getByText("2 clusters", { exact: false })).toBeVisible();
});

test("visualizations expose an empty graph and a failed storage refresh", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "Read all-model graph", exact: true }).click();
	await expect(page.getByText(/Showing 1 of 1 returned records/)).toBeVisible();
	await page.evaluate(() =>
		(
			window as unknown as { __diagnosticCaptureTest: { showEmptyAndError: () => void } }
		).__diagnosticCaptureTest.showEmptyAndError(),
	);
	await page.getByRole("button", { name: "Refresh visualizations" }).click();
	await expect(
		page.getByText("The engine returned no records for this graph view."),
	).toBeVisible();
	await expect(page.getByText("Storage read failed", { exact: true })).toBeVisible();
	await expect(page.getByText("Storage unavailable", { exact: true })).toBeVisible();
});

test("diagnostic capture rejects a response completed after the same profile reconnects", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	const capture = page.getByRole("button", { name: "Capture engine diagnostics", exact: true });
	await expect(capture).toBeEnabled();
	await capture.click();
	await expect(
		page.getByText("testing · Engine diagnostic snapshot", { exact: true }),
	).toHaveCount(1);
	await page.getByText("testing · Engine diagnostic snapshot", { exact: true }).click();
	await expect(
		page.getByText(
			"Engine rrflow 1.0.0; configuration revision 1; records in returned graph 1; relationships in returned graph 0; storage cursor 7; storage profile stable-profile; vector collections in returned catalogue 0.",
			{ exact: true },
		),
	).toBeVisible();
	await page.getByLabel("Note intent", { exact: true }).fill("stale reconnect probe");
	const profileId = profileA.split("/")[2];
	const initialSessionTimestamp = await page.evaluate(
		(profile) =>
			(
				window as unknown as {
					__diagnosticCaptureTest: { sessionTimestamp: (id: string) => number | null };
				}
			).__diagnosticCaptureTest.sessionTimestamp(profile),
		profileId,
	);
	await page.evaluate(() => {
		(
			window as unknown as {
				__diagnosticCaptureTest: { defer: () => void };
			}
		).__diagnosticCaptureTest.defer();
	});
	await capture.click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as {
						__diagnosticCaptureTest: { pending: () => number };
					}
				).__diagnosticCaptureTest.pending(),
			),
		)
		.toBe(4);
	const captureCalls = await page.evaluate(() =>
		(
			window as unknown as {
				__diagnosticCaptureTest: { calls: () => string[] };
			}
		).__diagnosticCaptureTest.calls(),
	);
	expect(captureCalls.slice().sort()).toEqual(
		["rrd_capabilities", "rrd_database", "rrd_storage", "rrd_vector_collections"]
			.map((command) => `${command}:${profileId}`)
			.sort(),
	);
	await page.getByRole("button", { name: "System", exact: true }).click();
	await expect(page).toHaveURL(/\/system\/instance$/);
	await page.getByRole("button", { name: "Disconnect", exact: true }).click();
	await expect(page.getByLabel("Operator credential file")).toBeVisible();
	await page.getByLabel("Operator credential file").fill("controlled/mock-operator.json");
	await page.getByRole("button", { name: "Open session", exact: true }).click();
	await expect(page.getByText("Session open", { exact: false })).toBeVisible();
	const callsAfterReconnect = await page.evaluate(() =>
		(
			window as unknown as {
				__diagnosticCaptureTest: { calls: () => string[] };
			}
		).__diagnosticCaptureTest.calls(),
	);
	expect(callsAfterReconnect.map((call) => call.split(":")[0])).toContain("rrd_disconnect");
	expect(callsAfterReconnect.map((call) => call.split(":")[0])).toContain("rrd_connect");
	const reconnectedSessionTimestamp = await page.evaluate(
		(profile) =>
			(
				window as unknown as {
					__diagnosticCaptureTest: { sessionTimestamp: (id: string) => number | null };
				}
			).__diagnosticCaptureTest.sessionTimestamp(profile),
		profileA.split("/")[2],
	);
	expect(reconnectedSessionTimestamp).not.toBe(initialSessionTimestamp);
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await page.getByRole("tab", { name: "Workbench", exact: true }).click();
	await page.evaluate(async () => {
		return await (
			window as unknown as {
				__diagnosticCaptureTest: { resolve: (prefix: string) => Promise<void> };
			}
		).__diagnosticCaptureTest.resolve("late-reconnect-A");
	});
	await expect(page.getByText("testing · stale reconnect probe", { exact: true })).toHaveCount(0);
	await expect(page.getByText(/late-reconnect-A/)).toHaveCount(0);
	await expect(
		page.getByText("testing · Manual note remains local", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("testing · Engine diagnostic snapshot", { exact: true }),
	).toHaveCount(1);
});

test("diagnostic capture is discarded after an in-place session and instance change", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "System", exact: true }).click();
	await expect(page).toHaveURL(/\/system\/instance$/);
	await page.getByRole("button", { name: "Disconnect", exact: true }).click();
	await expect(page.getByLabel("Operator credential file")).toBeVisible();
	await page.getByLabel("Operator credential file").fill("controlled/mock-operator.json");
	await page.getByRole("button", { name: "Open session", exact: true }).click();
	await expect(page.getByText("Session open", { exact: false })).toBeVisible();
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await page.getByRole("tab", { name: "Workbench", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${profileA}/reasoning/workbench$`));
	const profileId = profileA.split("/")[2];
	const previousTimestamp = await page.evaluate(
		(profile) =>
			(
				window as unknown as {
					__diagnosticCaptureTest: { sessionTimestamp: (id: string) => number | null };
				}
			).__diagnosticCaptureTest.sessionTimestamp(profile),
		profileId,
	);
	await page.getByLabel("Note intent", { exact: true }).fill("stale in-place session probe");
	await page.evaluate(() => {
		(
			window as unknown as {
				__diagnosticCaptureTest: { defer: () => void };
			}
		).__diagnosticCaptureTest.defer();
	});
	await page.getByRole("button", { name: "Capture engine diagnostics", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as {
						__diagnosticCaptureTest: { pending: () => number };
					}
				).__diagnosticCaptureTest.pending(),
			),
		)
		.toBe(4);
	const captureCalls = await page.evaluate(() =>
		(
			window as unknown as {
				__diagnosticCaptureTest: { calls: () => string[] };
			}
		).__diagnosticCaptureTest.calls(),
	);
	expect(captureCalls.slice().sort()).toEqual(
		["rrd_capabilities", "rrd_database", "rrd_storage", "rrd_vector_collections"]
			.map((command) => `${command}:${profileId}`)
			.sort(),
	);
	const pageUrl = page.url();
	await page.evaluate(
		(instance) =>
			(
				window as unknown as {
					__diagnosticCaptureTest: { setHandshakeInstance: (value: string) => void };
				}
			).__diagnosticCaptureTest.setHandshakeInstance(instance),
		"diagnostic-profile-a-v2",
	);
	await page.getByRole("button", { name: "Reconnect", exact: true }).click();
	await expect(page.getByText("diagnostic-profile-a-v2", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Open session", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "Open session", exact: true }).click();
	await expect(page).toHaveURL(pageUrl);
	await expect(
		page.getByRole("heading", { name: "Prompt workbench", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Refresh flights", exact: true })).toBeEnabled();
	const currentTimestamp = await page.evaluate(
		(profile) =>
			(
				window as unknown as {
					__diagnosticCaptureTest: { sessionTimestamp: (id: string) => number | null };
				}
			).__diagnosticCaptureTest.sessionTimestamp(profile),
		profileId,
	);
	expect(currentTimestamp).not.toBe(previousTimestamp);
	const currentInstance = await page.evaluate(
		(profile) =>
			(
				window as unknown as {
					__diagnosticCaptureTest: { sessionInstance: (id: string) => string | null };
				}
			).__diagnosticCaptureTest.sessionInstance(profile),
		profileId,
	);
	expect(currentInstance).toBe("diagnostic-profile-a-v2");
	const transitionCalls = await page.evaluate(() =>
		(
			window as unknown as {
				__diagnosticCaptureTest: { calls: () => string[] };
			}
		).__diagnosticCaptureTest.calls(),
	);
	expect(transitionCalls.map((call) => call.split(":")[0])).toContain("rrd_disconnect");
	expect(transitionCalls.map((call) => call.split(":")[0])).toContain("rrd_connect");
	const stillPending = await page.evaluate(() =>
		(
			window as unknown as {
				__diagnosticCaptureTest: { pendingCommands: () => string[] };
			}
		).__diagnosticCaptureTest.pendingCommands(),
	);
	expect(stillPending.slice(0, 4).sort()).toEqual([
		"rrd_capabilities",
		"rrd_database",
		"rrd_storage",
		"rrd_vector_collections",
	]);
	await page.evaluate(async () => {
		return await (
			window as unknown as {
				__diagnosticCaptureTest: { resolve: (prefix: string) => Promise<void> };
			}
		).__diagnosticCaptureTest.resolve("late-in-place-session");
	});
	await expect(
		page.getByText("testing · stale in-place session probe", { exact: true }),
	).toHaveCount(0);
	await expect(page.getByText(/late-in-place-session/)).toHaveCount(0);
	await expect(
		page.getByText("testing · Manual note remains local", { exact: true }),
	).toBeVisible();
});

test("diagnostic capture is invalidated when the selected local workbench changes away and back", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByLabel("Workbench name", { exact: true }).fill("Alternate local workbench");
	await page.getByRole("button", { name: "Create local workbench", exact: true }).click();
	await page.getByLabel("Note intent", { exact: true }).fill("Alternate workbench note");
	await page.getByRole("button", { name: "Save local note", exact: true }).click();
	await expect(
		page.getByText("testing · Alternate workbench note", { exact: true }),
	).toBeVisible();
	await page.getByRole("textbox", { name: "Local workbench", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic lifecycle" }).click();
	await page.getByLabel("Note intent", { exact: true }).fill("stale workbench-generation probe");
	await page.evaluate(() => {
		(
			window as unknown as {
				__diagnosticCaptureTest: { defer: () => void };
			}
		).__diagnosticCaptureTest.defer();
	});
	await page.getByRole("button", { name: "Capture engine diagnostics", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as {
						__diagnosticCaptureTest: { pending: () => number };
					}
				).__diagnosticCaptureTest.pending(),
			),
		)
		.toBe(4);
	const pageUrl = page.url();
	await page.getByRole("textbox", { name: "Local workbench", exact: true }).click();
	await page.getByRole("option", { name: "Alternate local workbench" }).click();
	await expect(page.getByRole("textbox", { name: "Local workbench", exact: true })).toHaveValue(
		"Alternate local workbench",
	);
	await page.getByRole("textbox", { name: "Local workbench", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic lifecycle" }).click();
	await expect(page.getByRole("textbox", { name: "Local workbench", exact: true })).toHaveValue(
		"Diagnostic lifecycle",
	);
	await expect(page).toHaveURL(pageUrl);
	await expect(
		page.getByRole("heading", { name: "Prompt workbench", exact: true }),
	).toBeVisible();
	const calls = await page.evaluate(() =>
		(
			window as unknown as {
				__diagnosticCaptureTest: { calls: () => string[] };
			}
		).__diagnosticCaptureTest.calls(),
	);
	expect(calls.map((call) => call.split(":")[0]).sort()).toEqual([
		"rrd_capabilities",
		"rrd_database",
		"rrd_storage",
		"rrd_vector_collections",
	]);
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as {
						__diagnosticCaptureTest: { pending: () => number };
					}
				).__diagnosticCaptureTest.pending(),
			),
		)
		.toBe(4);
	await page.evaluate(async () => {
		return await (
			window as unknown as {
				__diagnosticCaptureTest: { resolve: (prefix: string) => Promise<void> };
			}
		).__diagnosticCaptureTest.resolve("late-workbench-A");
	});
	await expect(
		page.getByText("testing · stale workbench-generation probe", { exact: true }),
	).toHaveCount(0);
	await expect(page.getByText(/late-workbench-A/)).toHaveCount(0);
	await expect(
		page.getByText("testing · Manual note remains local", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("testing · Alternate workbench note", { exact: true }),
	).toBeVisible();
});

test("diagnostic capture does not write into either profile after switching projects", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("textbox", { name: "Selected project", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic Profile B" }).click();
	await expect(page).toHaveURL(new RegExp(`${profileB}/reasoning/workbench$`));
	await expect(page.getByText("diagnostic-profile-b", { exact: true })).toBeVisible();
	await page.getByLabel("Workbench name", { exact: true }).fill("Profile B notes");
	await page.getByRole("button", { name: "Create local workbench", exact: true }).click();
	await page.getByLabel("Note intent", { exact: true }).fill("Profile B manual note");
	await page.getByRole("button", { name: "Save local note", exact: true }).click();
	await expect(page.getByText("testing · Profile B manual note", { exact: true })).toBeVisible();
	await page.getByRole("textbox", { name: "Selected project", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic Profile A" }).click();
	await expect(page).toHaveURL(new RegExp(`${profileA}/reasoning/workbench$`));
	await expect(page.getByText("diagnostic-profile-a", { exact: true })).toBeVisible();
	await page.getByLabel("Note intent", { exact: true }).fill("stale profile-switch probe");
	await page.evaluate(() => {
		(
			window as unknown as {
				__diagnosticCaptureTest: { defer: () => void };
			}
		).__diagnosticCaptureTest.defer();
	});
	await page.getByRole("button", { name: "Capture engine diagnostics", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as {
						__diagnosticCaptureTest: { pending: () => number };
					}
				).__diagnosticCaptureTest.pending(),
			),
		)
		.toBe(4);
	await page.getByRole("textbox", { name: "Selected project", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic Profile B" }).click();
	await expect(page).toHaveURL(new RegExp(`${profileB}/reasoning/workbench$`));
	await page.evaluate(async () => {
		return await (
			window as unknown as {
				__diagnosticCaptureTest: { resolve: (prefix: string) => Promise<void> };
			}
		).__diagnosticCaptureTest.resolve("late-profile-A");
	});
	await expect(page.getByText("testing · Profile B manual note", { exact: true })).toBeVisible();
	await expect(
		page.getByText("testing · stale profile-switch probe", { exact: true }),
	).toHaveCount(0);
	await expect(page.getByText(/late-profile-A/)).toHaveCount(0);
	await page.getByRole("textbox", { name: "Selected project", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic Profile A" }).click();
	await expect(page).toHaveURL(new RegExp(`${profileA}/reasoning/workbench$`));
	await expect(
		page.getByText("testing · stale profile-switch probe", { exact: true }),
	).toHaveCount(0);
	await expect(page.getByText(/late-profile-A/)).toHaveCount(0);
	await expect(
		page.getByText("testing · Manual note remains local", { exact: true }),
	).toBeVisible();
});

test("renders the Connectome overview from the production bundle", async ({ page }, testInfo) => {
	const pageErrors: Error[] = [];
	page.on("pageerror", (error) => pageErrors.push(error));

	await page.goto("/", { waitUntil: "domcontentloaded" });
	// Chromium starts with its pointer at the top-left edge, which activates the
	// expandable navigation rail. Move into the content before visual evidence.
	await page.mouse.move(1279, 360);

	await expect(page).toHaveTitle("Connectome");
	await expect(page.getByText("RRFlow instances", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Connect instance" })).toBeVisible();

	await testInfo.attach("connectome-overview", {
		body: await page.screenshot({ fullPage: true }),
		contentType: "image/png",
	});

	expect(
		pageErrors,
		pageErrors.map((error) => error.stack ?? error.message).join("\n\n"),
	).toEqual([]);
});

test("creates an RRD HTTP runtime profile by default", async ({ page }, testInfo) => {
	const pageErrors: Error[] = [];
	const requests: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error));
	await page.route(/http:\/\/localhost:947[78]\/v1\//, async (route) => {
		const path = new URL(route.request().url()).pathname;
		requests.push(path);
		const payload =
			path === "/v1/health/live"
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
								configuration_sha256:
									"bf8a4557c1465ab4bf0e8640be42f65b28e4d65dff5f3147b2892edfe9db31be",
							},
							instance: {
								kind: "instance",
								id:
									new URL(route.request().url()).port === "9478"
										? "rrd-project-b"
										: "rrd-smoke",
							},
							capabilities: [
								{
									name: "context-assemble",
									contract_version: 1,
									status: "available",
								},
							],
							product_capabilities: {},
						};
		await route.fulfill({
			contentType: "application/json",
			headers: { "Access-Control-Allow-Origin": "*" },
			body: JSON.stringify({
				protocol: "rrd",
				protocol_version: 1,
				request_id: `request-${requests.length}`,
				operation_id: `operation-${requests.length}`,
				outcome: { status: "ok", payload },
			}),
		});
	});

	await page.goto("/connections/create", { waitUntil: "domcontentloaded" });

	await expect(page.getByText("Connect to RRFlow", { exact: true })).toBeVisible();
	await expect(page.getByText("RRD runtime", { exact: true })).toBeVisible();
	await expect(page.getByLabel("RRD HTTP host")).toHaveValue("localhost:9477");
	const connect = page.getByRole("button", { name: "Save & connect to RRD" });
	await expect(connect).toBeEnabled();
	await connect.click();

	await expect(page.getByText("RRD connected", { exact: true })).toBeVisible();
	await expect(page.getByText("rrd-smoke", { exact: true })).toBeVisible();
	expect(requests).toEqual(["/v1/health/live", "/v1/health/ready", "/v1/capabilities"]);
	const firstProject = new URL(page.url()).pathname;
	await expect(page.getByRole("button", { name: "Start guide", exact: true })).toBeDisabled();
	await expect(
		page.getByText("Open a session to start this guide.", { exact: true }),
	).toBeVisible();
	// Only the work pane scrolls: the areas and tabs stay on a real window's first screen.
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.getByRole("button", { name: "System", exact: true }).click();
	await expect(page).toHaveURL(/\/system\/instance$/);
	await expect(page.getByText("Verified engine identity", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Knowledge", exact: true })).toBeInViewport();
	await expect(page.getByRole("tab", { name: "API reference", exact: true })).toBeInViewport();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
		),
	).toBe(true);
	// Addresses saved before these areas still open their view.
	await page.goto(`${firstProject}/knowledge/storage`);
	await expect(page).toHaveURL(/\/system\/storage$/);
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await expect(page).toHaveURL(/\/reasoning\/tasks$/);
	await page.getByRole("tab", { name: "Workbench", exact: true }).click();
	await expect(page).toHaveURL(/\/reasoning\/workbench$/);
	await expect(
		page.getByRole("heading", { name: "Prompt workbench", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Launch observe flight", exact: true }),
	).toBeDisabled();
	await page.getByLabel("Workbench name", { exact: true }).fill("Local test notes");
	await page.getByRole("button", { name: "Create local workbench", exact: true }).click();
	await page.getByLabel("Note intent", { exact: true }).fill("Inspect graph");
	await page.getByRole("button", { name: "Save local note", exact: true }).click();
	await expect(page.getByText("testing · Inspect graph", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Capture engine diagnostics", exact: true }),
	).toBeDisabled();
	await page.getByRole("tab", { name: "Project plan", exact: true }).click();
	await expect(page).toHaveURL(/\/reasoning\/plan$/);
	await expect(page.getByRole("heading", { name: "Project plan", exact: true })).toBeVisible();
	// Browser preview has no native session; navigation keeps discovery disabled.
	await expect(page.getByRole("button", { name: "Discover jobs", exact: true })).toBeDisabled();
	await page.goto(`${firstProject}/plan`);
	await expect(page).toHaveURL(/\/reasoning\/plan$/);
	await expect(page.getByRole("heading", { name: "Project plan", exact: true })).toBeVisible();
	await page.getByRole("tab", { name: "Tasks", exact: true }).click();
	await expect(page).toHaveURL(/\/reasoning\/tasks$/);
	await expect(
		page.getByRole("alert", { name: "Tasks require a native session", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("heading", { name: "Project plan", exact: true })).toHaveCount(0);
	expect(
		requests.every((path) =>
			["/v1/health/live", "/v1/health/ready", "/v1/capabilities"].includes(path),
		),
	).toBe(true);
	await page.goto(`${firstProject}/learning`);
	await expect(page).toHaveURL(/\/overview$/);
	await page.goto("/connections/create");
	await page.getByLabel("RRD HTTP host").fill("localhost:9478");
	await page.getByRole("button", { name: "Save & connect to RRD" }).click();
	await expect(page.getByText("rrd-project-b", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Knowledge", exact: true }).click();
	await page.getByRole("textbox", { name: "Selected project", exact: true }).click();
	await page.getByRole("option").first().click();
	await expect(page).toHaveURL(`${firstProject}/knowledge/records`);
	await expect(page.getByText("rrd-smoke", { exact: true })).toBeVisible();
	await expect(page.getByText("rrd-project-b", { exact: true })).toHaveCount(0);
	await page.mouse.move(1279, 360);
	await testInfo.attach("project-knowledge-workspace", {
		body: await page.screenshot({ fullPage: true }),
		contentType: "image/png",
	});

	expect(
		pageErrors,
		pageErrors.map((error) => error.stack ?? error.message).join("\n\n"),
	).toEqual([]);
});

test("clears withheld worker output and rejects a delayed read after task context changes", async ({
	page,
}) => {
	// Load the web adapter first, then add only the native invocation bridge.
	// This keeps the test isolated from desktop startup/window APIs.
	await page.goto("/connections/create", { waitUntil: "domcontentloaded" });
	await expect(page.getByText("Connect to RRFlow", { exact: true })).toBeVisible();
	const installNativeBridge = () => {
		Object.assign(globalThis, { isTauri: true });
		const taskA = {
			id: "task-a",
			title: "Source review task",
			goal: "Review one selected source file",
			status: "open",
			cursor: "1",
		};
		const taskB = {
			id: "task-b",
			title: "Different task",
			goal: "A different source context",
			status: "open",
			cursor: "2",
		};
		const budget = {
			sha256: "b".repeat(64),
			max_steps: "2",
			max_step_elapsed_ms: "30000",
			max_run_elapsed_ms: "60000",
			reserved_steps: "0",
			charged_elapsed_ms: "0",
			started_at_unix_ms: "1000",
			deadline_unix_ms: "61000",
			active_attempt: null,
			execution_may_continue: false,
			stopped: null,
		};
		const proposal = {
			attempt_id: "proposal-1",
			task_sha256: "c".repeat(64),
			configuration_sha256: "d".repeat(64),
			controller_binding_id: "controller",
			service_id: "controller-service",
			choice: { kind: "select", binding_id: "worker", effort: "small" },
			elapsed_ms: "1",
			response_sha256: "e".repeat(64),
		};
		const workerSource = {
			contract_version: 1,
			captured_snapshot_sha256: "7".repeat(64),
			captured_read: {
				runtime_manifest_sha256: "8".repeat(64),
				runtime_cursor: "11",
				schema_revision: "1",
				catalogue_revision: "1",
			},
			project_id: "project-smoke",
			entry_identity: "3".repeat(64),
			path_sha256: "9".repeat(64),
			content_sha256: "4".repeat(64),
			policy_sha256: "a".repeat(64),
			profile_sha256: "b".repeat(64),
			captured_at_unix_ms: "12",
			validated_snapshot_sha256: "c".repeat(64),
			validated_read: {
				runtime_manifest_sha256: "d".repeat(64),
				runtime_cursor: "13",
				schema_revision: "1",
				catalogue_revision: "1",
			},
			validated_at_unix_ms: "14",
		};
		const worker = {
			attempt_id: "worker-attempt",
			selection_attempt_id: "proposal-1",
			binding_id: "worker",
			service_id: "worker-service",
			content: "SOURCE_DERIVED_PRIVATE_DRAFT",
			content_sha256: "f".repeat(64),
			response_sha256: "1".repeat(64),
			task_sha256: "c".repeat(64),
			configuration_sha256: "d".repeat(64),
			elapsed_ms: "1",
			source: workerSource,
		};
		let workCount = 0;
		let lastWorkAttempt = "worker-attempt";
		let attemptCount = 0;
		let configured = false;
		const invoked: string[] = [];
		let resolveDelayedWork: ((value: unknown) => void) | null = null;
		let resolveDelayed: ((value: unknown) => void) | null = null;
		Object.assign(window, {
			__sourceWorkerTest: {
				attemptCount: () => attemptCount,
				invoked: () => invoked,
				workCount: () => workCount,
				worker: () => ({ ...worker, attempt_id: lastWorkAttempt }),
				resolveWork: (value: unknown) => resolveDelayedWork?.(value),
				resolveDelayed: (value: unknown) => resolveDelayed?.(value),
			},
		});
		Object.defineProperty(window, "__TAURI_INTERNALS__", {
			configurable: true,
			value: {
				invoke: async (
					command: string,
					args: { request?: { action?: string; attempt_id?: string } },
				) => {
					invoked.push(`${command}:${args.request?.action ?? ""}`);
					if (command === "rrd_session")
						return {
							endpoint: "http://localhost:9477",
							instance: "rrd-smoke",
							principal: "smoke-principal",
							connected_at_unix_ms: 1,
							session: { idle_timeout_ms: 60000, absolute_timeout_ms: 3600000 },
							service: {
								implementation: "rrflow",
								implementation_version: "1.0.0",
								instance: "rrd-smoke",
								deployment_form: "single_node_server",
								storage_profile: "rrflow_kv",
								endpoint_presentation: "loopback_http_websocket",
								installed_estate: null,
								configuration_revision: 1,
								configuration_sha256: "2".repeat(64),
								capabilities: [],
							},
						};
					if (command === "rrd_database")
						return {
							observed_at_unix_ms: 1,
							runtime_cursor: 1,
							schema_revision: null,
							tables: [],
							models: [],
							graph: {
								valid_at_unix_ms: 1,
								known_at_cursor: 1,
								nodes: [],
								edges: [],
								clusters: [],
							},
							sections: [],
						};
					if (command === "rrd_vector_collections") return { collections: [] };
					if (command !== "rrd_task") throw new Error(`Unexpected command ${command}`);
					switch (args.request?.action) {
						case "list":
							return {
								kind: "page",
								tasks: [taskA, taskB],
								truncated: false,
								next_cursor: "0",
							};
						case "budget":
							return { kind: "budget", budget: configured ? budget : null };
						case "configure":
							configured = true;
							return { kind: "budget", budget };
						case "prepare":
							return {
								kind: "prepared",
								task: taskA,
								task_sha256: proposal.task_sha256,
								configuration_sha256: proposal.configuration_sha256,
								controller: "controller",
								candidates: ["worker"],
								wait_timeout_ms: "1000",
								unavailable: null,
							};
						case "propose":
							return { kind: "proposal", proposal };
						case "sources":
							return {
								kind: "sources",
								inventory: {
									entries: [
										{
											entry_identity: "3".repeat(64),
											path: "src/private.txt",
											content_sha256: "4".repeat(64),
											bytes: "24",
										},
									],
									read_cursor: "9",
									read_manifest_sha256: "5".repeat(64),
									result_identity_version: 2,
									truncated: false,
									incomplete_rows: 0,
									unavailable_rows: 0,
									oversized_rows: 0,
								},
							};
						case "prepare_worker":
							return {
								kind: "worker_prepared",
								review: {
									selection_attempt_id: "proposal-1",
									selection_sha256: "6".repeat(64),
									task_sha256: proposal.task_sha256,
									configuration_sha256: proposal.configuration_sha256,
									binding_id: "worker",
									effort: "small",
									wait_timeout_ms: "1000",
									source: {
										request: {
											contract_version: 1,
											entry_identity: "3".repeat(64),
											expected_content_sha256: "4".repeat(64),
											maximum_input_bytes: 24,
										},
										path: "src/private.txt",
										bytes: "24",
										read_cursor: "9",
										read_manifest_sha256: "5".repeat(64),
										result_identity_version: 2,
									},
								},
							};
						case "work":
							workCount += 1;
							lastWorkAttempt = args.request?.attempt_id ?? "missing-attempt-id";
							if (workCount === 1) {
								return new Promise((resolve) => {
									resolveDelayedWork = resolve;
								});
							}
							return {
								kind: "worker",
								worker: { ...worker, attempt_id: lastWorkAttempt },
							};
						case "attempt":
							attemptCount += 1;
							if (attemptCount === 2) {
								return {
									kind: "attempt",
									status: "reserved",
									proposal,
									worker: null,
								};
							}
							if (attemptCount === 5) {
								throw new Error("Selected-source authorization is unavailable");
							}
							if (attemptCount >= 7) {
								return new Promise((resolve) => {
									resolveDelayed = resolve;
								});
							}
							if (attemptCount === 6) {
								return {
									kind: "attempt",
									status: "accepted",
									proposal,
									worker: { ...worker, attempt_id: lastWorkAttempt },
								};
							}
							return { kind: "attempt", status: "accepted", proposal, worker: null };
						default:
							throw new Error(`Unexpected task action ${args.request?.action}`);
					}
				},
			},
		});
	};
	await page.route(/http:\/\/localhost:9477\/v1\//, async (route) => {
		const path = new URL(route.request().url()).pathname;
		const payload =
			path === "/v1/health/live"
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
								configuration_sha256: "2".repeat(64),
							},
							instance: { kind: "instance", id: "rrd-smoke" },
							capabilities: [],
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

	await page.getByRole("button", { name: "Save & connect to RRD" }).click();
	await expect(page.getByText("RRD connected", { exact: true })).toBeVisible();
	await page.evaluate(installNativeBridge);
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await expect(page).toHaveURL(/\/reasoning\/tasks$/);
	await expect
		.poll(() =>
			page.evaluate(() => (globalThis as typeof globalThis & { isTauri?: boolean }).isTauri),
		)
		.toBe(true);
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as { __sourceWorkerTest: { invoked: () => string[] } }
				).__sourceWorkerTest.invoked(),
			),
		)
		.toContain("rrd_session:");
	await page.getByRole("button", { name: "Read tasks" }).click();
	await page.getByRole("button", { name: /Source review task/ }).click();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await page.getByLabel("Maximum steps").fill("2");
	await page.getByLabel("Maximum step time (ms)").fill("30000");
	await page.getByLabel("Maximum run time (ms)").fill("60000");
	await page.getByRole("button", { name: "Configure task budget" }).click();
	await page.getByRole("button", { name: "Review controller inputs" }).click();
	await page.getByRole("button", { name: "Request one experimental proposal" }).click();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await expect(
		page.getByText("Attempt read; no worker output is available to this session."),
	).toBeVisible();
	await page.getByRole("button", { name: "Read project source inventory" }).click();
	await page.getByRole("textbox", { name: "Optional project file" }).click();
	await page.getByRole("option", { name: /src\/private.txt/ }).click();
	await page.getByRole("button", { name: "Review worker and selected source" }).click();
	await page.getByLabel(/I approve sending this selected file/).check();
	await page.getByRole("button", { name: "Request worker draft" }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as { __sourceWorkerTest: { workCount: () => number } }
				).__sourceWorkerTest.workCount(),
			),
		)
		.toBe(1);
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as { __sourceWorkerTest: { attemptCount: () => number } }
				).__sourceWorkerTest.attemptCount(),
			),
		)
		.toBe(2);
	await page.evaluate(() => {
		const testState = (
			window as unknown as {
				__sourceWorkerTest: {
					resolveWork: (value: unknown) => void;
					worker: () => unknown;
				};
			}
		).__sourceWorkerTest;
		testState.resolveWork({ kind: "worker", worker: testState.worker() });
	});
	await expect(
		page.getByText("Waiting for the engine. Budget reads and Stop remain available."),
	).toHaveCount(0);
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toHaveCount(0);
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await expect(
		page.getByText("Attempt read; no worker output is available to this session."),
	).toBeVisible();

	// Engine readback withholds the retained output. The UI must clear its prior
	// copy immediately and must not reconstruct it from the proposal or cache.
	await page.getByRole("button", { name: "Review worker and selected source" }).click();
	await page.getByLabel(/I approve sending this selected file/).check();
	await page.getByRole("button", { name: "Request worker draft" }).click();
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toBeVisible();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toHaveCount(0);
	await expect(
		page.getByText("Attempt read; no worker output is available to this session."),
	).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as { __sourceWorkerTest: { attemptCount: () => number } }
				).__sourceWorkerTest.attemptCount(),
			),
		)
		.toBe(4);

	await page.getByRole("button", { name: "Review worker and selected source" }).click();
	await page.getByLabel(/I approve sending this selected file/).check();
	await page.getByRole("button", { name: "Request worker draft" }).click();
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toBeVisible();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as { __sourceWorkerTest: { attemptCount: () => number } }
				).__sourceWorkerTest.attemptCount(),
			),
		)
		.toBe(5);
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toHaveCount(0);
	await expect(
		page.getByText(
			"Attempt access could not be confirmed; the result may not be authorized or available.",
		),
	).toBeVisible();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toBeVisible();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as { __sourceWorkerTest: { attemptCount: () => number } }
				).__sourceWorkerTest.attemptCount(),
			),
		)
		.toBe(7);
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toHaveCount(0);
	await page.getByRole("button", { name: /Different task/ }).click();
	await page.evaluate(() => {
		const testState = (
			window as unknown as {
				__sourceWorkerTest: {
					resolveDelayed: (value: unknown) => void;
					worker: () => unknown;
				};
			}
		).__sourceWorkerTest;
		testState.resolveDelayed({
			kind: "attempt",
			status: "accepted",
			proposal: null,
			worker: testState.worker(),
		});
	});
	await expect(page.getByRole("heading", { name: "Different task" })).toBeVisible();
	await expect(page.getByText("SOURCE_DERIVED_PRIVATE_DRAFT")).toHaveCount(0);
});

test("explains the local database and keeps native startup explicit", async ({
	page,
}, testInfo) => {
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await expect(page.getByText("Your AI data, running locally", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Start local RRFlow", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "How RRFlow fits together", exact: true }).click();
	await expect(page.getByText("rrflowDB - Your data", { exact: true })).toBeVisible();
	await expect(page.getByText("rrflowQL - Your questions", { exact: true })).toBeVisible();
	await expect(page.getByText("rrflowKV - Your persistence", { exact: true })).toBeVisible();
	await testInfo.attach("local-learning-guide", {
		body: await page.screenshot({ fullPage: true }),
		contentType: "image/png",
	});
});

test("an unknown project link returns safely to the overview", async ({ page }) => {
	const errors: Error[] = [];
	page.on("pageerror", (error) => errors.push(error));
	await page.goto("/runtime/missing-profile/knowledge/records");
	await expect(page.getByText("RRFlow instances", { exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

test("workbench lanes save a template and generate a checklist that claims only what it checked", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("textbox", { name: "Workbench lane", exact: true }).click();
	await page.getByRole("option", { name: "Dataset authoring", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Dataset templates (0–5 steps)", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("heading", { name: "Prompt workbench", exact: true })).toHaveCount(
		0,
	);
	await page.getByLabel("Template name", { exact: true }).fill("Real project retrieval");
	await page
		.getByLabel("Minimum requirements (one per line)", { exact: true })
		.fill("Data source authorized\nPrompt set hash captured");
	await page.getByRole("button", { name: "Save template", exact: true }).click();
	await expect(page.getByText("Real project retrieval", { exact: true }).first()).toBeVisible();
	const checklistDownload = page.waitForEvent("download", {
		predicate: (download) => download.suggestedFilename().endsWith("execution-checklist.json"),
	});
	await page.getByLabel("Run label", { exact: true }).fill("smoke run");
	await page.getByRole("button", { name: "Generate dataset files", exact: true }).click();
	const checklistPath = await (await checklistDownload).path();
	const checklist = JSON.parse(readFileSync(checklistPath, "utf8")) as {
		unsatisfiedRequiredChecks: number;
		checks: { id: string; required: boolean; status: { kind: string } }[];
	};
	expect(checklist.unsatisfiedRequiredChecks).toBe(0);
	expect(checklist.checks.map((check) => [check.id, check.status.kind])).toEqual([
		["dataset-template-selected", "satisfied"],
		["remote-source-availability", "satisfied"],
		["controller-contract-explicit", "not-evaluated"],
		["cold-trigger-invariant", "not-evaluated"],
		["comparable-workload-targets", "not-evaluated"],
	]);
	expect(JSON.stringify(checklist)).not.toContain('"passed"');
	await expect(
		page.getByText("Real project retrieval · Real project baseline · smoke run", {
			exact: true,
		}),
	).toBeVisible();
	await page.getByRole("textbox", { name: "Workbench lane", exact: true }).click();
	await page.getByRole("option", { name: "Prompt workbench", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Prompt workbench", exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("testing · Generated benchmark workload bundle (Real project baseline)", {
			exact: true,
		}),
	).toBeVisible();
});

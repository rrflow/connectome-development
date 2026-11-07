import { expect, test } from "@playwright/test";

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

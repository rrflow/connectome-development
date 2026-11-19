import { expect, type Page, test } from "@playwright/test";

/**
 * The project manager on the desktop adapter, with the native side replaced by
 * a registry that behaves as `src-tauri/src/rrd/engram/lifecycle.rs` does:
 * it numbers every transition, sends each as an `engram:lifecycle` event and
 * answers status reads. The bundle under test is the production build; only
 * the Tauri bridge is stood in for, before the app loads, so the app chooses
 * its desktop adapter.
 */

interface Call {
	command: string;
	args: Record<string, any>;
}

/**
 * Where a start can be made to wait: before the native side reports anything,
 * while the engine is starting, or after it reported ready and before the
 * start command returns.
 */
type Phase = "before" | "serve" | "ready";

interface Bridge {
	calls: Call[];
	/** Projects whose start is waiting now, until `release`. */
	held: Record<string, () => void>;
	hold(project: string, phase?: Phase): void;
	release(project: string): void;
	/** Makes stopping `project` fail with `message`. */
	failStop(project: string, message: string): void;
	/** Makes saving the configuration fail with `message`; null lets it save again. */
	failSave(message: string | null): void;
	savedConfig(): {
		connections: { id: string; name: string; runtimeProject?: string }[];
	} | null;
}

const PLAN_SHA256 = "a".repeat(64);
const IDENTITY = "b".repeat(64);

async function installDesktop(page: Page, uninstalled: string[] = []) {
	await page.addInitScript(
		({ uninstalled, planSha256, identity }) => {
			const callbacks: Record<number, (event: unknown) => void> = {};
			const listeners: Record<string, number[]> = {};
			let nextCallback = 1;
			// The native side outlives a page load, so its state is kept across one.
			const kept = JSON.parse(sessionStorage.getItem("smoke-native") ?? "{}");
			let revision: number = kept.revision ?? 0;
			let port = 4100 + revision;
			let savedConfig: string | null = kept.savedConfig ?? null;
			const instances: Record<string, any> = kept.instances ?? {};
			const keep = () =>
				sessionStorage.setItem(
					"smoke-native",
					JSON.stringify({ revision, savedConfig, instances }),
				);
			const waiting: Record<string, boolean> = {};
			const stopFailures: Record<string, string> = {};
			let saveFailure: string | null = null;
			const pause = async (project: string, phase: string) => {
				if (!waiting[`${project}:${phase}`]) return;
				delete waiting[`${project}:${phase}`];
				await new Promise<void>((done) => {
					bridge.held[project] = done;
				});
			};
			const emit = (event: string, payload: unknown) => {
				for (const id of listeners[event] ?? []) callbacks[id]?.({ event, id, payload });
			};
			const transition = (project: string, state: string, extra: object = {}) => {
				revision++;
				const view = {
					project,
					state,
					origin: "connectome",
					detail: state === "ready" ? "Serving." : `The project is ${state}.`,
					revision,
					...extra,
				};
				if (state === "stopped") delete instances[project];
				else instances[project] = view;
				keep();
				emit("engram:lifecycle", view);
				return view;
			};
			const name = (project: string) => project.split(/[\\/]/).filter(Boolean).at(-1);
			const engram = (project: string) => ({
				project,
				endpoint: `http://127.0.0.1:${port++}`,
				instance: `instance-${name(project)}`,
				credential_path: `${project}\\.rrflow\\credentials\\local-operator.json`,
				installed: false,
				origin: "connectome",
			});
			const bridge: Bridge = {
				calls: [],
				held: {},
				hold: (project, phase = "serve") => {
					waiting[`${project}:${phase}`] = true;
				},
				release: (project) => {
					const done = bridge.held[project];
					delete bridge.held[project];
					done?.();
				},
				failStop: (project, message) => {
					stopFailures[project] = message;
				},
				failSave: (message) => {
					saveFailure = message;
				},
				savedConfig: () => (savedConfig === null ? null : JSON.parse(savedConfig)),
			};
			const stop = (project: string) => {
				if (stopFailures[project]) throw { message: stopFailures[project] };
				if (!instances[project]) return false;
				const owned = instances[project].state === "ready";
				transition(project, "stopped", { detail: "Stopped by Connectome." });
				return owned;
			};
			const commands: Record<string, (args: any) => unknown> = {
				"plugin:event|listen": ({ event, handler }) => {
					listeners[event] = [...(listeners[event] ?? []), handler];
					return handler;
				},
				load_config: () => savedConfig ?? "{}",
				save_config: ({ config }) => {
					if (saveFailure) throw { message: saveFailure };
					savedConfig = config;
					keep();
					return null;
				},
				get_opened_resources: () => [],
				rrd_engram_status: () => ({ revision, instances: Object.values(instances) }),
				rrd_engram_preview: ({ request }) => {
					const pending = uninstalled.includes(request.project);
					return {
						project: request.project,
						mode: pending ? "existing" : null,
						engine: { path: "rrflow.exe", source: "sidecar", sha256: "c".repeat(64) },
						installation: pending
							? {
									installation: {
										plan_sha256: planSha256,
										managed_paths: [{ relative_path: ".rrflow" }],
										bootstrap: {
											project_policy: "preserve_project_owned_state",
										},
									},
								}
							: null,
						installation_identity: pending ? identity : null,
					};
				},
				rrd_engram_serve: async ({ request }) => {
					const { project } = request;
					await pause(project, "before");
					transition(project, "starting", { stage: "serve" });
					await pause(project, "serve");
					const view = engram(project);
					transition(project, "ready", { engram: view });
					await pause(project, "ready");
					return view;
				},
				rrd_engram_stop: ({ project }) => stop(project),
				rrd_engram_forget: ({ project }) => stop(project),
				rrd_connect: () => {
					throw { message: "this smoke registry serves no data" };
				},
			};
			Object.assign(globalThis, {
				isTauri: true,
				__projects: bridge,
				__TAURI_OS_PLUGIN_INTERNALS__: {
					arch: "x86_64",
					os_type: "windows",
					platform: "windows",
					family: "windows",
					version: "10.0",
					exe_extension: "exe",
					eol: "\r\n",
				},
				__TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
				__TAURI_INTERNALS__: {
					metadata: {
						currentWindow: { label: "connectome-main" },
						currentWebview: {
							label: "connectome-main",
							windowLabel: "connectome-main",
						},
					},
					transformCallback: (callback: (event: unknown) => void) => {
						callbacks[nextCallback] = callback;
						return nextCallback++;
					},
					invoke: async (command: string, args: Record<string, any> = {}) => {
						bridge.calls.push({ command, args });
						return commands[command]?.(args) ?? null;
					},
				},
			});
		},
		{ uninstalled, planSha256: PLAN_SHA256, identity: IDENTITY },
	);
}

type BridgeWindow = typeof globalThis & { __projects: Bridge };

const calls = (page: Page, command: string) =>
	page.evaluate(
		(command) =>
			(globalThis as BridgeWindow).__projects.calls
				.filter((call) => call.command === command)
				.map((call) => call.args),
		command,
	);

const dialog = (page: Page) => page.getByRole("dialog", { name: "Project engines" });
const row = (page: Page, name: string) =>
	dialog(page).locator(`[data-testid="project-row"][data-project="${name}"]`);
const button = (page: Page, project: string, name: string) =>
	row(page, project).getByRole("button", { name, exact: true });

async function openManager(page: Page) {
	if (await dialog(page).isVisible()) return;
	await page.getByRole("button", { name: "Manage project engines" }).first().click();
	await expect(dialog(page)).toBeVisible();
}

const hold = (page: Page, project: string, phase: Phase = "serve") =>
	page.evaluate(
		([project, phase]) => (globalThis as BridgeWindow).__projects.hold(project, phase),
		[project, phase] as const,
	);

/** Lets a held start go on, once it has reached the point it was held at. */
async function release(page: Page, project: string) {
	await expect
		.poll(() =>
			page.evaluate(
				(project) => project in (globalThis as BridgeWindow).__projects.held,
				project,
			),
		)
		.toBe(true);
	await page.evaluate(
		(project) => (globalThis as BridgeWindow).__projects.release(project),
		project,
	);
}

const savedConnections = async (page: Page) =>
	(await page.evaluate(() => (globalThis as BridgeWindow).__projects.savedConfig()))
		?.connections ?? [];

const removeBlocked = (state: string) =>
	`Remove is available once this project has finished ${state}.`;

async function addProject(page: Page, folder: string) {
	await openManager(page);
	await dialog(page).getByLabel("Project directory").fill(folder);
	await dialog(page).getByRole("button", { name: "Add project", exact: true }).click();
}

test("adding a project asks for a folder only, shows the plan, then installs, starts, saves and opens it", async ({
	page,
}) => {
	const folder = "D:\\work\\alpha";
	await installDesktop(page, [folder]);
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Start local RRFlow", exact: true }).click();
	await expect(dialog(page)).toBeVisible();
	await expect(dialog(page).getByText(/Up to \d|authenticated connections/)).toHaveCount(0);
	await expect(dialog(page).getByText("Project mode")).toHaveCount(0);
	await expect(dialog(page).getByText("Endpoint credential mapping (optional)")).toBeHidden();

	await addProject(page, folder);
	// Listed at once, with its real state, and its installation on its own row.
	await expect(row(page, "alpha").getByText("Not installed yet")).toBeVisible();
	await expect(row(page, "alpha").getByText("What installing does")).toBeVisible();
	const [preview] = await calls(page, "rrd_engram_preview");
	expect(preview.request.project).toBe(folder);
	expect(preview.request.mode, "the folder decides the mode, not the form").toBeUndefined();
	expect(await calls(page, "rrd_engram_serve")).toHaveLength(0);

	await button(page, "alpha", "Install and open RRFlow").click();
	await expect(page).toHaveURL(/\/runtime\//);
	await expect(dialog(page)).toBeHidden();
	const [serve] = await calls(page, "rrd_engram_serve");
	expect(serve.request).toMatchObject({
		project: folder,
		mode: "existing",
		accepted_plan_sha256: PLAN_SHA256,
		installation_identity: IDENTITY,
	});
	const saved = await page.evaluate(() => (globalThis as BridgeWindow).__projects.savedConfig());
	expect(saved?.connections.map((connection) => connection.runtimeProject)).toEqual([folder]);

	await openManager(page);
	await expect(row(page, "alpha").getByText("Running", { exact: true })).toBeVisible();
	await expect(button(page, "alpha", "Open project")).toBeEnabled();
});

test("one project's action never disables another project, the add form or closing the dialog", async ({
	page,
}) => {
	const [alpha, beta, gamma] = ["D:\\work\\alpha", "D:\\work\\beta", "D:\\work\\gamma"];
	await installDesktop(page);
	await page.goto("/", { waitUntil: "domcontentloaded" });
	// An installed project is simply started and opened.
	await addProject(page, alpha);
	await expect(page).toHaveURL(/\/runtime\//);
	await expect(dialog(page)).toBeHidden();

	await hold(page, beta);
	await addProject(page, beta);
	await expect(row(page, "beta").getByText("Starting the engine")).toBeVisible();
	// Remove cannot be used yet; it stays reachable and says why.
	await expect(button(page, "beta", "Remove project")).toBeDisabled();
	await expect(button(page, "beta", "Remove project")).toHaveAccessibleDescription(
		removeBlocked("starting"),
	);
	await button(page, "beta", "Remove project").focus();
	await expect(button(page, "beta", "Remove project")).toBeFocused();
	await expect(dialog(page).getByRole("group", { name: "beta", exact: true })).toBeVisible();

	// Alpha, the add form and the dialog itself are untouched by beta's start.
	await expect(button(page, "alpha", "Open project")).toBeEnabled();
	await expect(button(page, "alpha", "Stop this engine")).toBeEnabled();
	await expect(button(page, "alpha", "Remove project")).toBeEnabled();
	await expect(dialog(page).getByLabel("Project directory")).toBeEnabled();
	await expect(
		dialog(page).getByRole("button", { name: "Add project", exact: true }),
	).toBeEnabled();
	await page.keyboard.press("Escape");
	await expect(dialog(page)).toBeHidden();
	await openManager(page);

	// A failure is shown on the row it belongs to, and only there.
	await page.evaluate(
		(alpha) =>
			(globalThis as BridgeWindow).__projects.failStop(alpha, "cannot stop owned engine"),
		alpha,
	);
	await button(page, "alpha", "Stop this engine").click();
	await expect(row(page, "alpha").getByText("cannot stop owned engine")).toBeVisible();
	await expect(dialog(page).getByText("cannot stop owned engine")).toHaveCount(1);
	await expect(row(page, "beta").getByRole("alert")).toHaveCount(0);
	await expect(button(page, "alpha", "Stop this engine")).toBeEnabled();

	// Two starts in flight move the person once at most. A start that is no
	// longer the one being waited for is saved and listed, and opens nothing.
	await hold(page, gamma);
	await addProject(page, gamma);
	await expect(row(page, "gamma").getByText("Starting the engine")).toBeVisible();
	const openBefore = page.url();
	await release(page, beta);
	await expect(row(page, "beta").getByText("Running", { exact: true })).toBeVisible();
	await expect(button(page, "beta", "Open project")).toBeEnabled();
	await expect
		.poll(async () =>
			(await savedConnections(page)).map((connection) => connection.runtimeProject),
		)
		.toEqual([alpha, beta]);
	expect(page.url(), "beta finished without moving the person").toBe(openBefore);
	await expect(dialog(page)).toBeVisible();
	await expect(button(page, "gamma", "Remove project")).toBeDisabled();

	// The start asked for last opens its project.
	await release(page, gamma);
	await expect(dialog(page)).toBeHidden();
	const opened = (await savedConnections(page)).find(
		(connection) => connection.runtimeProject === gamma,
	);
	expect(opened, "gamma was saved").toBeDefined();
	await expect(page).toHaveURL(new RegExp(`/runtime/${opened?.id}`));
	await openManager(page);
	await expect(row(page, "beta").getByText("Running", { exact: true })).toBeVisible();
	await expect(row(page, "gamma").getByText("Running", { exact: true })).toBeVisible();
	await expect(row(page, "alpha").getByText("cannot stop owned engine")).toBeVisible();
});

test("starting a project from its row keeps that row busy until the project is open", async ({
	page,
}) => {
	const [alpha, beta] = ["D:\\work\\alpha", "D:\\work\\beta"];
	await installDesktop(page);
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await addProject(page, alpha);
	await expect(page).toHaveURL(/\/runtime\//);
	await expect(dialog(page)).toBeHidden();
	await addProject(page, beta);
	await expect(dialog(page)).toBeHidden();
	await openManager(page);
	await button(page, "alpha", "Stop this engine").click();
	await expect(row(page, "alpha").getByText("Stopped", { exact: true })).toBeVisible();
	await expect(button(page, "alpha", "Start")).toBeEnabled();

	// Before the native side has reported anything, the row already knows it
	// is starting: Start cannot be clicked a second time.
	await hold(page, alpha, "before");
	await hold(page, alpha, "ready");
	await button(page, "alpha", "Start").click();
	await release(page, alpha);
	await expect(row(page, "alpha").getByText("Running", { exact: true })).toBeVisible();

	// The engine is ready, but the start has not finished saving and opening
	// the project, so the row still offers nothing.
	await expect(button(page, "alpha", "Open project")).toBeDisabled();
	await expect(button(page, "alpha", "Stop this engine")).toBeDisabled();
	await expect(button(page, "alpha", "Remove project")).toBeDisabled();
	await expect(row(page, "alpha").getByRole("alert")).toHaveCount(0);
	// Beta and the add form are not part of it.
	await expect(button(page, "beta", "Stop this engine")).toBeEnabled();
	await expect(
		dialog(page).getByRole("button", { name: "Add project", exact: true }),
	).toBeEnabled();

	await release(page, alpha);
	await expect(dialog(page)).toBeHidden();
	const opened = (await savedConnections(page)).find(
		(connection) => connection.runtimeProject === alpha,
	);
	await expect(page).toHaveURL(new RegExp(`/runtime/${opened?.id}`));
});

test("a row that was asked to start is busy before the engine reports anything", async ({
	page,
}) => {
	const alpha = "D:\\work\\alpha";
	await installDesktop(page);
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await addProject(page, alpha);
	await expect(dialog(page)).toBeHidden();
	await openManager(page);
	await button(page, "alpha", "Stop this engine").click();
	await expect(button(page, "alpha", "Start")).toBeEnabled();

	await hold(page, alpha, "before");
	await button(page, "alpha", "Start").click();
	// Held: the preview has answered and the start has been asked for, but no
	// lifecycle event has arrived. Start cannot be clicked a second time.
	await expect
		.poll(() =>
			page.evaluate(() => "D:\\work\\alpha" in (globalThis as BridgeWindow).__projects.held),
		)
		.toBe(true);
	await expect(row(page, "alpha").getByText("Stopped", { exact: true })).toBeVisible();
	await expect(button(page, "alpha", "Start")).toBeDisabled();
	await expect(button(page, "alpha", "Start")).toHaveAttribute("data-loading", "true");
	await expect(button(page, "alpha", "Remove project")).toBeDisabled();
	await expect(row(page, "alpha").getByRole("alert")).toHaveCount(0);
	expect(await calls(page, "rrd_engram_serve")).toHaveLength(2);

	await release(page, alpha);
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/\/runtime\//);
});

test("removing a project says what happens, stops its engine, forgets it and deletes no file", async ({
	page,
}) => {
	const [alpha, beta, gamma] = ["D:\\work\\alpha", "D:\\work\\beta", "D:\\work\\gamma"];
	await installDesktop(page);
	await page.goto("/", { waitUntil: "domcontentloaded" });
	for (const folder of [alpha, beta, gamma]) {
		await addProject(page, folder);
		await expect(page).toHaveURL(/\/runtime\//);
		await expect(dialog(page)).toBeHidden();
	}
	await openManager(page);

	const confirmation = page.getByRole("dialog", { name: "Remove this project from Connectome?" });
	await button(page, "alpha", "Remove project").click();
	await expect(
		confirmation.getByText("Its engine, which Connectome started, is stopped."),
	).toBeVisible();
	await expect(
		confirmation.getByText(
			'"alpha" is removed from Connectome\'s project list and its saved connection is deleted.',
		),
	).toBeVisible();
	await expect(
		confirmation.getByText(
			"Nothing in D:\\work\\alpha is deleted. The project's own files, its .rrflow folder and its data stay where they are, and adding the folder again brings the project back.",
		),
	).toBeVisible();
	await confirmation.getByRole("button", { name: "Keep project", exact: true }).click();
	await expect(row(page, "alpha")).toBeVisible();
	expect(await calls(page, "rrd_engram_forget")).toHaveLength(0);

	// A removal that cannot be saved leaves the project listed, with the
	// reason on its own row.
	const failSave = (message: string | null) =>
		page.evaluate(
			(message) => (globalThis as BridgeWindow).__projects.failSave(message),
			message,
		);
	await failSave("the disk is full");
	await button(page, "alpha", "Remove project").click();
	await confirmation.getByRole("button", { name: "Remove project", exact: true }).click();
	await expect(
		row(page, "alpha").getByText(
			/Its engine was stopped, but the removal could not be saved, so the project is still listed: .*the disk is full/,
		),
	).toBeVisible();
	await expect(row(page, "beta").getByRole("alert")).toHaveCount(0);
	await expect(button(page, "alpha", "Remove project")).toBeEnabled();
	await failSave(null);

	await button(page, "alpha", "Remove project").click();
	await expect(
		confirmation.getByText("No engine is running for this project, so nothing is stopped."),
	).toBeVisible();
	await confirmation.getByRole("button", { name: "Remove project", exact: true }).click();
	await expect(row(page, "alpha")).toHaveCount(0);
	await expect(row(page, "beta").getByText("Running", { exact: true })).toBeVisible();
	expect(await calls(page, "rrd_engram_forget")).toEqual([
		{ project: alpha },
		{ project: alpha },
	]);
	await expect
		.poll(async () =>
			(await savedConnections(page)).map((connection) => connection.runtimeProject),
		)
		.toEqual([beta, gamma]);
	const commands = await page.evaluate(() =>
		(globalThis as BridgeWindow).__projects.calls.map((call) => call.command),
	);
	expect(
		commands.filter((command) => /^plugin:fs\||remove|delete/.test(command)),
		"removing a project touches no file",
	).toEqual([]);

	// The home screen's connection menu removes a project the same way, and
	// by the same rule: not while the project is starting.
	await button(page, "gamma", "Stop this engine").click();
	await expect(button(page, "gamma", "Start")).toBeEnabled();
	await hold(page, gamma);
	await button(page, "gamma", "Start").click();
	await expect(row(page, "gamma").getByText("Starting the engine")).toBeVisible();
	await page.keyboard.press("Escape");
	await page.goto("/", { waitUntil: "domcontentloaded" });
	const menu = (name: string) =>
		page
			.getByRole("button")
			.filter({ hasText: name })
			.first()
			.locator(".mantine-ActionIcon-root");
	await menu("gamma").click();
	const blockedItem = page.getByRole("menuitem", { name: "Remove project" });
	await expect(blockedItem).toBeDisabled();
	await expect(blockedItem).toContainText(removeBlocked("starting"));
	await page.keyboard.press("Escape");
	await expect(blockedItem).toBeHidden();
	await menu("beta").click();
	// By its exact name: the blocked item is named with its reason as well.
	await page.getByRole("menuitem", { name: "Remove project", exact: true }).click();
	await expect(
		confirmation.getByText("Its engine, which Connectome started, is stopped."),
	).toBeVisible();
	await confirmation.getByRole("button", { name: "Remove project", exact: true }).click();
	await expect.poll(() => calls(page, "rrd_engram_forget")).toEqual([{ project: beta }]);
	await expect
		.poll(async () =>
			(await savedConnections(page)).map((connection) => connection.runtimeProject),
		)
		.toEqual([gamma]);
});

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
	CAPABILITIES,
	CATALOGUE,
	createDiagnosticProfiles,
	openDiagnosticWorkbench,
} from "./support/diagnostic";

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

test("the storage tab shows the rrflowCLD cold tier the engine reports", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "Open storage details" }).click();
	await expect(page.getByText("rrflowCLD cold tier", { exact: true })).toBeVisible();
	await expect(page.getByText("Published files", { exact: true })).toBeVisible();
	await expect(
		page.getByText("Files are a copy today: LSM space is not reclaimed yet.", { exact: true }),
	).toBeVisible();
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

test("a graph cached before the engine moved on is refreshed when the tab opens", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "Knowledge", exact: true }).click();
	await page.getByRole("tab", { name: "Graph", exact: true }).click();
	await expect(page.getByText(/Drawing 1 of 1 records/)).toBeVisible();
	await page.getByRole("tab", { name: "Schema", exact: true }).click();
	await page.evaluate(() =>
		(
			window as unknown as { __diagnosticCaptureTest: { commitWhileClosed: () => void } }
		).__diagnosticCaptureTest.commitWhileClosed(),
	);
	await page.getByRole("tab", { name: "Graph", exact: true }).click();
	await expect(page.getByText(/Drawing 2 of 2 records/)).toBeVisible();
});

test("an engine that does not answer is explained, not called a rejection", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.evaluate(() =>
		(
			window as unknown as { __diagnosticCaptureTest: { makeUnreachable: () => void } }
		).__diagnosticCaptureTest.makeUnreachable(),
	);
	await page.getByRole("button", { name: "Reconnect", exact: true }).click();
	await expect(
		page.getByText("Connectome cannot reach this engine", { exact: true }),
	).toBeVisible();
	await expect(page.getByText("Unreachable", { exact: true })).toBeVisible();
	await expect(page.getByText("RRD handshake failed", { exact: true })).toHaveCount(0);
});

test("a large engram says how much of it the engine sent", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.evaluate(() =>
		(
			window as unknown as { __diagnosticCaptureTest: { sendBoundedGraph: () => void } }
		).__diagnosticCaptureTest.sendBoundedGraph(),
	);
	await page.getByRole("button", { name: "Knowledge", exact: true }).click();
	await page.getByRole("tab", { name: "Graph", exact: true }).click();
	await expect(page.getByText(/Drawing 1 of 40 records and 0 of 39 relations/)).toBeVisible();
	await expect(page.getByText(/The engine sent the 1 most linked of 40 records/)).toBeVisible();
});

test("runtime actions read the engine on request and guided routes only navigate", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await expect(page.getByRole("heading", { name: "Runtime actions" })).toBeVisible();
	await page.getByRole("button", { name: "Read storage", exact: true }).click();
	await expect(page.getByText(/Storage profile .*; cursor \d+\./)).toBeVisible();
	await expect(page.getByText("completed", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Open vectors", exact: true }).click();
	await expect(page).toHaveURL(/\/knowledge\/vectors$/);
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await page.getByRole("tab", { name: "Workbench", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Guided routes" })).toBeVisible();
	await page.getByRole("button", { name: "Open step" }).first().click();
	await expect(page).toHaveURL(/\/knowledge\/models$/);
});

test("the engine tab keeps physical sequences separate from semantic cursors", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "Engine", exact: true }).click();
	await page.getByRole("tab", { name: "One engine", exact: true }).click();
	await expect(page).toHaveURL(/\/engine\/cursor$/);
	const agreement = page.locator("[data-engine-agreement]");
	await expect(agreement).toHaveText(
		"Latest observed change: 7. rrflowCLD's reading is 2 changes earlier. rrflowKV's physical sequence is a separate coordinate.",
	);
	const query = page.locator('[data-part-card="ql"]');
	await expect(query).toContainText("answered at 7");
	await expect(query).toContainText("1 range scan and 0 point reads: 2 keys examined");
	await expect(query).toContainText("Plan: kind_prefix, because the kind bounds the key range.");
	await expect(page.locator('[data-part-card="kv"]')).toContainText(
		"The observed durable watermark covers every applied physical mutation.",
	);
	await expect(page.locator('[data-part-card="kv"]')).toContainText("separate sequence");
	await expect(page.locator('[data-part-card="cld"]')).toContainText("through 5");
	// A committed change is read again by every part that follows it.
	await page.evaluate(() =>
		(
			window as unknown as { __diagnosticCaptureTest: { commitLiveChange: () => void } }
		).__diagnosticCaptureTest.commitLiveChange(),
	);
	await expect(agreement).toHaveText(
		"Latest observed change: 8. rrflowCLD's reading is 3 changes earlier. rrflowKV's physical sequence is a separate coordinate.",
	);
	await expect(query).toContainText("answered at 8");
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
									...CAPABILITIES,
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
			[
				"/v1/health/live",
				"/v1/health/ready",
				"/v1/capabilities",
				// The public catalogue a view is gated on; it carries no project data.
				"/v1/schema/endpoints",
			].includes(path),
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
	const installNativeBridge = (catalogue: typeof CATALOGUE) => {
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
			repetition_policy: null,
			equivalent_attempts: {},
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
					args: { path?: string; request?: { action?: string; attempt_id?: string } },
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
								installed_engram: null,
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
					if (command === "rrd_public_request" && args.path === "/v1/schema/endpoints")
						return {
							protocol: "rrd",
							protocol_version: 1,
							request_id: "catalogue-request",
							operation_id: "catalogue-operation",
							outcome: { status: "ok", payload: catalogue },
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
								controller_protocol: "system_one",
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
	await page.evaluate(installNativeBridge, CATALOGUE);
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
	await expect(page.getByText("Configured protocol: System One ? typed choice")).toBeVisible();
	await expect(page.getByText(/This is the engine configuration/)).toBeVisible();
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

test("runs explicit binary, score and choice assessments with protected readback and no selector prelude", async ({
	page,
}) => {
	await page.goto("/connections/create", { waitUntil: "domcontentloaded" });
	await expect(page.getByText("Connect to RRFlow", { exact: true })).toBeVisible();
	const task = {
		id: "assessment-task",
		title: "Assessment task",
		goal: "Review the selected file",
		status: "open",
		cursor: "1",
	};
	const taskB = {
		id: "other-task",
		title: "Other task",
		goal: "Check another task while the first assessment remains unresolved",
		status: "open",
		cursor: "2",
	};
	const repeatedTask = {
		id: "repeated-work-task",
		title: "Repeated work task",
		goal: "Resume without resetting the budget",
		status: "open",
		cursor: "3",
	};
	const budgetB = {
		sha256: "a".repeat(64),
		max_steps: "5",
		max_step_elapsed_ms: "30000",
		max_run_elapsed_ms: "60000",
		reserved_steps: "0",
		charged_elapsed_ms: "0",
		started_at_unix_ms: "1000",
		deadline_unix_ms: "61000",
		active_attempt: null,
		execution_may_continue: false,
		stopped: null,
		repetition_policy: null,
		equivalent_attempts: {},
	};
	const budgetRepeated = {
		sha256: "f".repeat(64),
		max_steps: "5",
		max_step_elapsed_ms: "30000",
		max_run_elapsed_ms: "60000",
		reserved_steps: "2",
		charged_elapsed_ms: "1200",
		started_at_unix_ms: "1000",
		deadline_unix_ms: "61000",
		active_attempt: null,
		execution_may_continue: false,
		stopped: "repeated_work",
		repetition_policy: { max_equivalent_attempts: "5" },
		equivalent_attempts: { ["6".repeat(64)]: "2" },
	};
	const source = {
		entry_identity: "3".repeat(64),
		path: "src/plan.txt",
		content_sha256: "4".repeat(64),
		bytes: "24",
	};
	const budget = {
		sha256: "b".repeat(64),
		max_steps: "5",
		max_step_elapsed_ms: "30000",
		max_run_elapsed_ms: "60000",
		reserved_steps: "0",
		charged_elapsed_ms: "0",
		started_at_unix_ms: "1000",
		deadline_unix_ms: "61000",
		active_attempt: null,
		execution_may_continue: false,
		stopped: null,
		repetition_policy: null,
		equivalent_attempts: {},
	};
	await page.evaluate(
		({ task, taskB, repeatedTask, source, budget, budgetB, budgetRepeated, catalogue }) => {
			Object.assign(globalThis, { isTauri: true });
			let storedAssessment: Record<string, unknown> | null = null;
			let assessmentIndex = 0;
			let exposeAssessmentOperations = true;
			let deferAssessmentRead = false;
			let resolveAssessmentRead: ((value: unknown) => void) | null = null;
			let resumeRequest: Record<string, unknown> | null = null;
			let hideCurrentAssessmentRead = false;
			let denyAssessmentRead = false;
			let assessmentBudgetAvailable = true;
			const attemptStatuses: Record<string, string> = {};
			const actions: string[] = [];
			const assessmentRequests: Record<string, unknown>[] = [];
			const assessmentOutputs: Record<string, any>[] = [];
			Object.assign(window, {
				__assessmentTest: {
					actions: () => actions,
					requests: () => assessmentRequests,
					outputs: () => assessmentOutputs,
					setAssessmentOperationsAvailable: (available: boolean) => {
						exposeAssessmentOperations = available;
					},
					setAttemptStatus: (attemptId: string, status: string) => {
						attemptStatuses[attemptId] = status;
					},
					setAssessmentReadDenied: (denied: boolean) => {
						denyAssessmentRead = denied;
					},
					setAssessmentBudgetAvailable: (available: boolean) => {
						assessmentBudgetAvailable = available;
					},
					savedCoordinates: () => {
						const key = Object.keys(localStorage).find((item) =>
							item.endsWith(":assessment"),
						);
						const value = key ? localStorage.getItem(key) : null;
						return value ? JSON.parse(value) : null;
					},
					resumeRequest: () => resumeRequest,
					deferRead: () => {
						deferAssessmentRead = true;
					},
					pendingRead: () => resolveAssessmentRead !== null,
					resolveRead: () => {
						deferAssessmentRead = false;
						resolveAssessmentRead?.({
							kind: "assessment",
							assessment: hideCurrentAssessmentRead ? null : storedAssessment,
							outcome_sha256: hideCurrentAssessmentRead ? null : "2".repeat(64),
						});
						resolveAssessmentRead = null;
					},
				},
			});
			Object.defineProperty(window, "__TAURI_INTERNALS__", {
				configurable: true,
				value: {
					invoke: async (
						command: string,
						args: { endpoint?: string; path?: string; request?: Record<string, any> },
					) => {
						if (command === "rrd_session")
							return {
								endpoint: "http://localhost:9477",
								instance: "rrd-assessment",
								principal: "smoke-principal",
								connected_at_unix_ms: 1,
								session: { idle_timeout_ms: 60000, absolute_timeout_ms: 3600000 },
								service: {
									implementation: "rrflow",
									implementation_version: "1.0.0",
									instance: "rrd-assessment",
									deployment_form: "single_node_server",
									storage_profile: "rrflow_kv",
									endpoint_presentation: "loopback_http_websocket",
									installed_engram: null,
									configuration_revision: 1,
									configuration_sha256: "2".repeat(64),
									capabilities: [],
								},
							};
						if (command === "rrd_public_request") {
							const path = args.path ?? "";
							const payload =
								path === "/v1/schema/endpoints"
									? {
											protocol: "rrd",
											protocol_version: 1,
											// Everything the pinned engine serves, except the assessment
											// operations this test turns on and off.
											endpoints: [
												...catalogue.endpoints.filter(
													(endpoint: { operation: string }) =>
														!endpoint.operation.startsWith(
															"task-assessment-",
														),
												),
												...(exposeAssessmentOperations
													? [
															{
																action: {
																	action: "reasoning_write",
																	source: "fixed",
																},
																authentication: "session_bearer",
																description:
																	"Execute one bounded assessment.",
																family: "tasks",
																method: "post",
																mutation: true,
																operation:
																	"task-assessment-execute",
																path: "/v1/tasks/assessment/execute",
																request_type:
																	"TaskAssessmentRequest",
																response_type:
																	"TaskAssessmentOutput",
																summary:
																	"Execute one bounded assessment.",
															},
															{
																action: {
																	action: "reasoning_read",
																	source: "fixed",
																},
																authentication: "session_bearer",
																description:
																	"Read one protected assessment.",
																family: "tasks",
																method: "post",
																mutation: false,
																operation: "task-assessment-read",
																path: "/v1/tasks/assessment/read",
																request_type: "TaskAssessmentRead",
																response_type: "TaskAssessmentView",
																summary:
																	"Read one protected assessment.",
															},
														]
													: []),
											],
											families: [],
											websocket_endpoints: [],
										}
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
														configuration_sha256: "2".repeat(64),
													},
													instance: {
														kind: "instance",
														id: "rrd-assessment",
													},
													capabilities: [],
													product_capabilities: {},
												};
							return {
								protocol: "rrd",
								protocol_version: 1,
								request_id: `assessment-${path}`,
								operation_id: `assessment-${path}`,
								outcome: { status: "ok", payload },
							};
						}
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
						if (command !== "rrd_task")
							throw new Error(`Unexpected command ${command}`);
						const request = args.request ?? {};
						const action = String(request.action ?? "");
						actions.push(action);
						if (action === "list")
							return {
								kind: "page",
								tasks: [task, taskB, repeatedTask],
								truncated: false,
								next_cursor: "2",
							};
						if (action === "budget")
							return {
								kind: "budget",
								budget:
									request.task_id === task.id && !assessmentBudgetAvailable
										? null
										: request.task_id === taskB.id
											? budgetB
											: request.task_id === repeatedTask.id
												? budgetRepeated
												: budget,
							};
						if (action === "read") {
							const found = [task, taskB, repeatedTask].find(
								(item) => item.id === request.task_id,
							);
							return found
								? { kind: "task", task: found }
								: { kind: "not_dispatched" };
						}
						if (action === "attempt")
							return {
								kind: "attempt",
								status: attemptStatuses[String(request.attempt_id)] ?? null,
								proposal: null,
								worker: null,
							};
						if (action === "resume") {
							resumeRequest = request;
							return {
								kind: "budget",
								budget: {
									...budgetRepeated,
									sha256: "c".repeat(64),
									stopped: null,
								},
							};
						}
						if (action === "prepare_assessment")
							return {
								kind: "assessment_prepared",
								task: request.task_id === taskB.id ? taskB : task,
								task_sha256: "c".repeat(64),
								configuration_sha256: "d".repeat(64),
								controller_binding_id: "configured-controller",
								controller_destination: "http://127.0.0.1:9477",
								maximum_input_bytes: "1024",
								maximum_response_bytes: "4096",
								wait_timeout_ms: "5000",
								allow_network: true,
								allow_source_export: true,
								allow_context_export: true,
								unavailable: null,
								inventory: {
									entries: [source],
									read_cursor: "9",
									read_manifest_sha256: "5".repeat(64),
									result_identity_version: 2,
									truncated: false,
									incomplete_rows: 0,
									unavailable_rows: 0,
									oversized_rows: 0,
								},
							};
						if (action === "assess") {
							assessmentIndex += 1;
							attemptStatuses[String(request.attempt_id)] =
								assessmentIndex === 5 ? "reserved" : "accepted";
							hideCurrentAssessmentRead = assessmentIndex === 5;
							assessmentRequests.push(
								JSON.parse(JSON.stringify(request)) as Record<string, unknown>,
							);
							const descriptor = request.descriptor;
							const practiceText = String(request.practice_text);
							const practiceHash = [
								...new Uint8Array(
									await crypto.subtle.digest(
										"SHA-256",
										new TextEncoder().encode(practiceText),
									),
								),
							]
								.map((byte) => byte.toString(16).padStart(2, "0"))
								.join("");
							const declaration = JSON.stringify({
								contract_version: 1,
								descriptor,
								practice_text: practiceText,
							});
							const declarationHash = [
								...new Uint8Array(
									await crypto.subtle.digest(
										"SHA-256",
										new TextEncoder().encode(declaration),
									),
								),
							]
								.map((byte) => byte.toString(16).padStart(2, "0"))
								.join("");
							const mode = String(descriptor.mode);
							const practiceIdentity = {
								question_set_id: "connectome-adhoc-set",
								question_id: `connectome-adhoc-${mode}`,
								template_id: `connectome-adhoc-${mode}-declaration`,
								template_revision: 1,
								template_sha256: declarationHash,
								requirement_id: `connectome-adhoc-${mode}-requirement`,
							};
							const decision =
								assessmentIndex === 4
									? {
											outcome: "abstained",
											reason: "Insufficient evidence in the supplied bytes.",
										}
									: descriptor.mode === "binary"
										? {
												outcome: "answered",
												value: { kind: "binary", value: true },
											}
										: descriptor.mode === "score"
											? {
													outcome: "answered",
													value: { kind: "score", value: 0.75 },
												}
											: {
													outcome: "answered",
													value: {
														kind: "choice",
														option_id: descriptor.options[0].id,
													},
												};
							storedAssessment = {
								contract_version: 1,
								scope: "instance:rrd-assessment",
								task_id: request.task_id,
								attempt_id: request.attempt_id,
								task_sha256: request.expected_task_sha256,
								configuration_sha256: request.expected_configuration_sha256,
								packet_sha256: "6".repeat(64),
								request_sha256: "7".repeat(64),
								response_sha256: "8".repeat(64),
								content_sha256: "9".repeat(64),
								controller_binding_id: "configured-controller",
								service_id: "controlled-protocol-fixture",
								descriptor,
								practice_identity: practiceIdentity,
								practice_sha256: practiceHash,
								source_bytes: 24,
								practice_bytes: new TextEncoder().encode(practiceText).length,
								source: {
									contract_version: 1,
									captured_snapshot_sha256: "a".repeat(64),
									captured_read: {
										runtime_manifest_sha256: "b".repeat(64),
										runtime_cursor: "10",
										schema_revision: "1",
										catalogue_revision: "1",
									},
									project_id: "project-smoke",
									entry_identity: request.source.entry_identity,
									path_sha256: "c".repeat(64),
									content_sha256: request.source.expected_content_sha256,
									policy_sha256: "d".repeat(64),
									profile_sha256: "e".repeat(64),
									captured_at_unix_ms: "11",
									validated_snapshot_sha256: "f".repeat(64),
									validated_read: {
										runtime_manifest_sha256: "1".repeat(64),
										runtime_cursor: "12",
										schema_revision: "1",
										catalogue_revision: "1",
									},
									validated_at_unix_ms: "13",
								},
								read: {},
								decision,
								references:
									decision.outcome === "answered"
										? [
												{
													input: "source",
													input_sha256:
														request.source.expected_content_sha256,
													start_byte: 0,
													end_byte: 4,
												},
											]
										: [],
								usage: null,
								elapsed_ms: 3,
								http_status: 200,
							};
							assessmentOutputs.push(storedAssessment);
							return {
								kind: "assessment",
								assessment: storedAssessment,
								outcome_sha256: null,
							};
						}
						if (action === "assessment") {
							if (denyAssessmentRead)
								throw new Error("protected assessment read denied");
							if (deferAssessmentRead)
								return new Promise((resolve) => {
									resolveAssessmentRead = resolve;
								});
							return {
								kind: "assessment",
								assessment: hideCurrentAssessmentRead ? null : storedAssessment,
								outcome_sha256:
									!hideCurrentAssessmentRead && storedAssessment
										? "2".repeat(64)
										: null,
							};
						}
						throw new Error(`Unexpected task action ${action}`);
					},
				},
			});
		},
		{
			task,
			taskB,
			repeatedTask,
			source,
			budget,
			budgetB,
			budgetRepeated,
			catalogue: CATALOGUE,
		},
	);
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
							instance: { kind: "instance", id: "rrd-assessment" },
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
	await page.getByRole("button", { name: "Reasoning", exact: true }).click();
	await page.getByRole("button", { name: "Read tasks" }).click();
	await page.getByRole("button", { name: /Assessment task/ }).click();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	const setAssessmentOperationsAvailable = async (available: boolean) =>
		page.evaluate(
			(available) =>
				(
					window as unknown as {
						__assessmentTest: {
							setAssessmentOperationsAvailable: (value: boolean) => void;
						};
					}
				).__assessmentTest.setAssessmentOperationsAvailable(available),
			available,
		);
	await setAssessmentOperationsAvailable(false);
	await page.getByRole("button", { name: "Review current policy and source files" }).click();
	await expect(
		page.getByText(
			"This RRFlow version does not expose both supported task assessment operations.",
		),
	).toBeVisible();
	const preparedBeforeDiscovery = await page.evaluate(
		() =>
			(
				window as unknown as { __assessmentTest: { actions: () => string[] } }
			).__assessmentTest
				.actions()
				.filter((action) => action === "prepare_assessment").length,
	);
	expect(preparedBeforeDiscovery).toBe(0);
	await setAssessmentOperationsAvailable(true);
	await page.getByRole("button", { name: "Review current policy and source files" }).click();
	await page.getByRole("textbox", { name: "Source file" }).click();
	await page.getByRole("option", { name: /src\/plan.txt/ }).click();
	const submit = async (
		mode: string,
		expected: string,
		fields: (index: number) => Promise<void>,
	) => {
		if (mode !== currentMode) {
			await page.getByRole("textbox", { name: "Assessment mode" }).click();
			await page.getByRole("option", { name: mode, exact: true }).click();
			currentMode = mode;
		}
		await fields(assessmentCount++);
		await page.getByLabel(/I approve sending this source and practice text/).check();
		await page.getByRole("button", { name: "Request assessment" }).click();
		await expect(
			page.getByRole("heading", { name: "Advisory assessment report" }),
		).toBeVisible();
		await expect(page.getByText(expected, { exact: false })).toBeVisible();
	};
	let assessmentCount = 0;
	let currentMode = "Binary";
	await submit("Binary", "Yes/no answer — Yes", async () => {
		await page.getByLabel("Yes/no statement").fill("The source has a bounded declaration.");
		await page
			.getByLabel("Guidance or development practice")
			.fill("Check only the selected text.");
	});
	await page.getByText("Evidence and provenance").click();
	await expect(page.getByText(/Declaration SHA-256:/)).toBeVisible();
	await submit("Score", "Score — 0.75", async () => {
		await page.getByLabel("Scoring criteria").fill("Score the stated evidence only.");
		await page.getByLabel("Guidance or development practice").fill("Use bounded evidence.");
	});
	await submit("Choice", "Choice — First label", async () => {
		await page.getByLabel("Choice question").fill("Which label fits?");
		await page.getByLabel("Choices, one per line").fill("First label\nSecond label");
		await page.getByLabel("Guidance or development practice").fill("Choose one listed label.");
	});
	await submit("Choice", "Abstained — Insufficient evidence in the supplied bytes.", async () => {
		await page.getByLabel("Choice question").fill("Can this be answered?");
		await page.getByLabel("Choices, one per line").fill("Yes\nNo");
		await page
			.getByLabel("Guidance or development practice")
			.fill("Abstain when evidence is insufficient.");
	});
	const hashCheck = await page.evaluate(async () => {
		const state = (
			window as unknown as {
				__assessmentTest: {
					requests: () => Record<string, any>[];
					outputs: () => Record<string, any>[];
				};
			}
		).__assessmentTest;
		const requests = state.requests();
		const outputs = state.outputs();
		const hash = async (value: string) =>
			[
				...new Uint8Array(
					await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
				),
			]
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join("");
		return Promise.all(
			requests.map(async (request, index) => ({
				sentIdentity: Object.hasOwn(request, "practice_identity"),
				template: outputs[index].practice_identity.template_sha256,
				expectedTemplate: await hash(
					JSON.stringify({
						contract_version: 1,
						descriptor: request.descriptor,
						practice_text: request.practice_text,
					}),
				),
				practice: outputs[index].practice_sha256,
				expectedPractice: await hash(String(request.practice_text)),
			})),
		);
	});
	for (const check of hashCheck) {
		expect(check.sentIdentity).toBe(false);
		expect(check.template).toBe(check.expectedTemplate);
		expect(check.practice).toBe(check.expectedPractice);
		expect(check.template).not.toBe(check.practice);
	}
	await page.evaluate(() =>
		(
			window as unknown as { __assessmentTest: { deferRead: () => void } }
		).__assessmentTest.deferRead(),
	);
	await page.getByLabel("Choice question").fill("Can the delayed read be fenced?");
	await page.getByLabel("Choices, one per line").fill("Allow\nAbstain");
	await page
		.getByLabel("Guidance or development practice")
		.fill("This read will finish after task selection changes.");
	await page.getByLabel(/I approve sending this source and practice text/).check();
	await page.getByRole("button", { name: "Request assessment" }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(
					window as unknown as { __assessmentTest: { pendingRead: () => boolean } }
				).__assessmentTest.pendingRead(),
			),
		)
		.toBe(true);
	await page.getByRole("button", { name: /Other task/ }).click();
	await expect(page.getByRole("heading", { name: "Other task" })).toBeVisible();
	await expect(page.getByText("A saved assessment needs checking")).toBeVisible();
	await page.evaluate(() =>
		(
			window as unknown as { __assessmentTest: { resolveRead: () => void } }
		).__assessmentTest.resolveRead(),
	);
	await expect(page.getByText("Insufficient evidence in the supplied bytes.")).toHaveCount(0);
	await page.getByRole("button", { name: "Review current policy and source files" }).click();
	await page.getByRole("textbox", { name: "Source file" }).click();
	await page.getByRole("option", { name: /src\/plan.txt/ }).click();
	await page
		.getByLabel("Yes/no statement")
		.fill("Another task cannot overwrite the pending bookmark.");
	await page
		.getByLabel("Guidance or development practice")
		.fill("Keep the prior attempt recoverable.");
	await page.getByLabel(/I approve sending this source and practice text/).check();
	const guardedRequest = page.getByRole("button", { name: "Request assessment" });
	await expect(guardedRequest).toBeDisabled();
	await page.getByText("Optional recovery by attempt ID").click();
	await page.getByLabel("Assessment attempt ID").fill("manual-attempt-b");
	await page.getByRole("button", { name: "Check this attempt" }).click();
	await expect(
		page.getByText("No accepted assessment is available to this session."),
	).toBeVisible();
	const originalRecovery = await page.evaluate(() => {
		const test = (
			window as unknown as {
				__assessmentTest: {
					savedCoordinates: () => { task_id: string; attempt_id: string };
					requests: () => Record<string, any>[];
				};
			}
		).__assessmentTest;
		return {
			coordinates: test.savedCoordinates(),
			lastAttemptId: test.requests()[4]?.attempt_id,
		};
	});
	const originalCoordinates = originalRecovery.coordinates;
	expect(originalCoordinates).toEqual({
		task_id: "assessment-task",
		attempt_id: originalRecovery.lastAttemptId,
	});
	await expect(guardedRequest).toBeDisabled();
	await page.getByRole("button", { name: "Open saved assessment task", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Assessment task" })).toBeVisible();
	await page.evaluate(() =>
		(
			window as unknown as {
				__assessmentTest: {
					setAssessmentReadDenied: (denied: boolean) => void;
				};
			}
		).__assessmentTest.setAssessmentReadDenied(true),
	);
	await page.getByRole("button", { name: "Check assessment result" }).click();
	await expect(
		page.getByText("Protected read was denied or unavailable; no prior assessment is shown."),
	).toBeVisible();
	const deniedCoordinates = await page.evaluate(() =>
		(
			window as unknown as {
				__assessmentTest: {
					savedCoordinates: () => { task_id: string; attempt_id: string };
				};
			}
		).__assessmentTest.savedCoordinates(),
	);
	expect(deniedCoordinates).toEqual(originalCoordinates);
	const pendingAttemptId = String(originalCoordinates.attempt_id);
	await page.evaluate((attemptId) => {
		const test = (
			window as unknown as {
				__assessmentTest: {
					setAttemptStatus: (id: string, status: string) => void;
					setAssessmentReadDenied: (denied: boolean) => void;
				};
			}
		).__assessmentTest;
		test.setAttemptStatus(attemptId, "accepted");
		test.setAssessmentReadDenied(false);
	}, pendingAttemptId);
	await page.evaluate(() =>
		(
			window as unknown as {
				__assessmentTest: { setAssessmentBudgetAvailable: (available: boolean) => void };
			}
		).__assessmentTest.setAssessmentBudgetAvailable(false),
	);
	await page.getByRole("button", { name: "Check assessment result" }).click();
	await expect(
		page.getByText("No accepted assessment is available to this session."),
	).toBeVisible();
	const coordinatesWithoutBudget = await page.evaluate(() =>
		(
			window as unknown as {
				__assessmentTest: {
					savedCoordinates: () => { task_id: string; attempt_id: string };
				};
			}
		).__assessmentTest.savedCoordinates(),
	);
	expect(coordinatesWithoutBudget).toEqual(originalCoordinates);
	await page.evaluate(() =>
		(
			window as unknown as {
				__assessmentTest: { setAssessmentBudgetAvailable: (available: boolean) => void };
			}
		).__assessmentTest.setAssessmentBudgetAvailable(true),
	);
	await page.getByRole("button", { name: "Check assessment result" }).click();
	await expect(
		page.getByText("No accepted assessment is available to this session."),
	).toBeVisible();
	const clearedCoordinates = await page.evaluate(() =>
		(
			window as unknown as { __assessmentTest: { savedCoordinates: () => unknown } }
		).__assessmentTest.savedCoordinates(),
	);
	expect(clearedCoordinates).toBeNull();
	await page.getByRole("button", { name: /Repeated work task/ }).click();
	await expect(page.getByRole("heading", { name: "Repeated work task" })).toBeVisible();
	await page.getByRole("button", { name: "Read budget and attempt" }).click();
	const resumeButton = page.getByRole("button", { name: "Resume task budget" });
	await expect(resumeButton).toBeDisabled();
	await page.getByLabel(/I reviewed this repeated-work stop/).check();
	await expect(resumeButton).toBeEnabled();
	await resumeButton.click();
	await expect(page.getByText(/2 \/ 5 steps reserved/)).toBeVisible();
	await expect(page.getByText(/1200 ms charged/)).toBeVisible();
	const resumed = await page.evaluate(() =>
		(
			window as unknown as {
				__assessmentTest: { resumeRequest: () => Record<string, unknown> | null };
			}
		).__assessmentTest.resumeRequest(),
	);
	expect(resumed).toEqual({
		action: "resume",
		task_id: "repeated-work-task",
		expected_budget_sha256: "f".repeat(64),
	});
	const actionList = await page.evaluate(() =>
		(
			window as unknown as { __assessmentTest: { actions: () => string[] } }
		).__assessmentTest.actions(),
	);
	expect(actionList.filter((action) => action === "assess")).toHaveLength(5);
	expect(actionList.filter((action) => action === "assessment")).toHaveLength(10);
	expect(actionList).not.toContain("propose");
});

test("explains the local database and keeps native startup explicit", async ({
	page,
}, testInfo) => {
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await expect(page.getByText("Local RRFlow", { exact: true })).toBeVisible();
	await expect(page.getByText("No running local engine reported", { exact: true })).toBeVisible();
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

test("dataset plans record the telemetry the author chose", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("textbox", { name: "Workbench lane", exact: true }).click();
	await page.getByRole("option", { name: "Dataset authoring", exact: true }).click();
	await page.getByLabel("Template name", { exact: true }).fill("Telemetry template");
	await page.getByRole("button", { name: "Save template", exact: true }).click();
	await expect(page.getByText("Telemetry template", { exact: true }).first()).toBeVisible();
	await page.getByLabel("Telemetry profile", { exact: true }).fill("latency-only");
	await page.getByLabel("Hops", { exact: true }).uncheck();
	await page.getByLabel("Tools", { exact: true }).uncheck();
	const workload = page.waitForEvent("download", {
		predicate: (download) => download.suggestedFilename().endsWith("workload-plan.json"),
	});
	await page.getByLabel("Run label", { exact: true }).fill("telemetry run");
	await page.getByRole("button", { name: "Generate dataset files", exact: true }).click();
	const plan = JSON.parse(readFileSync(await (await workload).path(), "utf8")) as {
		telemetry: Record<string, unknown>;
	};
	expect(plan.telemetry).toEqual({
		profile: "latency-only",
		hops: false,
		actions: true,
		tools: false,
		time: true,
	});
});

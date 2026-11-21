import { expect, test } from "@playwright/test";
import { createDiagnosticProfiles, openDiagnosticWorkbench } from "./support/diagnostic";

// Renderer behavior only. Native installed-process tests prove the engine effects.
test("policy editor previews before approval and recovers a lost reply by reading", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.evaluate(() => {
		const bridge = (
			globalThis as unknown as {
				__TAURI_INTERNALS__: {
					invoke: (command: string, args: Record<string, any>) => Promise<unknown>;
				};
			}
		).__TAURI_INTERNALS__;
		const invoke = bridge.invoke;
		let revision = "0";
		let prepared: any = null;
		let head: any = null;
		let applies = 0;
		const project = () => ({
			identity: { instance_id: "diagnostic-profile-a" },
			installed_settings: {},
			head,
		});
		const values = (rows: string) => ({
			query_rows: {
				value: rows,
				unit: "rows",
				source: "project_preference",
				minimum: "1",
				maximum: rows,
				installed_ceiling: "10000",
				user_rule: null,
				project_rule: null,
			},
		});
		bridge.invoke = async (command, args) => {
			if (command !== "rrd_configuration") return invoke(command, args);
			const request = args.request;
			if (request.action === "pending") return { kind: "pending", prepared };
			if (request.action === "read") {
				if (head) prepared = null;
				return {
					kind: "snapshot",
					project: project(),
					effective_error: null,
					effective: {
						project_read_revision: revision,
						project_policy: head,
						user_revision: null,
						user_read_revision: null,
						valid_at_unix_ms: "100",
						values: values(head ? "2" : "10000"),
					},
				};
			}
			if (request.action === "prepare") {
				prepared = {
					kind: "prepared",
					handle: "native-preview",
					uncertain: false,
					plan: {
						current: project(),
						change: {
							settings: request.settings,
							valid_from_unix_ms: "100",
							valid_to_unix_ms: null,
						},
						values: values(request.settings.query_rows.preference),
						plan_sha256: "a".repeat(64),
						expires_at_unix_ms: "300100",
					},
				};
				return prepared;
			}
			if (request.action === "approve") {
				if (Object.keys(request).sort().join(",") !== "action,handle")
					throw new Error("approval must only name the native handle");
				applies++;
				revision = "1";
				head = {
					revision,
					change: prepared.plan.change,
					applied_plan_sha256: prepared.plan.plan_sha256,
				};
				prepared.uncertain = true;
				return { kind: "uncertain", message: "Reply lost after commit" };
			}
			throw new Error(`Unexpected policy action ${request.action}`);
		};
		Object.assign(globalThis, { policyApplyCount: () => applies });
	});
	await page.getByRole("button", { name: "System", exact: true }).click();
	await page.getByRole("tab", { name: "Policies and preferences", exact: true }).click();
	await page.getByRole("button", { name: "Read current policies", exact: true }).click();
	await expect(page.getByText(/This project has no bound user policy source/)).toBeVisible();
	await page.getByLabel("Rows returned per query maximum", { exact: true }).fill("2");
	await page.getByLabel("Rows returned per query preference", { exact: true }).fill("2");
	await page.getByRole("button", { name: "Preview project changes", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Review project changes" })).toBeVisible();
	const count = () =>
		page.evaluate(() =>
			(globalThis as unknown as { policyApplyCount: () => number }).policyApplyCount(),
		);
	expect(await count()).toBe(0);
	await page.getByRole("button", { name: "Approve project changes", exact: true }).click();
	await expect(page.getByText(/Approval outcome needs confirmation/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Discard preview", exact: true })).toBeDisabled();
	await page.getByRole("button", { name: "Read current policies", exact: true }).click();
	await expect(
		page.getByText(/Stored policy confirms that the original approval was committed/),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Preview project changes", exact: true }),
	).toBeEnabled();
	expect(await count()).toBe(1);
});

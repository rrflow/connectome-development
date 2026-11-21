import { expect, test } from "@playwright/test";
import { CATALOGUE, createDiagnosticProfiles } from "./support/diagnostic";

test("a gated view waits for its catalogue and exposes failure before retry", async ({ page }) => {
	const { profileA } = await createDiagnosticProfiles(page);
	let release!: () => void;
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	let mode = "pending";
	await page.route("http://localhost:9477/v1/schema/endpoints", async (route) => {
		if (mode === "pending") await pending;
		if (mode === "failed") {
			await route.fulfill({ status: 503, body: "catalogue unavailable" });
			return;
		}
		await route.fulfill({
			contentType: "application/json",
			headers: { "Access-Control-Allow-Origin": "*" },
			body: JSON.stringify({
				protocol: "rrd",
				protocol_version: 1,
				request_id: "catalogue-test",
				operation_id: "catalogue-test",
				outcome: { status: "ok", payload: mode === "invalid" ? {} : CATALOGUE },
			}),
		});
	});
	try {
		await page.goto(`${profileA}/system/api`, { waitUntil: "domcontentloaded" });
		await expect(
			page.getByText("Checking what this engine serves", { exact: true }),
		).toBeVisible();
		await expect(page.getByRole("textbox", { name: "Example language" })).toHaveCount(0);
		mode = "failed";
		release();
		await expect(
			page.getByText("Engine capabilities could not be checked", { exact: true }),
		).toBeVisible();
		await expect(page.getByRole("textbox", { name: "Example language" })).toHaveCount(0);
		mode = "invalid";
		await page.getByRole("button", { name: "Retry capability check" }).click();
		await expect(
			page.getByText("The engine returned an invalid operation catalogue.", { exact: true }),
		).toBeVisible();
		await expect(page.getByRole("textbox", { name: "Example language" })).toHaveCount(0);
		mode = "valid";
		await page.getByRole("button", { name: "Retry capability check" }).click();
		await expect(page.getByRole("textbox", { name: "Example language" })).toBeVisible();
		await expect(
			page.getByText("Engine capabilities could not be checked", { exact: true }),
		).toHaveCount(0);
	} finally {
		mode = "valid";
		release();
	}
});

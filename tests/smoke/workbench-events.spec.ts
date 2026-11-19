import { expect, test } from "@playwright/test";
import { createDiagnosticProfiles, openDiagnosticWorkbench } from "./support/diagnostic";

test("a scripted event is authored, approved, run and recorded in the workbench", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	const lane = page.getByRole("textbox", { name: "Workbench lane", exact: true });
	await lane.click();
	await page.getByRole("option", { name: "Dataset authoring", exact: true }).click();

	await page.getByLabel("Template name", { exact: true }).fill("Event template");
	await page.getByLabel("Title", { exact: true }).first().fill("Smoke event");
	await page.getByLabel("Body", { exact: true }).fill("Authored event body");
	await page.getByLabel("Action label", { exact: true }).fill("Check storage");
	await page.getByRole("button", { name: "Add action", exact: true }).click();
	await page.getByRole("button", { name: "Add learning event", exact: true }).click();
	await page.getByRole("button", { name: "Save template", exact: true }).click();
	await expect(page.getByText("Event template", { exact: true }).first()).toBeVisible();

	// An event that needs sign-off runs only when a person approves it.
	const run = page.getByRole("button", { name: "Approve and run", exact: true });
	await expect(run).toHaveCount(1);
	await run.click();
	await expect(run).toBeEnabled();
	await expect(page.getByText("Scripted event execution failed", { exact: true })).toHaveCount(0);

	// The run leaves a receipt in the workbench, naming the event and its template.
	await lane.click();
	await page.getByRole("option", { name: "Prompt workbench", exact: true }).click();
	await expect(page.getByText(/MCPL event executed: Smoke event/).first()).toBeVisible();
});

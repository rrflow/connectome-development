import { expect, test } from "@playwright/test";
import { createDiagnosticProfiles } from "./support/diagnostic";

// Navigation proof only. Engine execution is covered by the installed process suite.
test("startup exposes the existing tools without selecting or starting an engine", async ({
	page,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/v1/")) requests.push(request.url());
	});
	await page.goto("/overview");
	const navigation = page.getByRole("navigation", { name: "Project areas" });
	for (const name of [
		"Local engines",
		"Workbench",
		"Home",
		"Labs",
		"Knowledge",
		"Reasoning",
		"System",
	]) {
		await expect(navigation.getByRole("button", { name, exact: true })).toBeVisible();
	}
	await navigation.getByRole("button", { name: "Workbench", exact: true }).click();
	const chooser = page.getByRole("dialog", { name: "Open Workbench", exact: true });
	await expect(chooser.getByText(/No project has been added yet/)).toBeVisible();
	await expect(chooser.getByRole("button", { name: "Start local RRFlow" })).toBeVisible();
	await expect(chooser.getByRole("button", { name: "Connect remote engine" })).toBeVisible();
	expect(requests).toEqual([]);
});

test("startup tool selection opens the chosen project's existing view", async ({ page }) => {
	const { profileB } = await createDiagnosticProfiles(page);
	await page.getByRole("button", { name: "Overview", exact: true }).click();
	await page
		.getByRole("navigation", { name: "Project areas" })
		.getByRole("button", { name: "Workbench", exact: true })
		.click();
	const chooser = page.getByRole("dialog", { name: "Open Workbench", exact: true });
	await expect(
		chooser.getByRole("button", { name: "Open Workbench", exact: true }),
	).toBeDisabled();
	await chooser.getByRole("textbox", { name: "Project", exact: true }).click();
	await page.getByRole("option", { name: "Diagnostic Profile B", exact: true }).click();
	await chooser.getByRole("button", { name: "Open Workbench", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${profileB}/reasoning/workbench$`));
	await expect(
		page.getByRole("heading", { name: "Prompt workbench", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Project areas" })).toHaveCount(1);
});

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createDiagnosticProfiles, openDiagnosticWorkbench } from "./support/diagnostic";

test("templates leave as a versioned file and come back as new templates", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("textbox", { name: "Workbench lane", exact: true }).click();
	await page.getByRole("option", { name: "Dataset authoring", exact: true }).click();
	const exportButton = page.getByRole("button", { name: "Export templates", exact: true });
	// With nothing saved there is nothing to export.
	await expect(exportButton).toBeDisabled();

	await page.getByLabel("Template name", { exact: true }).fill("Round trip");
	await page.getByLabel("Skills (one per line)", { exact: true }).fill("rust\nretrieval");
	await page
		.getByLabel("Minimum requirements (one per line)", { exact: true })
		.fill("authorized source");
	await page.getByRole("button", { name: "Save template", exact: true }).click();
	const saved = page.getByText("Round trip", { exact: true });
	await expect(saved.first()).toBeVisible();
	const before = await saved.count();

	const download = page.waitForEvent("download");
	await exportButton.click();
	const path = await (await download).path();
	const exported = JSON.parse(readFileSync(path, "utf8")) as {
		version: number;
		templates: { name: string; skills: string[]; minimumRequirements: string[] }[];
	};
	expect(exported.version).toBe(1);
	expect(exported.templates).toHaveLength(1);
	expect(exported.templates[0]).toMatchObject({
		name: "Round trip",
		skills: ["rust", "retrieval"],
		minimumRequirements: ["authorized source"],
	});

	// The same file imports as a second template, in front of the first.
	const input = page.locator('input[type="file"][accept="application/json,.json"]');
	await input.setInputFiles(path);
	await expect(saved).toHaveCount(before * 2);
	await expect(page.getByText("Template import failed", { exact: true })).toHaveCount(0);

	// A file that is not a template export changes nothing and says so.
	await input.setInputFiles({
		name: "not-templates.json",
		mimeType: "application/json",
		buffer: Buffer.from(JSON.stringify({ templates: [] })),
	});
	await expect(
		page.getByText("The selected file contains no valid dataset templates.", { exact: true }),
	).toBeVisible();
	await expect(saved).toHaveCount(before * 2);
	await input.setInputFiles({
		name: "broken.json",
		mimeType: "application/json",
		buffer: Buffer.from("{ not json"),
	});
	await expect(page.getByText("Template import failed", { exact: true })).toBeVisible();
	await expect(saved).toHaveCount(before * 2);
});

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
	await expect(page.getByText(/^Invalid or unsupported template export:/)).toBeVisible();
	await expect(saved).toHaveCount(before * 2);
	await input.setInputFiles({
		name: "broken.json",
		mimeType: "application/json",
		buffer: Buffer.from("{ not json"),
	});
	await expect(page.getByText("Template import failed", { exact: true })).toBeVisible();
	await expect(saved).toHaveCount(before * 2);
});

test("template import keeps authored data and rejects an entire invalid batch", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("textbox", { name: "Workbench lane", exact: true }).click();
	await page.getByRole("option", { name: "Dataset authoring", exact: true }).click();
	const template = {
		id: "source-template",
		name: "Authored extras",
		description: " Keep surrounding whitespace ",
		schema: " source schema ",
		skills: [" Rust "],
		researchReferences: ["docs/reference"],
		minimumRequirements: ["Keep authored content"],
		filePatterns: ["src/**"],
		folderPatterns: ["src"],
		createdAtUnixMs: 42,
		updatedAtUnixMs: 43,
		customTemplateData: { nested: true },
		steps: [
			{
				id: "source-step",
				title: "Inspect",
				detail: " Keep exact values ",
				route: "reasoning/workbench",
				linkedPathId: "not-in-destination",
				customStepData: 2,
			},
		],
		learningEvents: [],
	};
	const input = page.locator('input[type="file"][accept="application/json,.json"]');
	const upload = (templates: unknown[]) =>
		input.setInputFiles({
			name: "authored.json",
			mimeType: "application/json",
			buffer: Buffer.from(JSON.stringify({ version: 1, exportedAtUnixMs: 100, templates })),
		});
	const downloadTemplates = async () => {
		const download = page.waitForEvent("download");
		await page.getByRole("button", { name: "Export templates", exact: true }).click();
		return JSON.parse(readFileSync(await (await download).path(), "utf8")) as {
			templates: Array<typeof template>;
		};
	};
	await upload([template]);
	await expect(page.getByText("Authored extras", { exact: true }).first()).toBeVisible();
	await expect(page.getByText(/link=not-in-destination \(unavailable\)/)).toBeVisible();
	const exported = await downloadTemplates();
	expect(exported.templates).toHaveLength(1);
	const imported = exported.templates[0];
	expect(imported.id).not.toBe(template.id);
	expect(imported.steps[0].id).not.toBe(template.steps[0].id);
	expect(imported).toEqual({
		...template,
		id: imported.id,
		steps: [{ ...template.steps[0], id: imported.steps[0].id }],
	});

	await upload([template, { name: "Invalid template" }]);
	await expect(page.getByText(/^Invalid or unsupported template export:/)).toBeVisible();
	expect((await downloadTemplates()).templates).toEqual(exported.templates);
});

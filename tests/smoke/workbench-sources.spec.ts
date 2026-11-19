import { expect, test } from "@playwright/test";
import { createDiagnosticProfiles, openDiagnosticWorkbench } from "./support/diagnostic";

test("a cloud source must be an HTTPS address, and only Google Docs is a Google Docs relay", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("textbox", { name: "Workbench lane", exact: true }).click();
	await page.getByRole("option", { name: "Linked paths + cloud docs", exact: true }).click();
	const url = page.getByLabel("Source URL", { exact: true });
	const add = page.getByRole("button", { name: "Add cloud source", exact: true });
	const open = page.getByRole("button", { name: "Open source", exact: true });

	// An address a browser would run or send in the clear is never saved.
	for (const refused of ["javascript:alert(1)", "http://drive.google.com/drive/folders/a"]) {
		await url.fill(refused);
		await add.click();
		await expect(
			page.getByText("Source URLs must use HTTPS and cannot contain credentials.", {
				exact: true,
			}),
		).toBeVisible();
		await expect(open).toHaveCount(0);
	}

	// A valid address is saved and listed.
	await page.getByLabel("Label (optional)", { exact: true }).fill("New source");
	await url.fill("https://drive.google.com/drive/folders/new");
	await add.click();
	await expect(page.getByText("New source", { exact: true })).toBeVisible();
	await expect(open).toHaveCount(1);
	await expect(page.getByText("Cloud source setup failed", { exact: true })).toHaveCount(0);

	// A document on another host is not a Google Docs document.
	await page.getByRole("textbox", { name: "Provider", exact: true }).click();
	await page.getByRole("option", { name: "Google Docs relay", exact: true }).click();
	await url.fill("https://example.com/document/d/not-google/edit");
	await add.click();
	await expect(
		page.getByText("Provide a Google Docs document URL.", { exact: true }),
	).toBeVisible();
	await expect(open).toHaveCount(1);
	await url.fill("https://docs.google.com/document/d/test-id/edit");
	await add.click();
	await expect(open).toHaveCount(2);
	await expect(page.getByRole("button", { name: "Load doc", exact: true })).toHaveCount(1);
});

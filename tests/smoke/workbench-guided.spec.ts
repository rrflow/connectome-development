import { expect, type Page, test } from "@playwright/test";
import { createDiagnosticProfiles, openDiagnosticWorkbench } from "./support/diagnostic";

const WORKBENCH = /\/reasoning\/workbench$/;

/** Clicks one guided button and requires that it led to a real view of the project. */
async function follows(page: Page, name: string | RegExp, index: number) {
	const guided = page.getByRole("heading", { name: "Guided routes", exact: true });
	await expect(guided).toBeVisible();
	const before = page.url();
	await page.getByRole("button", { name }).nth(index).click();
	// A route the project does not have is refused where the person is.
	await expect(page.getByText("Guided route unavailable", { exact: true })).toHaveCount(0);
	const after = page.url();
	if (after !== before) {
		expect(after).toMatch(/\/runtime\/[^/]+\/[a-z]+\/[a-z-]+$/);
		await page.goBack();
	}
	await expect(page).toHaveURL(WORKBENCH);
	await expect(guided).toBeVisible();
	return after !== before;
}

test("every guided step, skill lens and routine step opens a view the project has", async ({
	page,
}) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await expect(page).toHaveURL(WORKBENCH);

	let moved = 0;
	for (const name of ["Open step", "Open skill lens", /^Step \d+: /]) {
		const count = await page.getByRole("button", { name }).count();
		expect(count, `${String(name)} buttons`).toBeGreaterThan(0);
		for (let index = 0; index < count; index++) {
			if (await follows(page, name, index)) moved += 1;
		}
	}
	// At least the steps that lead away from the workbench were followed.
	expect(moved).toBeGreaterThan(0);

	// A second route plan and a second routine are followed the same way.
	for (const label of ["Route plan", "Routine"]) {
		const select = page.getByRole("textbox", { name: label, exact: true });
		await select.click();
		const options = page.getByRole("option");
		if ((await options.count()) > 1) await options.nth(1).click();
		else await page.keyboard.press("Escape");
	}
	const steps = await page.getByRole("button", { name: "Open step" }).count();
	for (let index = 0; index < steps; index++) await follows(page, "Open step", index);
	await follows(page, "Start routine", 0);

	// Recording the outcome is done in the workbench itself.
	await page.getByRole("button", { name: "Record outcome", exact: true }).click();
	await expect(page).toHaveURL(WORKBENCH);
});

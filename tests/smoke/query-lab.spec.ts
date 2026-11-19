import { expect, test } from "@playwright/test";
import { createDiagnosticProfiles, openDiagnosticWorkbench } from "./support/diagnostic";

test("the query lab sends typed variables and runs only what is selected", async ({ page }) => {
	const { profileA, profileB } = await createDiagnosticProfiles(page);
	await openDiagnosticWorkbench(page, profileA, profileB);
	await page.getByRole("button", { name: "Labs", exact: true }).click();
	await page.getByRole("tab", { name: "Query lab", exact: true }).click();
	await expect(page.getByRole("button", { name: "Infer variables", exact: true })).toBeVisible();
	const requests = () =>
		page.evaluate(() =>
			(
				window as unknown as { __diagnosticCaptureTest: { queryRequests: () => unknown[] } }
			).__diagnosticCaptureTest.queryRequests(),
		);
	const sent = (await requests()).length;
	const editor = page.locator(".cm-content").first();
	const text = "FROM record:document AT VALID $at KNOWN $cursor PROJECT * LIMIT 5";
	await editor.click();
	await page.keyboard.insertText(text);

	// Inferring lists the query's parameters once each and opens the pane.
	await page.getByRole("button", { name: "Infer variables", exact: true }).click();
	const variables = page.locator(".cm-content").nth(1);
	await expect(variables).toContainText('"at": null');
	await expect(variables).toContainText('"cursor": null');
	await expect(page.getByText("2 sent with each run", { exact: true })).toBeVisible();

	// Text that is not an object is never sent, and the run is held back.
	await variables.click();
	await page.keyboard.press("ControlOrMeta+a");
	await page.keyboard.insertText("[1]");
	const run = page.getByRole("button", { name: "Run", exact: true });
	await expect(run).toBeDisabled();
	await expect(
		page.getByText("The variables cannot be read, so the query will not run", { exact: true }),
	).toBeVisible();

	// Values are typed as the contract types them, and travel with the run.
	await page.keyboard.press("ControlOrMeta+a");
	await page.keyboard.insertText(
		'{"at": 5, "cursor": {"type": "unsigned", "value": 7}, "shift": -2}',
	);
	await expect(page.getByText("3 sent with each run", { exact: true })).toBeVisible();
	await page.keyboard.press("ControlOrMeta+Enter");
	await expect.poll(async () => (await requests()).length).toBe(sent + 1);
	expect((await requests()).at(-1)).toEqual({
		query: text,
		parameters: {
			at: { type: "unsigned", value: 5 },
			cursor: { type: "unsigned", value: 7 },
			shift: { type: "integer", value: -2 },
		},
	});
	await expect(page.getByText(/answered in [0-9.]+ ms round trip/)).toBeVisible();

	// Selecting the query relabels Run, and only the selection is sent.
	await editor.click();
	await page.keyboard.press("ControlOrMeta+e");
	const selection = page.getByRole("button", { name: "Run selection", exact: true });
	await expect(selection).toBeVisible();
	await expect(page.getByText(/Only the highlighted selection will run/)).toBeVisible();
	await selection.click();
	await expect.poll(async () => (await requests()).length).toBe(sent + 2);
	expect(((await requests()).at(-1) as { query: string }).query).toBe(text);

	// Formatting changes whitespace only: one clause per line.
	await page.getByRole("button", { name: "Format selection", exact: true }).click();
	await expect(editor.locator(".cm-line")).toHaveCount(4);

	// What the tokenizer would refuse is marked before the query is run.
	await editor.click();
	await page.keyboard.press("ControlOrMeta+a");
	await page.keyboard.insertText('FROM record:document WHERE note = "open');
	await expect(page.locator(".cm-lintRange-error")).toBeVisible();
	await expect(run).toHaveAttribute("title", /The engine's tokenizer would refuse this/);
});

import { expect, test } from "@playwright/test";

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

test("creates an RRD HTTP runtime profile by default", async ({ page }) => {
	const pageErrors: Error[] = [];
	const requests: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error));
	await page.route("http://localhost:9477/v1/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		requests.push(path);
		const payload =
			path === "/v1/health/live"
				? { observed_at_unix_ms: 1 }
				: path === "/v1/health/ready"
					? {
							observed_at_unix_ms: 2,
							claim_sequence: 3,
							runtime_cursor: 4,
							backend: "rrd-lsm",
						}
					: {
							protocol: "rrd",
							protocol_version: 1,
							implementation: "rrd-server",
							implementation_version: "0.1.0",
							deployment_mode: "local_daemon",
							instance: { kind: "instance", id: "rrd-smoke" },
							capabilities: [
								{
									name: "context-assemble",
									contract_version: 1,
									status: "available",
								},
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
	expect(
		pageErrors,
		pageErrors.map((error) => error.stack ?? error.message).join("\n\n"),
	).toEqual([]);
});

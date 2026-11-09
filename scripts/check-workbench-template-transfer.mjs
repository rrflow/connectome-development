import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const template = {
	id: "source-template",
	name: "Template A",
	description: "Description",
	schema: "source",
	skills: ["Rust"],
	researchReferences: [],
	minimumRequirements: [],
	filePatterns: [],
	folderPatterns: [],
	createdAtUnixMs: 1,
	updatedAtUnixMs: 2,
	steps: [
		{
			id: "step",
			title: "Inspect",
			detail: "",
			route: "workbench",
			linkedPathId: "missing-path",
		},
		{ id: "unknown-step", title: "Unknown", detail: "", route: "unknown-route" },
	],
	learningEvents: [
		{
			id: "event",
			kind: "factoid",
			mode: "passive",
			title: "Saved observation",
			body: "Visible saved content",
			component: "card",
			requiresOperatorSignoff: false,
			triggers: [{ id: "trigger", kind: "manual", description: "" }],
			actions: [],
			catamorphismTarget: "clyffy",
			catamorphismNote: "",
		},
	],
};
const entry = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { adapter } from "/src/adapter/index.tsx";
import { useConfigStore } from "/src/shell/stores/config.tsx";
import { WorkbenchTemplateTransfer } from "/src/screens/connectome/pages/RuntimeConnection/workbenchTemplateTransfer.tsx";
import { WorkbenchTemplateAuthoring } from "/src/screens/connectome/pages/RuntimeConnection/workbenchTemplateAuthoring.tsx";
import { WorkbenchTemplateLibrary } from "/src/screens/connectome/pages/RuntimeConnection/workbenchTemplateLibrary.tsx";
import { WorkbenchSources } from "/src/screens/connectome/pages/RuntimeConnection/workbenchSources.tsx";
const template = ${JSON.stringify(template)};
const source = {id:"keep", label:"Existing source", provider:"google-drive", mode:"import", url:"https://drive.google.com/drive/folders/example", status:"needs-auth", createdAtUnixMs:1, updatedAtUnixMs:1};
const state = (templates) => ({workbenches: [], receipts: [], templates, linkedPaths: [{id:"path-1",label:"Saved folder",path:"C:\\\\data",kind:"directory",status:"missing"}], remoteSources: [source]});
useConfigStore.getState().addConnection({id:"a", name:"A", workbench:state([template])});
useConfigStore.getState().addConnection({id:"b", name:"B", workbench:state([])});
window.testControls = {
  content: JSON.stringify({version:1, exportedAtUnixMs:3, templates:[template]}),
  defer: false,
  release: null,
  saved: null,
  route: null,
  opened: null,
  saveMode: "success",
  profile: (id) => useConfigStore.getState().connections.find((item) => item.id === id).workbench,
  addNote: (id) => {
    const store = useConfigStore.getState();
    const workbench = store.connections.find((item) => item.id === id).workbench;
    store.updateConnection({ id, workbench: {...workbench, receipts: [{id:"concurrent-note"}]} });
  },
};
adapter.openFile = async () => {
  if (window.testControls.defer) await new Promise((resolve) => { window.testControls.release = resolve; });
  if (window.testControls.content === null) return [];
  return [new File([window.testControls.content], "templates.json")];
};
adapter.saveFile = async (_title, _name, _filters, content) => {
  if (window.testControls.saveMode === "cancel") return false;
  if (window.testControls.saveMode === "error") throw new Error("Write failed");
  window.testControls.saved = await content();
  return true;
};
adapter.openUrl = async (url) => { window.testControls.opened = url; };
function TestApp() {
  const [id, setId] = useState("a");
  return React.createElement(MantineProvider, null,
    React.createElement("button", {onClick: () => setId(id === "a" ? "b" : "a")}, "Switch profile"),
    React.createElement(WorkbenchTemplateTransfer, {key:"transfer-"+id, connectionId:id}),
    React.createElement(WorkbenchTemplateAuthoring, {key:"authoring-"+id, connectionId:id}),
    React.createElement(WorkbenchTemplateLibrary, {key:"library-"+id, connectionId:id, onOpenRoute:(route) => { window.testControls.route = route; }}),
    React.createElement(WorkbenchSources, {key:"sources-"+id, connectionId:id}));
}
createRoot(document.getElementById("root")).render(React.createElement(TestApp));
`;

const server = await createServer({
	server: { host: "127.0.0.1", port: 0 },
	plugins: [
		{
			name: "workbench-transfer-test",
			resolveId(id) {
				if (id === "/workbench-transfer-entry") return "\0workbench-transfer-entry.js";
			},
			load(id) {
				if (id === "\0workbench-transfer-entry.js") return entry;
			},
			configureServer(vite) {
				vite.middlewares.use(
					"/__workbench-transfer-test",
					async (_request, response, next) => {
						try {
							const html = await vite.transformIndexHtml(
								"/__workbench-transfer-test",
								'<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/workbench-transfer-entry"></script></body></html>',
							);
							response.setHeader("Content-Type", "text/html");
							response.end(html);
						} catch (error) {
							next(error);
						}
					},
				);
			},
		},
	],
});
let browser;
try {
	await server.listen();
	const address = server.httpServer.address();
	assert.ok(address && typeof address !== "string");
	browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await page.goto(`http://127.0.0.1:${address.port}/__workbench-transfer-test`);
	await page.getByText("unresolved link=missing-path", { exact: false }).waitFor();
	await page.getByText("Visible saved content", { exact: true }).waitFor();
	assert.equal(await page.getByRole("button", { name: "Link folder" }).isDisabled(), true);
	assert.equal(await page.getByRole("button", { name: "Reconnect" }).isDisabled(), true);
	await page.getByRole("button", { name: "Remove link" }).click();
	let sourceProfile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(sourceProfile.linkedPaths.length, 0);
	assert.equal(sourceProfile.templates[0].steps[0].linkedPathId, "missing-path");
	assert.equal(
		(await page.evaluate(() => window.testControls.profile("b"))).linkedPaths.length,
		1,
	);
	await page.getByRole("button", { name: "Open source" }).click();
	assert.equal(
		await page.evaluate(() => window.testControls.opened),
		"https://drive.google.com/drive/folders/example",
	);
	await page.getByLabel("Source URL").fill("javascript:alert(1)");
	await page.getByRole("button", { name: "Add cloud source" }).click();
	await page.getByText("Source URLs must use HTTPS and cannot contain credentials.").waitFor();
	await page.getByLabel("Label (optional)").fill("New source");
	await page.getByLabel("Source URL").fill("https://drive.google.com/drive/folders/new");
	await page.evaluate(() => window.testControls.addNote("a"));
	await page.getByRole("button", { name: "Add cloud source" }).click();
	sourceProfile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(sourceProfile.remoteSources.length, 2);
	assert.equal(sourceProfile.remoteSources[0].status, "needs-auth");
	assert.deepEqual(sourceProfile.receipts, [{ id: "concurrent-note" }]);
	assert.equal(sourceProfile.templates.length, 1);
	await page
		.getByText("New source", { exact: true })
		.locator("..")
		.locator("..")
		.getByRole("button", { name: "Remove", exact: true })
		.click();
	sourceProfile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(sourceProfile.remoteSources.length, 1);
	await page.getByRole("textbox", { name: "Provider" }).click();
	await page.getByRole("option", { name: "Google Docs relay" }).dispatchEvent("click");
	assert.equal(
		await page.getByRole("textbox", { name: "Provider" }).inputValue(),
		"Google Docs relay",
	);
	await page.getByLabel("Source URL").fill("https://example.com/document/d/not-google/edit");
	await page.getByRole("button", { name: "Add cloud source" }).click();
	await page.getByText("Provide a Google Docs document URL.").waitFor();
	await page.getByLabel("Label (optional)").fill("Document source");
	await page.getByLabel("Source URL").fill("https://docs.google.com/document/d/test-id/edit");
	await page.getByRole("button", { name: "Add cloud source" }).click();
	sourceProfile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(
		sourceProfile.remoteSources[0].relayUrl,
		"https://docs.google.com/document/d/test-id/export?format=txt",
	);
	assert.equal(await page.getByRole("button", { name: "Load doc" }).isDisabled(), true);
	await page
		.getByText("Document source", { exact: true })
		.locator("..")
		.locator("..")
		.getByRole("button", { name: "Remove", exact: true })
		.click();
	await page.getByLabel("Content", { exact: true }).fill("Local document text");
	await page.getByRole("button", { name: "Save text" }).click();
	await page.getByText("Save requested.", { exact: true }).waitFor();
	assert.equal(await page.evaluate(() => window.testControls.saved), "Local document text");
	await page.evaluate(() => {
		window.testControls.saveMode = "cancel";
	});
	await page.getByRole("button", { name: "Save text" }).click();
	await page.getByText("Save cancelled.", { exact: true }).waitFor();
	await page.evaluate(() => {
		window.testControls.saveMode = "error";
	});
	await page.getByRole("button", { name: "Save text" }).click();
	await page.getByText("Write failed", { exact: true }).waitFor();
	await page.evaluate(() => {
		window.testControls.saveMode = "success";
	});
	assert.equal(await page.getByRole("button", { name: "Run scripted event" }).isDisabled(), true);
	const openButtons = page.getByRole("button", { name: "Open", exact: true });
	assert.equal(await openButtons.nth(1).isDisabled(), true);
	await openButtons.first().click();
	assert.equal(await page.evaluate(() => window.testControls.route), "reasoning/workbench");
	await page.getByLabel("Template name").fill("Created in Workbench");
	await page.getByLabel("Skills (one per line)").fill("rust\nretrieval");
	await page.getByLabel("Minimum requirements (one per line)").fill("authorized source");
	await page.getByLabel("Action label").fill("Check storage");
	await page.getByRole("button", { name: "Add action" }).click();
	await page.getByLabel("Title", { exact: true }).first().fill("New learning event");
	await page.getByLabel("Body", { exact: true }).fill("Authored event body");
	await page.getByRole("button", { name: "Add learning event" }).click();
	await page.getByText("manual · Run on operator command.", { exact: true }).waitFor();
	await page.getByLabel("Title", { exact: true }).first().fill("Second event");
	await page.getByRole("button", { name: "Add learning event" }).click();
	await page.evaluate(() => window.testControls.addNote("a"));
	await page.getByRole("button", { name: "Save template" }).click();
	let createdProfile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(createdProfile.templates.length, 2);
	assert.deepEqual(createdProfile.templates[0].skills, ["rust", "retrieval"]);
	assert.deepEqual(createdProfile.templates[0].minimumRequirements, ["authorized source"]);
	assert.equal(createdProfile.templates[0].learningEvents[0].body, "Authored event body");
	assert.equal(createdProfile.templates[0].learningEvents[0].actions[0].label, "Check storage");
	assert.equal(createdProfile.templates[0].learningEvents[0].triggers[0].kind, "manual");
	assert.equal(createdProfile.templates[0].learningEvents[1].triggers[0].kind, "manual");
	assert.notEqual(
		createdProfile.templates[0].learningEvents[0].triggers[0].id,
		createdProfile.templates[0].learningEvents[1].triggers[0].id,
	);
	assert.equal(createdProfile.templates[0].steps.length, 3);
	assert.deepEqual(
		createdProfile.remoteSources.map((source) => source.id),
		["keep"],
	);
	assert.deepEqual(createdProfile.receipts, [{ id: "concurrent-note" }]);
	await page
		.getByText("Created in Workbench", { exact: true })
		.locator("..")
		.getByRole("button", { name: "Remove", exact: true })
		.click();
	createdProfile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(createdProfile.templates.length, 1);
	await page.getByRole("button", { name: "Export templates" }).click();
	await page.getByText("Template export requested.").waitFor();
	const exported = await page.evaluate(() => JSON.parse(window.testControls.saved));
	assert.equal(exported.version, 1);
	assert.deepEqual(exported.templates, [template]);

	await page.getByRole("button", { name: "Import templates" }).click();
	await page.getByText("Imported 1 template.").waitFor();
	let profile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(profile.templates.length, 2);
	assert.equal(profile.templates[0].steps[0].linkedPathId, "missing-path");
	assert.notEqual(profile.templates[0].id, template.id);
	assert.deepEqual(
		profile.remoteSources.map((source) => source.id),
		["keep"],
	);

	await page.evaluate(() => {
		window.testControls.content = '{"version":2}';
	});
	await page.getByRole("button", { name: "Import templates" }).click();
	await page.getByText(/Invalid or unsupported template export/).waitFor();
	profile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(profile.templates.length, 2);

	await page.evaluate(() => {
		window.testControls.content = null;
	});
	await page.getByRole("button", { name: "Import templates" }).click();
	await page.getByText("Template import cancelled.").waitFor();

	await page.evaluate(() => {
		window.testControls.content = JSON.stringify({
			version: 1,
			exportedAtUnixMs: 3,
			templates: [window.testControls.profile("a").templates[0]],
		});
		window.testControls.release = null;
		window.testControls.defer = true;
	});
	await page.getByRole("button", { name: "Import templates" }).click();
	await page.waitForFunction(() => window.testControls.release !== null);
	await page.evaluate(() => {
		window.testControls.addNote("a");
		window.testControls.release();
	});
	await page.getByText("Imported 1 template.").waitFor();
	profile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(profile.templates.length, 3);
	assert.deepEqual(profile.receipts, [{ id: "concurrent-note" }]);
	await page
		.getByText("Template A", { exact: true })
		.first()
		.locator("..")
		.getByRole("button", { name: "Remove", exact: true })
		.click();
	profile = await page.evaluate(() => window.testControls.profile("a"));
	assert.equal(profile.templates.length, 2);
	assert.deepEqual(profile.receipts, [{ id: "concurrent-note" }]);
	assert.deepEqual(
		profile.remoteSources.map((source) => source.id),
		["keep"],
	);

	await page.evaluate(() => {
		window.testControls.content = JSON.stringify({
			version: 1,
			exportedAtUnixMs: 3,
			templates: [window.testControls.profile("a").templates[0]],
		});
		window.testControls.release = null;
		window.testControls.defer = true;
	});
	await page.getByRole("button", { name: "Import templates" }).click();
	await page.waitForFunction(() => window.testControls.release !== null);
	await page.getByRole("button", { name: "Switch profile" }).click();
	await page.getByText("No dataset templates saved yet.").waitFor();
	await page.evaluate(() => window.testControls.release());
	await page.waitForTimeout(100);
	assert.equal((await page.evaluate(() => window.testControls.profile("a"))).templates.length, 2);
	assert.equal((await page.evaluate(() => window.testControls.profile("b"))).templates.length, 0);
	assert.deepEqual(pageErrors, []);
	console.log(
		"Template browser test: library, routes, removal, transfer, concurrency and profile switch passed.",
	);
} finally {
	if (browser) await browser.close();
	await server.close();
}
